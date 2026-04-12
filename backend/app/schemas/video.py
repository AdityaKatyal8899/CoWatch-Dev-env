from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    s3_key: str
    file_size: int

class VideoCreate(VideoBase):
    user_id: int

class VideoSchema(VideoBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
