from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database.config import get_db
from app.database import models
from app.schemas import pydantic_model as schema
from app.auth.oauth2 import get_current_user

router = APIRouter(
    prefix="/collections",
    tags=["Collections"]
)

@router.post("", response_model=schema.CollectionSchema)
def create_collection(
    collection: schema.CollectionBase, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_collection = models.Collection(
        user_id=current_user.id,
        name=collection.name,
        description=collection.description
    )
    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)
    return new_collection

@router.get("", response_model=List[schema.CollectionSchema])
def get_collections(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Collection).filter(models.Collection.user_id == current_user.id).all()

@router.get("/{collection_id}", response_model=schema.CollectionSchema)
def get_collection(
    collection_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    collection = db.query(models.Collection).filter(
        models.Collection.id == collection_id,
        models.Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    return collection

@router.post("/{collection_id}/videos/{video_id}")
def add_video_to_collection(
    collection_id: int,
    video_id: str, # video_id (UUID string format)
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Verify collection ownership
    collection = db.query(models.Collection).filter(
        models.Collection.id == collection_id,
        models.Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # 2. Get internal video ID from video_id (UUID string)
    video = db.query(models.Video).filter(models.Video.video_id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # 3. Check if already exists
    existing = db.query(models.CollectionVideo).filter(
        models.CollectionVideo.collection_id == collection_id,
        models.CollectionVideo.video_id == video.id
    ).first()
    
    if existing:
        return {"message": "Video already in collection"}
    
    # 4. Add link
    new_link = models.CollectionVideo(
        collection_id=collection_id,
        video_id=video.id
    )
    db.add(new_link)
    db.commit()
    
    return {"message": "Video added to collection"}

@router.delete("/{collection_id}")
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    collection = db.query(models.Collection).filter(
        models.Collection.id == collection_id,
        models.Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    db.delete(collection)
    db.commit()
    
    return {"message": "Collection deleted"}
