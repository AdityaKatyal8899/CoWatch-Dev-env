import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user
from app.subscriptions.plans import get_plan_config, is_owner
from app.middleware.limiter import limiter

router = APIRouter(prefix="/coupons", tags=["Coupons"])

GRANTABLE_PLANS = {"pro", "pro_plus", "vibers"}


def _generate_code() -> str:
    """Random, hard-to-guess code like 'A7K2-QW9X'."""
    alphabet = string.ascii_uppercase + string.digits
    return (
        f"{''.join(secrets.choice(alphabet) for _ in range(4))}"
        f"-{''.join(secrets.choice(alphabet) for _ in range(4))}"
    )


class RedeemRequest(BaseModel):
    code: str


class RedeemResponse(BaseModel):
    success: bool
    plan: str
    plan_expires_at: Optional[datetime] = None
    message: str


class CreateCouponRequest(BaseModel):
    plan: str
    duration_days: Optional[int] = None  # None = lifetime
    max_redemptions: int = 1
    code: Optional[str] = None  # optional custom code, else generated


class CouponResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    plan: str
    duration_days: Optional[int] = None
    max_redemptions: int = 1
    times_redeemed: int = 0
    active: bool = True
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@router.post("/redeem", response_model=RedeemResponse)
@limiter.limit("10/minute")
async def redeem_coupon(
    request: Request,
    response: Response,
    payload: RedeemRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Apply a coupon code to the authenticated user's account."""
    code = payload.code.strip().upper()
    coupon = db.query(models.Coupon).filter(models.Coupon.code == code).first()

    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if not coupon.active:
        raise HTTPException(status_code=400, detail="This coupon is no longer active")

    now = datetime.now(timezone.utc)
    if coupon.expires_at is not None:
        exp = coupon.expires_at if coupon.expires_at.tzinfo else coupon.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            raise HTTPException(status_code=400, detail="This coupon has expired")

    if coupon.times_redeemed >= coupon.max_redemptions:
        raise HTTPException(status_code=400, detail="This coupon has already been fully redeemed")

    already = db.query(models.CouponRedemption).filter(
        models.CouponRedemption.coupon_id == coupon.id,
        models.CouponRedemption.user_id == current_user.id,
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="You have already used this coupon")

    # Apply the grant: set plan, expiry, and keep storage_limit in sync for display
    current_user.plan = coupon.plan
    current_user.plan_expires_at = (
        now + timedelta(days=coupon.duration_days) if coupon.duration_days else None
    )
    current_user.storage_limit = get_plan_config(coupon.plan)["storage_limit"]

    coupon.times_redeemed += 1
    db.add(models.CouponRedemption(coupon_id=coupon.id, user_id=current_user.id))
    db.commit()

    return RedeemResponse(
        success=True,
        plan=current_user.plan,
        plan_expires_at=current_user.plan_expires_at,
        message=f"Coupon applied! You are now on the {current_user.plan} plan.",
    )


@router.post("", response_model=CouponResponse, status_code=201)
async def create_coupon(
    payload: CreateCouponRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a coupon (owner only)."""
    if not is_owner(current_user):
        raise HTTPException(status_code=403, detail="Only the owner can create coupons")

    plan = payload.plan.strip().lower()
    if plan not in GRANTABLE_PLANS:
        raise HTTPException(status_code=400, detail="Coupon plan must be one of: pro, pro_plus, vibers")
    if payload.duration_days is not None and payload.duration_days < 0:
        raise HTTPException(status_code=400, detail="duration_days cannot be negative")
    if payload.max_redemptions < 1:
        raise HTTPException(status_code=400, detail="max_redemptions must be at least 1")

    code = (payload.code or _generate_code()).strip().upper()
    if db.query(models.Coupon).filter(models.Coupon.code == code).first():
        raise HTTPException(status_code=400, detail="That coupon code already exists")

    coupon = models.Coupon(
        code=code,
        plan=plan,
        duration_days=payload.duration_days,
        max_redemptions=payload.max_redemptions,
        created_by=str(current_user.id),
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.get("", response_model=List[CouponResponse])
async def list_coupons(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all coupons (owner only)."""
    if not is_owner(current_user):
        raise HTTPException(status_code=403, detail="Only the owner can view coupons")
    return db.query(models.Coupon).order_by(models.Coupon.created_at.desc()).all()


@router.delete("/{code}")
async def deactivate_coupon(
    code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Deactivate a coupon (owner only)."""
    if not is_owner(current_user):
        raise HTTPException(status_code=403, detail="Only the owner can manage coupons")
    coupon = db.query(models.Coupon).filter(models.Coupon.code == code.upper()).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon.active = False
    db.commit()
    return {"success": True, "message": "Coupon deactivated"}
