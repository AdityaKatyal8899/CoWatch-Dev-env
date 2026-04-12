from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from ..database.config import get_db, SessionLocal
from ..database import models
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict
import uuid

router = APIRouter()

# In-memory connections (these cannot be in DB)
active_connections: Dict[str, Dict[str, WebSocket]] = {}
last_seek_time: Dict[str, float] = {}  # Tracks last seek per room

@router.websocket("/ws/rooms/{room_id}/{user_id}")
async def room_websocket(websocket: WebSocket, room_id: str, user_id: str):
    await websocket.accept()
    
    # Use context manager for initial fetch
    with SessionLocal() as db:
        room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
        if not room:
            await websocket.close(code=4000, reason="Room does not exist")
            return
        
        # Determine host status early
        db_host_id = str(room.host_id).replace("-", "").lower() if room.host_id else "none"
        clean_user_id = user_id.replace("host_", "").replace("-", "").lower()
        is_host_initial = (db_host_id == clean_user_id)

        # Initial state to send
        initial_state = {
            "type": "room_state",
            "stream_status": room.stream_status,
            "is_playing": room.is_playing,
            "currentTime": room.offset,
            "startedAt": room.started_at.isoformat() if room.started_at else None,
            "updatedAt": room.updated_at.isoformat() if room.updated_at else None,
            "title": room.title,
            "stream_url": room.stream_url,
            "participant_count": len(active_connections.get(room_id, {})) + 1 # Include current connection
        }


    if room_id not in active_connections:
        active_connections[room_id] = {}
        
    active_connections[room_id][user_id] = websocket
    
    # Send initial state
    await websocket.send_text(json.dumps(initial_state))
    
    # Broadcast participant join

    with SessionLocal() as db:
        user_uuid_str = user_id.replace("host_", "")
        db_user = None
        try:
            val_uuid = uuid.UUID(user_uuid_str)
            db_user = db.query(models.User).filter(models.User.id == val_uuid).first()
        except: pass
            
        await broadcast_to_room(room_id, {
            "type": "participant_join",
            "data": {
                "id": user_id,
                "name": db_user.name if db_user else f"Guest_{user_id[:5]}",
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
                clean_user_id = user_id.replace("host_", "").replace("-", "").lower()
                
                is_host = (db_host_id == clean_user_id)
                


                if is_host and msg_type in ["play", "pause", "seek"]:
                    msg_time = float(message.get("timestamp", room.offset))

                    
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
                    # Broadcast chat message to all in room
                    await broadcast_to_room(room_id, {
                        "type": "chat",
                        "data": message.get("data")
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
                    clean_user_id = user_id.replace("host_", "").replace("-", "").lower()
                    
                    if db_host_id == clean_user_id:

                        db.delete(room)
                        db.commit()
                        await broadcast_to_room(room_id, {
                            "type": "ROOM_ENDED"
                        })
                        if room_id in active_connections:
                            del active_connections[room_id]
                    else:
                        # Broadcast leave
                        await broadcast_to_room(room_id, {
                            "type": "participant_leave",
                            "data": {
                                "id": user_id.replace("host_", ""),
                                "participant_count": len(active_connections.get(room_id, {}))
                            }
                        })
    except Exception as exc:
        pass

        pass

        if room_id in active_connections and user_id in active_connections[room_id]:
            del active_connections[room_id][user_id]

# Removed check_scheduled_streams background task as scheduling logic has been decommissioned.

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
