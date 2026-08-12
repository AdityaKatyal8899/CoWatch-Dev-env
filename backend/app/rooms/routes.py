from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks, Request, Response
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import cast, String, func
from sqlalchemy.dialects.postgresql import UUID
from ..database.config import get_db
from ..database import models
import uuid
import time
from datetime import datetime, timezone
import json
from .schemas import (
    CreateRoomRequest, 
    RoomCreatedResponse, 
    JoinRoomRequest, 
    JoinRoomResponse,
    ParticipantSchema,
    RoomSchema
)
import qrcode
from io import BytesIO
from fastapi.responses import StreamingResponse
from app.middleware.limiter import limiter
from app.auth.oauth2 import get_current_user_optional

router = APIRouter()
rooms: Dict[str, Any] = {}

active_connections: Dict[str, Dict[str, WebSocket]] = {}

import re

def extract_youtube_id(url: str) -> Optional[str]:
    if not url:
        return None
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

@router.post("/rooms/create", response_model=RoomCreatedResponse)
@limiter.limit("10/minute")
async def create_room(request: Request, response: Response, req: CreateRoomRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user_optional)):
    short_id = str(uuid.uuid4())[:8] # Short clean room ID
    invite_link = f"/room/{short_id}"

    stream_url = req.stream_url
    room_title = req.title or "New Watch Party"
    video_db_id = None
    collection = None
    media_type = "hls"
    video_url = None
    youtube_id = None

    # Check if either stream_url or video_url is a YouTube URL
    test_url = req.video_url or req.stream_url
    extracted_id = extract_youtube_id(test_url)
    if extracted_id:
        # Enforce monthly YouTube room limits for the host's plan
        if current_user:
            from app.subscriptions.plans import get_effective_plan, get_plan_config
            user_plan = get_effective_plan(current_user)
            plan_config = get_plan_config(user_plan)
            yt_limit = plan_config.get("yt_rooms_per_month")
            
            if yt_limit is not None:
                from datetime import datetime, date
                today = date.today()
                start_of_month = datetime(today.year, today.month, 1)
                
                yt_rooms_count = db.query(models.Room).filter(
                    models.Room.host_id == str(current_user.id),
                    models.Room.media_type == "youtube",
                    models.Room.created_at >= start_of_month
                ).count()
                
                if yt_rooms_count >= yt_limit:
                    raise HTTPException(
                        status_code=403,
                        detail=f"You have reached your monthly limit of {yt_limit} YouTube rooms. Upgrade your plan for unlimited rooms."
                    )

        media_type = "youtube"
        youtube_id = extracted_id
        video_url = test_url
        stream_url = test_url

    # Resolve stream_url and real DB ID from video_id (UUID string) if provided (and not YouTube)
    elif req.video_id or req.collection_id:
        video = None
        if req.collection_id:
            # Collection-bound room: validate ownership + pick the start video
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required for collection rooms")
            collection = db.query(models.Collection).filter(
                models.Collection.id == req.collection_id,
                models.Collection.user_id == current_user.id
            ).first()
            if not collection:
                raise HTTPException(status_code=404, detail="Collection not found")

            # Ordered episode list (insertion order — collection_videos.id)
            collection_videos = (
                db.query(models.Video)
                .join(models.CollectionVideo, models.CollectionVideo.video_id == models.Video.id)
                .filter(models.CollectionVideo.collection_id == collection.id)
                .order_by(models.CollectionVideo.id)
                .all()
            )
            if not collection_videos:
                raise HTTPException(status_code=400, detail="Collection has no videos")

            # Explicitly chosen video must be a member of this collection
            if req.video_id:
                video = next((v for v in collection_videos if v.video_id == req.video_id), None)
                if not video:
                    raise HTTPException(status_code=400, detail="Video is not in this collection")
            else:
                # Default to the first ready video; fall back to the first item
                video = next((v for v in collection_videos if v.processing_status == "ready"), collection_videos[0])
        elif req.video_id:
            video = db.query(models.Video).filter(models.Video.video_id == req.video_id).first()

        if video:
            video_db_id = video.id
            stream_url = video.stream_url
            if not req.title:
                room_title = video.title

            import os
            local_dir = os.path.join("storage", "videos", str(video.video_id))
            if not os.path.exists(local_dir):
                from ..streaming.hls_worker import fetch_initial_hls_segments
                background_tasks.add_task(fetch_initial_hls_segments, str(video.video_id))

    if not stream_url:
        raise HTTPException(status_code=400, detail="Missing stream_url or invalid video_id")

    # 18+ rooms may only be created by age-verified (>=18) hosts.
    if req.is_adult:
        from app.moderation.config import is_age_verified
        if not current_user or not is_age_verified(current_user):
            raise HTTPException(
                status_code=403,
                detail="You must be age-verified (18+) to host an 18+ room.",
            )

    # Remove scheduling logic

    host_id_attr = str(req.host_id) if req.host_id else None

    
    # We store the host_id as a string now. 
    # If it happens to be a real user's UUID, fine. If not (guest), also fine.
    host_final_id = host_id_attr

    initial_status = "waiting"

    # Persist to DB
    new_room = models.Room(
        room_id=short_id,
        title=room_title,
        host_id=host_final_id,
        video_id=video_db_id,
        collection_id=collection.id if collection else None,
        stream_url=stream_url,
        stream_status=initial_status,
        is_playing=False,
        offset=0.0,
        media_type=media_type,
        video_url=video_url,
        youtube_video_id=youtube_id,
        is_adult=bool(req.is_adult)
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    return RoomCreatedResponse(
        room_id=short_id, 
        invite_link=invite_link, 
        title=room_title
    )




@router.post("/rooms/join", response_model=JoinRoomResponse)
async def join_room(req: JoinRoomRequest, db: Session = Depends(get_db)):
    room = db.query(models.Room).filter(models.Room.room_id == req.room_id).first()
    if not room:
        video = db.query(models.Video).filter(models.Video.video_id == req.room_id).first()
        if video:
            short_id = str(uuid.uuid4())[:8]
            room = models.Room(
                room_id=short_id,
                title=video.title,
                host_id=req.user_id,
                video_id=video.id,
                stream_url=video.stream_url,
                # scheduled_time=datetime.now(timezone.utc),
                stream_status="waiting",
                is_playing=False
            )
            db.add(room)
            db.commit()
            db.refresh(room)
        else:
            return JoinRoomResponse(success=False, message="Room or Video not found")

    # --- Moderation gates on join ---
    if room.status == "cancelled":
        return JoinRoomResponse(success=False, message="This room has been cancelled.")

    if room.is_adult:
        from app.moderation.config import is_age_verified
        allowed = False
        try:
            uid = uuid.UUID(req.user_id)
            u = db.query(models.User).filter(models.User.id == uid).first()
            allowed = is_age_verified(u)
        except Exception:
            allowed = False
        if not allowed:
            return JoinRoomResponse(
                success=False,
                message="You can't join right now — this is an 18+ room.",
            )

    return JoinRoomResponse(success=True, room=room)

@router.get("/rooms/active")
async def get_active_rooms(db: Session = Depends(get_db)):
    # We query all rooms from Database (as orphaned rooms are deleted)
    rooms_db = db.query(models.Room).all()
    from .websockets import active_connections
    result = []
    for r in rooms_db:
        result.append({
            "room_id": r.room_id,
            "title": r.title or "Live Room",
            "participant_count": len(active_connections.get(r.room_id, {})),
            "stream_status": r.stream_status,
            "host_id": str(r.host_id) if r.host_id else None
        })
    return result

@router.get("/rooms/{room_id}/qr")
async def get_room_qr(room_id: str):
    import os
    frontend_url_raw = os.getenv("FRONTEND_URL", "http://localhost:3000")
    frontend_url = [u.strip() for u in frontend_url_raw.split(",") if u.strip()][0].rstrip('/')
    join_url = f"{frontend_url}/room/{room_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(join_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return StreamingResponse(img_byte_arr, media_type="image/png")

@router.get("/rooms/{room_id}", response_model=RoomSchema)
async def get_room(room_id: str, db: Session = Depends(get_db)):
    # Use ORM model directly to benefit from Pydantic from_attributes and nested joins
    room = db.query(models.Room).options(
        joinedload(models.Room.video),
        joinedload(models.Room.collection)
    ).filter(models.Room.room_id == room_id).first()

    if room:
        # Manually attach host_name and video_description for schema compatibility
        # (until we refactor RoomSchema to rely solely on relations)
        host = db.query(models.User).filter(models.User.id == cast(room.host_id, UUID(as_uuid=True))).first() if room.host_id else None

        # We dynamic-patch the object so the response_model can pick it up
        room.host_name = host.display_name if host else "Guest"
        room.description = room.video.description if room.video else "No description available"
        room.server_time = datetime.now(timezone.utc).timestamp()
        
        # Populate active participants dynamically from websockets active connections
        from .websockets import active_connections
        active_uids = list(active_connections.get(room_id, {}).keys())
        
        participants_list = []
        if active_uids:
            for uid in active_uids:
                try:
                    val_uuid = uuid.UUID(uid)
                    db_user = db.query(models.User).filter(models.User.id == val_uuid).first()
                    if db_user:
                        is_user_host = False
                        if room.host_id:
                            is_user_host = (str(room.host_id).replace("-", "").lower() == str(db_user.id).replace("-", "").lower())
                        
                        participants_list.append({
                            "id": str(db_user.id),
                            "name": db_user.name,
                            "display_name": db_user.display_name,
                            "profile_picture": db_user.profile_picture,
                            "theme": db_user.theme or "default-dark",
                            "is_host": is_user_host
                        })
                except Exception:
                    is_guest_host = False
                    if room.host_id:
                        is_guest_host = (str(room.host_id).replace("-", "").lower() == uid.replace("-", "").lower())
                    
                    participants_list.append({
                        "id": uid,
                        "name": f"Guest_{uid[:5]}" if len(uid) > 5 else uid,
                        "display_name": uid,
                        "profile_picture": None,
                        "theme": "default-dark",
                        "is_host": is_guest_host
                    })
        
        room.participants = participants_list

        # Temporarily detach collection relationship to prevent Pydantic validation errors
        collection_orm = room.collection
        room.collection = None

        # Convert ORM object to Pydantic schema safely to bypass SQLAlchemy relationship restrictions
        room_schema_data = RoomSchema.model_validate(room) if hasattr(RoomSchema, 'model_validate') else RoomSchema.from_orm(room)

        # Restore the relationship
        room.collection = collection_orm

        # Collection-bound room: attach the ordered episode playlist (insertion order)
        if room.collection_id:
            collection_videos = (
                db.query(models.Video)
                .join(models.CollectionVideo, models.CollectionVideo.video_id == models.Video.id)
                .filter(models.CollectionVideo.collection_id == room.collection_id)
                .order_by(models.CollectionVideo.id)
                .all()
            )
            # Map ORM Video models to VideoResponse Pydantic schemas to allow clean JSON serialization
            from app.videos.schemas import VideoResponse
            videos_serialized = [
                VideoResponse.model_validate(v) if hasattr(VideoResponse, 'model_validate') else VideoResponse.from_orm(v)
                for v in collection_videos
            ]

            room_schema_data.collection = {
                "id": room.collection_id,
                "name": room.collection.name if room.collection else "Collection",
                "videos": videos_serialized
            }

        return room_schema_data
    
    raise HTTPException(status_code=404, detail="Room not found")

@router.delete("/rooms/{room_id}")
async def disband_room(room_id: str, db: Session = Depends(get_db)):
    # Formal REST endpoint to disband room
    room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    db.delete(room)
    db.commit()
    
    # Let the websockets module know to broadcast and severe
    import asyncio
    from .websockets import broadcast_to_room, active_connections
    if room_id in active_connections:
        asyncio.create_task(broadcast_to_room(room_id, {"type": "ROOM_ENDED"}))
        # wait a tiny bit asynchronously then del
        async def clear_conn():
            await asyncio.sleep(0.5)
            if room_id in active_connections:
                del active_connections[room_id]
        asyncio.create_task(clear_conn())
        
    return {"success": True, "message": "Room disbanded"}
