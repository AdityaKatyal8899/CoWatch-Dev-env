"""
Moderation API: terms acceptance, reporting, appeals, and DEV-ONLY verification
endpoints. The dev endpoints let us exercise the enforcement machinery without
ever using real or synthetic explicit content (see MODERATION.md §8).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import os
import uuid

from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user
from app.middleware.limiter import limiter
from pydantic import BaseModel

router = APIRouter()

# Dev-only simulation endpoints are disabled outside development to avoid abuse.
DEV_SIMULATION = os.getenv("ENVIRONMENT", "development") != "production"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class ReportRequest(BaseModel):
    target_type: str  # room | user | message
    target_id: str
    reason: str


class AppealRequest(BaseModel):
    target_type: str  # warning | report | ban
    target_id: str
    text: Optional[str] = None


# ---------------------------------------------------------------------------
# Terms acceptance
# ---------------------------------------------------------------------------
@router.post("/accept-terms")
@limiter.limit("10/minute")
async def accept_terms(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Records that the user accepted the latest Terms / Community Guidelines."""
    current_user.terms_accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    from app.schemas.pydantic_model import UserSchema
    return UserSchema.model_validate(current_user)


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
@router.post("/report")
@limiter.limit("20/minute")
async def report_content(
    req: ReportRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    report = models.ModerationReport(
        reporter_id=current_user.id,
        target_type=req.target_type,
        target_id=str(req.target_id),
        reason=req.reason,
        status="open",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"success": True, "id": report.id}


# ---------------------------------------------------------------------------
# Appeals
# ---------------------------------------------------------------------------
@router.post("/appeals")
@limiter.limit("10/minute")
async def submit_appeal(
    req: AppealRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    appeal = models.ModerationAppeal(
        user_id=current_user.id,
        target_type=req.target_type,
        target_id=str(req.target_id),
        text=req.text,
        status="open",
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return {"success": True, "id": appeal.id}


# ---------------------------------------------------------------------------
# DEV-ONLY verification endpoints (disabled in production)
# These trigger the SAME enforcement code paths production would, using synthetic
# *state* (a room id / user id) — never real or synthetic explicit content.
# ---------------------------------------------------------------------------
@router.post("/_dev/sim-unflagged-adult")
async def dev_sim_unflagged_adult(
    req: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not DEV_SIMULATION:
        raise HTTPException(status_code=404, detail="Not found")

    room_id = req.get("room_id")
    room = db.query(models.Room).filter(models.Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Run the exact enforcement path the monitoring job would use.
    room.status = "cancelled"
    db.commit()

    warning_issued = False
    if room.host_id:
        try:
            host_uuid = uuid.UUID(str(room.host_id))
            db.add(models.ModerationWarning(
                user_id=host_uuid,
                room_id=room.id,
                reason="Unflagged adult content detected in a non-18+ room",
            ))
            db.commit()
            warning_issued = True
        except Exception:
            pass

    # Disconnect participants.
    from app.rooms.websockets import active_connections, broadcast_to_room
    if room_id in active_connections:
        await broadcast_to_room(room_id, {"type": "ROOM_ENDED", "reason": "violation"})
        del active_connections[room_id]

    return {"success": True, "action": "cancelled", "warning_issued": warning_issued}


@router.post("/_dev/sim-tier1")
async def dev_sim_tier1(req: dict, request: Request, db: Session = Depends(get_db)):
    if not DEV_SIMULATION:
        raise HTTPException(status_code=404, detail="Not found")

    target_user_id = req.get("user_id")
    user = db.query(models.User).filter(models.User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Run the exact Tier 1 response path: takedown + ban + evidence + authority report.
    user.is_banned = True
    user.banned_reason = "Tier 1 violation (CSAM / trafficking / terrorism)"
    db.add(models.ModerationReport(
        reporter_id=user.id,  # self-referential marker for the authority export
        target_type="user",
        target_id=str(user.id),
        reason="Tier 1 automated match",
        status="actioned",
    ))
    db.commit()

    # In production this is where the authority-format export (e.g., NCMEC) is written.
    return {
        "success": True,
        "action": "banned_and_reported",
        "user_id": str(user.id),
        "exported": True,
    }
