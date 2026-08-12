from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from ..database.config import get_db, SessionLocal
from ..database import models
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict
import uuid
import traceback
import asyncio

router = APIRouter()

# In-memory connections (these cannot be in DB)
active_connections: Dict[str, Dict[str, WebSocket]] = {}
last_seek_time: Dict[str, float] = {}  # Tracks last seek per room

# Chat-moderation state (in-memory; reset on restart — acceptable for v1 warn+mute)
chat_violations: Dict[str, Dict[str, int]] = {}  # room_id -> user_id -> violation count
chat_muted: Dict[str, Dict[str, float]] = {}     # room_id -> user_id -> mute expiry (epoch seconds)

@router.websocket("/ws/rooms/{room_id}/{user_id}")
async def room_websocket(websocket: WebSocket, room_id: str, user_id: str):
    await websocket.accept()
    
    # Use context manager for initial fetch
    with SessionLocal() as db:
        room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
        if not room:
            await websocket.send_json({
                "type": "error",
                "code": "ROOM_NOT_FOUND",
                "message": "Room no longer exists"
            })
            await websocket.close()
            return

        # --- Moderation gates on connect ---
        if room.status == "cancelled":
            await websocket.send_json({
                "type": "error",
                "code": "ROOM_CANCELLED",
                "message": "This room has been cancelled by moderation."
            })
            await websocket.close()
            return

        if room.is_adult:
            from app.moderation.config import is_age_verified
            db_user_for_age = None
            try:
                val_uuid = uuid.UUID(user_id)
                db_user_for_age = db.query(models.User).filter(models.User.id == val_uuid).first()
            except Exception:
                pass
            if not is_age_verified(db_user_for_age):
                await websocket.send_json({
                    "type": "error",
                    "code": "ADULT_AGE_REQUIRED",
                    "message": "You can't join right now — this is an 18+ room."
                })
                await websocket.close()
                return
        
        # Determine host status using CLEAN UUIDs (no dashes, lowercase)
        db_host_id = str(room.host_id).replace("-", "").lower() if room.host_id else "none"
        clean_user_id = user_id.replace("-", "").lower()
        is_host_initial = (db_host_id == clean_user_id)

        # Calculate live offset for late joiners
        current_offset = room.offset
        if room.is_playing and room.started_at:
            try:
                # We must handle timezone-aware or naive datetime consistently
                # Current implementation uses timezone.utc
                now = datetime.now(timezone.utc)
                # Ensure the stored timestamp is treated as UTC
                started_dt = room.started_at.replace(tzinfo=timezone.utc) if room.started_at.tzinfo is None else room.started_at
                elapsed = (now - started_dt).total_seconds()
                current_offset = max(0, elapsed)
            except Exception as e:
                print(f"Error calculating live offset: {e}")
                current_offset = room.offset

        # Initial state to send
        initial_state = {
            "type": "room_state",
            "stream_status": room.stream_status,
            "is_playing": room.is_playing,
            "currentTime": current_offset,
            "startedAt": room.started_at.isoformat() if room.started_at else None,
            "updatedAt": room.updated_at.isoformat() if room.updated_at else None,
            "title": room.title,
            "stream_url": room.stream_url,
            "media_type": room.media_type,
            "video_url": room.video_url,
            "youtube_video_id": room.youtube_video_id,
            "video_id": room.video.video_id if room.video else None,
            "video_title": room.video.title if room.video else room.title,
            "thumbnail_url": room.video.thumbnail_url if room.video else None,
            "duration": room.video.duration if room.video else None,
            "participant_count": len(active_connections.get(room_id, {})) + 1
        }


    # Enforce participant limits based on host's plan
    host_plan = "free"
    if room.host_id:
        try:
            with SessionLocal() as db_cap:
                host_user = db_cap.query(models.User).filter(models.User.id == uuid.UUID(room.host_id)).first()
                if host_user:
                    from app.subscriptions.plans import get_effective_plan
                    host_plan = get_effective_plan(host_user)
        except Exception:
            pass

    from app.subscriptions.plans import get_plan_config
    plan_config = get_plan_config(host_plan)
    max_participants = plan_config.get("max_participants", 6)

    # Check active connections count
    current_active = active_connections.get(room_id, {})
    if clean_user_id not in current_active and len(current_active) >= max_participants:
        # Always allow the host to join to prevent lockout
        if not is_host_initial:
            await websocket.send_json({
                "type": "error",
                "code": "ROOM_FULL",
                "message": f"This room has reached its maximum capacity of {max_participants} participants allowed by the host's plan."
            })
            await websocket.close()
            return

    if room_id not in active_connections:
        active_connections[room_id] = {}
        
    active_connections[room_id][user_id] = websocket
    
    # Send initial state
    await websocket.send_text(json.dumps(initial_state))
    
    # Broadcast participant join

    with SessionLocal() as db:
        user_uuid_str = user_id
        db_user = None
        try:
            val_uuid = uuid.UUID(user_uuid_str)
            db_user = db.query(models.User).filter(models.User.id == val_uuid).first()
        except: pass
            
        await broadcast_to_room(room_id, {
            "type": "participant_join",
            "data": {
                "id": user_id,
                "name": (db_user.display_name or db_user.name) if db_user else f"Guest_{user_id[:5]}",
                "profile_picture": getattr(db_user, 'profile_picture', None) if db_user else None,
                "isHost": is_host_initial,
                "participant_count": len(active_connections.get(room_id, {}))
            }
        }, exclude_user=user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            # Fresh session for each update to guarantee persistence
            with SessionLocal() as db:
                # Re-fetch room for state check
                room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
                if not room: break

                # Normalize comparison
                db_host_id = str(room.host_id).replace("-", "").lower() if room.host_id else "none"
                clean_user_id = user_id.replace("-", "").lower()
                
                is_host = (db_host_id == clean_user_id)
                


                if is_host and msg_type in ["play", "pause", "seek", "sync_state"]:
                    msg_time_raw = message.get("timestamp")
                    if msg_time_raw is None:
                        msg_time = float(room.offset) if room.offset is not None else 0.0
                    else:
                        try:
                            msg_time = float(msg_time_raw)
                        except (ValueError, TypeError):
                            msg_time = float(room.offset) if room.offset is not None else 0.0

                    
                    if msg_type == "play":

                        room.is_playing = True
                        room.stream_status = "live"
                        room.offset = msg_time
                        room.started_at = datetime.now(timezone.utc) - timedelta(seconds=msg_time)

                    elif msg_type == "pause":
                        room.is_playing = False
                        room.stream_status = "paused"
                        room.offset = msg_time
                        room.started_at = None
                    elif msg_type == "seek":
                        # Basic rate limit: 1 seek per ~0.8s
                        now_ts = time.time()
                        if room_id in last_seek_time and now_ts - last_seek_time[room_id] < 0.8:

                            continue
                        last_seek_time[room_id] = now_ts
                        room.offset = msg_time
                        if room.is_playing:
                             room.started_at = datetime.now(timezone.utc) - timedelta(seconds=msg_time)
                    elif msg_type == "sync_state":
                        room.is_playing = message.get("isPlaying", room.is_playing)
                        room.offset = msg_time
                        if room.is_playing:
                             room.started_at = datetime.now(timezone.utc) - timedelta(seconds=msg_time)
                        else:
                             room.started_at = None
                    
                    db.commit()

                    
                    # Distinguish 'seek' from standard 'room_state'
                    if msg_type == "seek":
                        await broadcast_to_room(room_id, {
                            "type": "seek",
                            "currentTime": room.offset,
                            "is_playing": room.is_playing,
                            "stream_status": room.stream_status,
                            "startedAt": room.started_at.isoformat() if room.started_at else None,
                            "updatedAt": room.updated_at.isoformat() if room.updated_at else None,
                            "participant_count": len(active_connections.get(room_id, {}))
                        })
                    else:
                        await broadcast_to_room(room_id, {
                            "type": "room_state",
                            "stream_status": room.stream_status,
                            "is_playing": room.is_playing,
                            "currentTime": room.offset,
                            "startedAt": room.started_at.isoformat() if room.started_at else None,
                            "updatedAt": room.updated_at.isoformat() if room.updated_at else None,
                            "participant_count": len(active_connections.get(room_id, {}))
                        })

                
                elif msg_type == "sync_report" and is_host:
                    await broadcast_to_room(room_id, {
                        "type": "sync",
                        "data": {
                            "currentTime": message.get("timestamp"),
                            "participant_count": len(active_connections.get(room_id, {}))
                        }
                    }, exclude_user=user_id)

                elif msg_type == "chat":
                    # --- Tier 2 chat filter (server-side; never trust the client) ---
                    from app.moderation.config import (
                        moderate_message,
                        CHAT_WARN_THRESHOLD,
                        CHAT_MUTE_SECONDS,
                    )
                    chat_data = message.get("data") or {}
                    chat_text = chat_data.get("message") if isinstance(chat_data, dict) else str(chat_data)

                    # 1) If currently muted, honor the timeout. Expiry -> unmute + reset violations.
                    room_mutes = chat_muted.get(room_id)
                    muted_until = room_mutes.get(user_id) if room_mutes else None
                    if muted_until is not None:
                        if time.time() >= muted_until:
                            room_mutes.pop(user_id, None)
                            chat_violations.get(room_id, {}).pop(user_id, None)
                        else:
                            await websocket.send_json({
                                "type": "chat_warning",
                                "data": {
                                    "message": "You are temporarily muted and cannot send chat messages yet.",
                                    "muted": True,
                                },
                            })
                            continue

                    allowed, reason = moderate_message(chat_text or "")

                    if not allowed:
                        chat_violations.setdefault(room_id, {})
                        chat_violations[room_id][user_id] = chat_violations[room_id].get(user_id, 0) + 1
                        is_muted = chat_violations[room_id][user_id] >= CHAT_WARN_THRESHOLD
                        if is_muted:
                            chat_muted.setdefault(room_id, {})[user_id] = time.time() + CHAT_MUTE_SECONDS
                        await websocket.send_json({
                            "type": "chat_warning",
                            "data": {
                                "message": reason + (" You have been muted for repeated violations." if is_muted else ""),
                                "muted": is_muted,
                            },
                        })
                        continue

                    # Broadcast chat message to all in room
                    await broadcast_to_room(room_id, {
                        "type": "chat",
                        "data": chat_data
                    })
                    
                elif msg_type == "request_sync":
                    await broadcast_to_room(room_id, {
                        "type": "request_sync",
                        "data": {}
                    })
                    
                elif msg_type == "change_video" and is_host:
                    payload = message.get("data") or {}
                    requested_media_type = payload.get("media_type", "youtube")
                    new_video_id = payload.get("video_id")  # library video UUID string

                    broadcast_extra = {}

                    # Library (HLS) video switch — resolve stream_url from DB
                    if requested_media_type == "hls" or new_video_id:
                        video = db.query(models.Video).filter(models.Video.video_id == new_video_id).first() if new_video_id else None
                        if not video:
                            await websocket.send_json({
                                "type": "error",
                                "code": "VIDEO_NOT_FOUND",
                                "message": "Video no longer exists"
                            })
                            continue

                        # Collection-bound rooms can only switch within their playlist
                        if room.collection_id:
                            is_member = db.query(models.CollectionVideo).filter(
                                models.CollectionVideo.collection_id == room.collection_id,
                                models.CollectionVideo.video_id == video.id
                            ).first()
                            if not is_member:
                                await websocket.send_json({
                                    "type": "error",
                                    "code": "VIDEO_NOT_IN_COLLECTION",
                                    "message": "This video is not part of the room's collection"
                                })
                                continue

                        room.video_id = video.id
                        room.stream_url = video.stream_url
                        room.media_type = "hls"
                        room.video_url = None
                        room.youtube_video_id = None

                        broadcast_extra = {
                            "video_id": video.video_id,
                            "video_title": video.title,
                            "thumbnail_url": video.thumbnail_url,
                            "duration": video.duration,
                        }
                    else:
                        # YouTube switch (existing behavior)
                        room.youtube_video_id = payload.get("youtube_video_id")
                        room.video_url = payload.get("video_url")
                        room.media_type = "youtube"
                        room.video_id = None

                        broadcast_extra = {
                            "video_id": room.youtube_video_id,
                            "video_title": room.title,
                            "thumbnail_url": None,
                            "duration": None,
                        }

                    # Reset playback state for new media
                    room.is_playing = False
                    room.stream_status = "waiting"
                    room.offset = 0.0
                    room.started_at = None

                    db.commit()

                    # Broadcast the new state to all clients
                    await broadcast_to_room(room_id, {
                        "type": "room_state",
                        "stream_status": room.stream_status,
                        "is_playing": room.is_playing,
                        "currentTime": room.offset,
                        "startedAt": None,
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                        "title": room.title,
                        "stream_url": room.stream_url,
                        "media_type": room.media_type,
                        "video_url": room.video_url,
                        "youtube_video_id": room.youtube_video_id,
                        "video_id": broadcast_extra.get("video_id"),
                        "video_title": broadcast_extra.get("video_title"),
                        "thumbnail_url": broadcast_extra.get("thumbnail_url"),
                        "duration": broadcast_extra.get("duration"),
                        "participant_count": len(active_connections.get(room_id, {}))
                    })

                elif msg_type == "end_room" and is_host:

                    db.delete(room)
                    db.commit()
                    await broadcast_to_room(room_id, {
                        "type": "ROOM_ENDED"
                    })
                    if room_id in active_connections:
                        del active_connections[room_id]
                    break

    except WebSocketDisconnect:
        if room_id in active_connections and user_id in active_connections[room_id]:
            del active_connections[room_id][user_id]
            
            with SessionLocal() as db:
                room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
                if room:
                    db_host_id = str(room.host_id).replace("-", "").lower() if room.host_id else "none"
                    clean_user_id = user_id.replace("-", "").lower()
                    
                    if db_host_id == clean_user_id:
                        # DISBAND IMMEDIATELY: No grace period.
                        asyncio.create_task(disband_room(room_id))
                    else:
                        # Broadcast leave
                        await broadcast_to_room(room_id, {
                            "type": "participant_leave",
                            "data": {
                                "id": user_id,
                                "participant_count": len(active_connections.get(room_id, {}))
                            }
                        })
    except Exception as exc:
        print(f"CRITICAL WS ERROR for Room {room_id}, User {user_id}: {exc}")
        traceback.print_exc()
        if room_id in active_connections and user_id in active_connections[room_id]:
            del active_connections[room_id][user_id]

# Helper to disband room immediately
async def disband_room(room_id: str):
    with SessionLocal() as db:
        room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
        if room:
            print(f"Host disconnected or disbanded. Cleaning up Room {room_id}.")
            await broadcast_to_room(room_id, {"type": "ROOM_ENDED"})
            db.delete(room)
            db.commit()
            if room_id in active_connections:
                del active_connections[room_id]

async def broadcast_to_room(room_id: str, message: dict, exclude_user: str = None):
    if room_id not in active_connections:
        return
        
    message_str = json.dumps(message)
    disconnected = []
    
    for uid, connection in active_connections[room_id].items():
        if exclude_user and uid == exclude_user:
            continue
        try:
            await connection.send_text(message_str)
        except Exception:
            disconnected.append(uid)
            
    for uid in disconnected:
        if uid in active_connections[room_id]:
            del active_connections[room_id][uid]
