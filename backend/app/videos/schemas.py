from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None

class VideoCreate(VideoBase):
    pass

class VideoResponse(VideoBase):
    video_id: str
    stream_url: str
    processing_status: str
    file_size: int
    duration: Optional[float] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BulkDeleteVideos(BaseModel):
    video_ids: list[str]
