import os
import uuid
import aiofiles
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends, Request, Response
from sqlalchemy.orm import Session
from app.streaming.hls_worker import process_video_to_hls
from app.services.s3_service import get_s3_url, delete_video_folder

from app.database.config import get_db
from app.database import models
from app.database.models import User
from app.auth.oauth2 import get_current_user
from app.videos.schemas import VideoResponse, BulkDeleteVideos
from app.middleware.limiter import limiter
import shutil
from typing import Optional

router = APIRouter()

STORAGE_DIR = "storage"
VIDEOS_DIR = os.path.join(STORAGE_DIR, "videos")
os.makedirs(VIDEOS_DIR, exist_ok=True)

@router.post("/upload")
@limiter.limit("3/minute;10/hour")
async def upload_video(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(...),
    collection_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accept a video upload request, save it, and trigger HLS conversion.
    Also save metadata to SQLite.
    """
    video_id = str(uuid.uuid4())
    video_dir = os.path.join(VIDEOS_DIR, video_id)
    os.makedirs(video_dir, exist_ok=True)
    
    input_path = os.path.join(video_dir, "original.mp4")
    
    content = await file.read()
    file_size_bytes = len(content)
    
    if current_user.storage_used + file_size_bytes > current_user.storage_limit:
        raise HTTPException(status_code=413, detail="Storage limit exceeded. Upgrade your plan or delete existing streams.")
        
    async with aiofiles.open(input_path, 'wb') as out_file:
        await out_file.write(content)
        
    # Generate local URL for the eventual stream.m3u8
    stream_url = f"/output/videos/{video_id}/stream.m3u8"
        
    # Persist to SQLAlchemy
    new_video = models.Video(
        video_id=video_id,
        user_id=current_user.id,
        title=title,
        description=description,
        stream_url=stream_url,
        processing_status='pending',
        file_size=file_size_bytes
    )
    
    current_user.storage_used += file_size_bytes
    
    db.add(new_video)
    db.add(current_user)
    db.commit()
    db.refresh(new_video)

    # Link to collection if provided
    if collection_id and collection_id != 'null' and collection_id != 'undefined':
        try:
            coll_id = int(collection_id)
            # Verify collection belongs to user
            collection = db.query(models.Collection).filter(
                models.Collection.id == coll_id,
                models.Collection.user_id == current_user.id
            ).first()
            
            if collection:
                new_link = models.CollectionVideo(
                    collection_id=coll_id,
                    video_id=new_video.id
                )
                db.add(new_link)
                db.commit()

        except Exception as exc:
            pass

           

        
    # Trigger Celery task
    process_video_to_hls.delay(video_id, input_path)

    return {
        "video_id": video_id,
        "message": "Video uploaded successfully"
    }

@router.get("", response_model=list[VideoResponse])
async def get_videos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return a list of uploaded videos belonging to the current user.
    """
    db_videos = db.query(models.Video).filter(
        models.Video.user_id == current_user.id
    ).order_by(models.Video.created_at.desc()).all()
    return db_videos

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str, 
    db: Session = Depends(get_db)
):
    """
    Return metadata for a single video. Publicly accessible if ID is known.
    """
    video = None
    if video_id.isdigit():
        video = db.query(models.Video).filter(models.Video.id == int(video_id)).first()
    
    if not video:
        video = db.query(models.Video).filter(models.Video.video_id == video_id).first()
        
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    return video

@router.get("/{video_id}/status")
async def get_video_status(
    video_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return processing status of a video owned by the user.
    """
    video = db.query(models.Video).filter(
        models.Video.video_id == video_id,
        models.Video.user_id == current_user.id
    ).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or not authorized")
    return {"status": video.processing_status}

@router.delete("/{video_id}")
async def delete_video(
    video_id: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Delete a video by UUID or ID. Cleans up DB and local storage.
    """
    video = db.query(models.Video).filter(
        (models.Video.video_id == video_id) | (models.Video.id.cast(models.String) == video_id)
    ).first()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    current_user.storage_used -= video.file_size
    if current_user.storage_used < 0:
        current_user.storage_used = 0

    video_dir = os.path.join(VIDEOS_DIR, video.video_id)
    if os.path.exists(video_dir):
        shutil.rmtree(video_dir)
    
    try:
        delete_video_folder(video.video_id)
    except Exception as exc:
        pass

        pass


    db.delete(video)
    db.commit()

    return {"message": "Video deleted successfully"}

@router.post("/bulk-delete")
async def bulk_delete_videos(
    payload: BulkDeleteVideos,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Efficiently delete multiple videos.
    """
    video_ids = payload.video_ids
    if not video_ids:
        return {"message": "No videos to delete"}

    videos = db.query(models.Video).filter(
        models.Video.video_id.in_(video_ids),
        models.Video.user_id == current_user.id
    ).all()

    deleted_count = 0
    total_freed_space = 0

    for video in videos:
        video_dir = os.path.join(VIDEOS_DIR, video.video_id)
        if os.path.exists(video_dir):
            shutil.rmtree(video_dir)
        try:
            delete_video_folder(video.video_id)
        except Exception as exc:
            pass

        total_freed_space += video.file_size
        db.delete(video)
        deleted_count += 1

    current_user.storage_used -= total_freed_space
    if current_user.storage_used < 0:
        current_user.storage_used = 0
    
    db.commit()
    return {
        "message": f"Successfully deleted {deleted_count} videos",
        "deleted_count": deleted_count,
        "freed_space": total_freed_space
    }
