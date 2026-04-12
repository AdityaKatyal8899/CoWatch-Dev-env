from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    profile_picture: Optional[str] = None
    storage_used: int = 0
    storage_limit: int = 2147483648

class UserCreate(UserBase):
    provider: str = "google"
    provider_id: str

class UserSchema(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
