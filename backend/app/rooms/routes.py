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

router = APIRouter()
rooms: Dict[str, Any] = {}

active_connections: Dict[str, Dict[str, WebSocket]] = {}

@router.post("/rooms/create", response_model=RoomCreatedResponse)
@limiter.limit("10/minute")
async def create_room(request: Request, response: Response, req: CreateRoomRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    short_id = str(uuid.uuid4())[:8] # Short clean room ID
    invite_link = f"/room/{short_id}"
    
    stream_url = req.stream_url
    room_title = req.title or "New Watch Party"
    video_db_id = None
    
    # Resolve stream_url and real DB ID from video_id (UUID string) if provided
    if req.video_id:
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
        stream_url=stream_url,
        stream_status=initial_status,
        is_playing=False,
        offset=0.0
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
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
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
        joinedload(models.Room.video)
    ).filter(models.Room.room_id == room_id).first()
    
    if room:
        # Manually attach host_name and video_description for schema compatibility 
        # (until we refactor RoomSchema to rely solely on relations)
        host = db.query(models.User).filter(models.User.id == cast(room.host_id, UUID(as_uuid=True))).first() if room.host_id else None
        
        # We dynamic-patch the object so the response_model can pick it up
        room.host_name = host.display_name if host else "Guest"
        room.description = room.video.description if room.video else "No description available"
        room.server_time = datetime.now(timezone.utc).timestamp()
        
        return room
    
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
