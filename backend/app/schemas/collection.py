from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    user_id: int

class CollectionSchema(CollectionBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CollectionVideoBase(BaseModel):
    collection_id: int
    video_id: int

class CollectionVideoSchema(CollectionVideoBase):
    id: int

    class Config:
        from_attributes = True
