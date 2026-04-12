from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID

class ParticipantSchema(BaseModel):
    user_id: str
    name: str
    is_host: bool

class RoomSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    room_id: str
    host_id: Optional[Union[str, UUID]] = None
    video_id: Optional[int] = None
    stream_url: str
    title: str
    stream_status: str = "waiting"
    is_playing: bool = False
    offset: float = 0.0
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    scheduled_time: Optional[datetime] = None
    countdown_start: Optional[datetime] = None
    invite_link: Optional[str] = None
    participants: List[ParticipantSchema] = []
    server_time: Optional[float] = None
    description: Optional[str] = None
    host_name: Optional[str] = None
    thumbnail_url: Optional[str] = None

class CreateRoomRequest(BaseModel):
    video_id: Optional[str] = None
    title: Optional[str] = None
    stream_url: Optional[str] = None
    host_id: Optional[str] = None

class RoomCreatedResponse(BaseModel):
    room_id: str
    invite_link: str
    title: str

class JoinRoomRequest(BaseModel):
    room_id: str
    user_id: str
    name: str

class JoinRoomResponse(BaseModel):
    success: bool
    room: Optional[RoomSchema] = None
    message: Optional[str] = None
