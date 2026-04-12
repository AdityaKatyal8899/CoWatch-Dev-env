from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    display_name: Optional[str] = None
    age: Optional[int] = None
    genres: List[str] = []
    theme: str = "default-dark"
    profile_picture: Optional[str] = None
    storage_used: int = 0
    storage_limit: int = 5368709120

class UserCreate(UserBase):
    provider: str = "google"
    provider_id: str

class UserSchema(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    s3_key: Optional[str] = None
    file_size: int
    duration: Optional[float] = None
    thumbnail_url: Optional[str] = None

class VideoSchema(VideoBase):
    id: int
    video_id: str
    user_id: UUID
    stream_url: str
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class RoomBase(BaseModel):
    room_id: str
    title: Optional[str] = None
    stream_url: Optional[str] = None
    is_playing: bool = False
    offset: float = 0.0
    started_at: Optional[datetime] = None

class RoomSchema(RoomBase):
    id: int
    host_id: UUID
    video_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionSchema(CollectionBase):
    id: int
    user_id: UUID
    created_at: datetime
    videos: List[VideoSchema] = []

    class Config:
        from_attributes = True

class OnboardingRequest(BaseModel):
    display_name: str
    age: Optional[int] = None
    genres: List[str] = []
    theme: str = "default-dark"

class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = None
    genres: Optional[List[str]] = None
    theme: Optional[str] = None
