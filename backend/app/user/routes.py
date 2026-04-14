from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user
from app.services.s3_service import generate_upload_url
from pydantic import BaseModel
from typing import Any

router = APIRouter()

class UploadUrlRequest(BaseModel):
    user_id: str
    file_type: str

class UserStats(BaseModel):
    storageUsed: int
    storageLimit: int
    totalUploads: int
    activeStreams: int

@router.get("/stats", response_model=UserStats)
async def get_user_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Calculate user statistics in real-time from the database.
    """
    # 1. Total uploads count
    total_uploads = db.query(models.Video).filter(models.Video.user_id == current_user.id).count()
    
    # 2. Total storage used (sum of file sizes)
    storage_sum = db.query(func.sum(models.Video.file_size)).filter(models.Video.user_id == current_user.id).scalar() or 0
    
    # 3. Active streams count (rooms where user is host)
    active_streams = db.query(models.Room).filter(models.Room.host_id == str(current_user.id)).count()
    
    # Update user's storage_used in DB record for consistency (syncing)
    if current_user.storage_used != storage_sum:
        current_user.storage_used = storage_sum
        db.commit()

    return {
        "storageUsed": storage_sum,
        "storageLimit": current_user.storage_limit,
        "totalUploads": total_uploads,
        "activeStreams": active_streams
    }

from app.schemas.pydantic_model import OnboardingRequest, UserSchema, ProfileUpdateRequest

def validate_theme_selection(theme: str) -> bool:
    allowed_presets = ["default-dark", "neo-purple", "midnight-blue", "cyber-green", "warm-minimal"]
    if theme in allowed_presets:
        return True
    if theme.startswith("custom:"):
        parts = theme.split(":")
        if len(parts) == 4:
            bg, primary, text = parts[1], parts[2], parts[3]
            allowed_bg = ["#0B0B0F", "#0F172A", "#111827", "#1A1A2E", "#0A0F1F", "#18181B"]
            allowed_primary = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4"]
            allowed_text = ["#FFFFFF", "#E5E7EB", "#D1D5DB"]
            return bg in allowed_bg and primary in allowed_primary and text in allowed_text
    return False

@router.post("/onboarding", response_model=UserSchema)
async def onboard_user(
    req: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Finalize user registration by collecting display name, age, genres, and theme preferences.
    """
    if not req.display_name or len(req.display_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Display name must be at least 2 characters")

    if not validate_theme_selection(req.theme):
        raise HTTPException(status_code=400, detail="Invalid theme selection or custom colors")

    current_user.display_name = req.display_name.strip()
    current_user.age = req.age
    current_user.genres = req.genres
    current_user.theme = req.theme

    db.commit()
    db.refresh(current_user)
    return current_user

@router.patch("/profile", response_model=UserSchema)
async def update_profile(
    req: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update user profile fields (display_name, age, genres, theme).
    """
    if req.display_name is not None:
        if len(req.display_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Display name must be at least 2 characters")
        current_user.display_name = req.display_name.strip()

    if req.theme is not None:
        if not validate_theme_selection(req.theme):
            raise HTTPException(status_code=400, detail="Invalid theme selection")
        current_user.theme = req.theme

    if req.age is not None:
        current_user.age = req.age
    
    if req.genres is not None:
        current_user.genres = req.genres

    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/profile/upload-url")
async def get_profile_upload_url(req: UploadUrlRequest):
# ... rest of the file ...
    """
    Generate a presigned S3 URL for profile picture upload.
    """
    try:
        result = generate_upload_url(req.user_id, req.file_type)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        pass

        raise HTTPException(status_code=500, detail="Could not generate upload URL")
