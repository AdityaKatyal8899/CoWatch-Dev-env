from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.schemas.token import TokenRequest, TokenResponse
from app.services.livekit_service import LiveKitService
from app.livekit.config import settings
from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user_optional
from app.subscriptions.plans import DEFAULT_PLAN, get_effective_plan, plan_allows

router = APIRouter(tags=["LiveKit Token"])

def get_livekit_service() -> LiveKitService:
    """Dependency provider for LiveKitService instance."""
    return LiveKitService()

@router.post("/token", response_model=TokenResponse)
async def generate_token(
    request: TokenRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    livekit_service: LiveKitService = Depends(get_livekit_service)
) -> TokenResponse:
    """
    Generate a signed JWT token and configuration for a participant to join a LiveKit room.
    
    Performs security audits:
    1. Verifies that the CoWatch room exists in the database.
    2. Gates voice chat on the room host's plan (Free hosts cannot enable voice).
    3. Identifies the user: registered users use their UUID; guests use their provided user_id or a guest fallback.
    4. Detects if the requesting user is the host of the room to propagate admin rights.
    """
    try:
        # 1. Verify that the room exists in CoWatch DB
        room = db.query(models.Room).filter(models.Room.room_id == request.room).first()
        if not room:
            raise HTTPException(
                status_code=404,
                detail=f"Room '{request.room}' not found in CoWatch."
            )

        # 2. Voice chat is gated by the ROOM HOST's plan. Guests inherit the host's tier.
        host_plan = DEFAULT_PLAN
        if room.host_id:
            try:
                host_user = db.query(models.User).filter(
                    models.User.id == uuid.UUID(room.host_id)
                ).first()
                if host_user:
                    host_plan = get_effective_plan(host_user)
            except (ValueError, TypeError):
                # Guest host (non-UUID host_id) -> no plan -> Free tier
                pass

        if not plan_allows(host_plan, "voice_chat"):
            raise HTTPException(
                status_code=403,
                detail="Voice chat is available on Pro and above plans",
            )

        # 3. Determine identity (unique ID) and name (display name)
        is_host = False
        if current_user:
            # Authenticated registered user
            identity = str(current_user.id)
            name = current_user.display_name or current_user.name
            
            # Check host permission
            if room.host_id:
                is_host = str(room.host_id).replace("-", "").lower() == identity.replace("-", "").lower()
        else:
            # Unauthenticated guest user
            if request.user_id:
                identity = request.user_id
            else:
                # Fallback to generating a unique guest identity
                identity = f"guest_{uuid.uuid4().hex[:8]}"
            
            name = request.username
            
            # Check host permission for guest host
            if room.host_id:
                is_host = str(room.host_id).replace("-", "").lower() == identity.replace("-", "").lower()

        # 4. Generate token with LiveKit grants
        token = livekit_service.generate_room_token(
            identity=identity,
            name=name,
            room_name=room.room_id, # Use existing room_id directly as LiveKit room name
            is_host=is_host
        )

        # 5. Return JWT token alongside LiveKit Server URL
        return TokenResponse(
            token=token,
            url=settings.LIVEKIT_URL
        )
    except HTTPException:
        raise
    except Exception as e:
        # Capture and report internal service errors
        raise HTTPException(
            status_code=500,
            detail=f"Internal token service failure: {str(e)}"
        )
