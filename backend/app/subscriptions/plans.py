"""
Subscription plan definitions and Object-Oriented Domain Model.

Encapsulates plan specifications, quotas, pricing, processing hours,
and authorization logic into distinct domain classes (FreePlan, ProPlan,
ProPlusPlan, VibersPlan) and provides a PlanRegistry factory for resolving user entitlements.
"""

import os
import subprocess
from abc import ABC
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException

# Plan Code Constants
PLAN_FREE = "free"
PLAN_PRO = "pro"
PLAN_PRO_PLUS = "pro_plus"
PLAN_VIBERS = "vibers"

DEFAULT_PLAN = PLAN_FREE

# Theme locked for Free users. Paid plans unlock customization.
DEFAULT_THEME = "default-dark"

# Max upload quality vertical resolution pixels.
QUALITY_720 = 720
QUALITY_1080 = 1080
QUALITY_4K = 2160

GB = 1024 ** 3


def _owner_emails() -> set:
    """Comma-separated OWNER_EMAILS env var. The owner always gets lifetime Vibers tier for free."""
    raw = os.environ.get("OWNER_EMAILS", "").strip()
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_owner(user) -> bool:
    email = getattr(user, "email", None) or ""
    return email.strip().lower() in _owner_emails()


def get_user_billing_period_start(user) -> datetime:
    """
    Computes the start datetime (UTC) of the current usage/billing window for a user.
    - If user is Free: returns epoch datetime (lifetime scope).
    - If user has active plan_expires_at: calculates the start of the current 30-day window.
    - If owner / lifetime Vibers: returns start of current calendar month.
    """
    now = datetime.now(timezone.utc)
    expires_at = getattr(user, "plan_expires_at", None)
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now:
            days_to_expiry = (expires_at - now).total_seconds() / 86400.0
            if days_to_expiry <= 31:
                return expires_at - timedelta(days=30)
            else:
                # Annual subscription: slice into 30-day monthly windows from cycle start
                full_start = expires_at - timedelta(days=365)
                elapsed_days = (now - full_start).total_seconds() / 86400.0
                cycle_index = max(0, int(elapsed_days // 30))
                return full_start + timedelta(days=cycle_index * 30)

    # Owner or fallback paid without expiration: start of current calendar month
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def probe_video_duration(input_path: str) -> float:
    """Extract exact video duration in seconds via ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            input_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(res.stdout.strip())
    except Exception as e:
        return 0.0


# ==============================================================================
# Base Domain Plan Interface
# ==============================================================================

class BasePlan(ABC):
    """
    Abstract Base Class for all subscription plans.
    Encapsulates quotas, capabilities, pricing, processing hours, and validation rules.
    """
    code: str
    name: str
    monthly_price: float
    annual_price: float
    storage_limit_bytes: int
    max_quality_p: int
    upload_limit: int                    # 3 for Free, 5 for Pro, 100 for Pro+, 200 for Vibers
    upload_period: str                   # 'lifetime' (Free) vs 'billing_period' (Paid)
    monthly_processing_hours: Optional[float]  # None for Free, 10.0 for Pro, 50.0 for Pro+/Vibers
    max_participants: int
    yt_rooms_per_month: Optional[int]    # None = unlimited
    allows_collections: bool
    allows_voice_chat: bool
    allows_custom_themes: bool
    allows_custom_gradients: bool = False

    @property
    def monthly_uploads_limit(self) -> Optional[int]:
        """Backwards compatibility alias for upload_limit."""
        return self.upload_limit

    def get_billing_price(self, billing_cycle: str) -> float:
        """Return the subscription price for the requested billing interval."""
        cycle = (billing_cycle or "").strip().lower()
        if cycle == "monthly":
            return self.monthly_price
        elif cycle == "annual":
            return self.annual_price
        raise ValueError(f"Invalid billing cycle '{billing_cycle}'. Must be 'monthly' or 'annual'.")

    def validate_storage_quota(self, current_storage_used: int, new_bytes: int = 0) -> None:
        """Enforce storage capacity threshold. Raises HTTP 413 if quota exceeded."""
        if current_storage_used + new_bytes > self.storage_limit_bytes:
            raise HTTPException(
                status_code=413,
                detail="Storage limit exceeded. Upgrade your plan to store more videos."
            )

    def validate_upload_count(self, current_uploads_count: int) -> None:
        """Enforce upload count threshold based on plan lifecycle (lifetime vs billing period)."""
        if self.upload_period == "lifetime":
            if current_uploads_count >= self.upload_limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Free tier accounts include {self.upload_limit} lifetime video uploads. You have consumed all {self.upload_limit} uploads. Upgrade to Pro for monthly allowances!"
                )
        else:
            if current_uploads_count >= self.upload_limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"{self.name} tier accounts are capped at {self.upload_limit} video uploads per billing period. Upgrade for higher limits!"
                )

    def validate_processing_hours(self, current_hours_used: float, new_duration_hours: float = 0.0) -> None:
        """Enforce video transcoding duration entitlement. Raises HTTP 403 if quota exceeded."""
        if self.monthly_processing_hours is not None:
            if current_hours_used + new_duration_hours > self.monthly_processing_hours:
                raise HTTPException(
                    status_code=403,
                    detail=f"{self.name} tier accounts are capped at {self.monthly_processing_hours} processing hours per billing period. You have consumed {current_hours_used:.2f} hrs. Uploading this video ({new_duration_hours:.2f} hrs) exceeds your monthly allowance."
                )

    def validate_upload(
        self,
        user,
        file_size_bytes: int = 0,
        current_uploads_count: int = 0,
        current_processing_hours: float = 0.0,
        new_duration_hours: float = 0.0
    ) -> None:
        """Validate upload count, storage quota, and processing hours."""
        self.validate_upload_count(current_uploads_count)
        storage_used = getattr(user, "storage_used", 0) or 0
        self.validate_storage_quota(storage_used, file_size_bytes)
        self.validate_processing_hours(current_processing_hours, new_duration_hours)

    def validate_theme(self, requested_theme: str) -> None:
        """Enforce theme customization permission. Raises HTTP 403 if restricted."""
        if not self.allows_custom_themes and requested_theme != DEFAULT_THEME:
            raise HTTPException(
                status_code=403,
                detail="Theme customization is available on Pro, Pro+, and Vibers plans."
            )
        if (requested_theme.startswith("custom:") or requested_theme.startswith("gradient:")) and not self.allows_custom_gradients:
            raise HTTPException(
                status_code=403,
                detail="Custom color and gradient selector mode is exclusively available on the Vibers plan. Upgrade to Vibers to design your own custom color palette!"
            )

    def can_join_room(self, current_participants_count: int, is_host: bool = False) -> bool:
        """Check if a participant can join a room hosted under this plan."""
        if is_host:
            return True  # Host is never locked out
        return current_participants_count < self.max_participants

    def to_dict(self) -> Dict[str, Any]:
        """Dictionary representation matching legacy PLAN_CONFIG schemas."""
        return {
            "storage_limit": self.storage_limit_bytes,
            "max_quality": self.max_quality_p,
            "upload_limit": self.upload_limit,
            "upload_period": self.upload_period,
            "monthly_uploads": self.upload_limit,
            "monthly_processing_hours": self.monthly_processing_hours,
            "max_participants": self.max_participants,
            "yt_rooms_per_month": self.yt_rooms_per_month,
            "collections": self.allows_collections,
            "voice_chat": self.allows_voice_chat,
            "custom_themes": self.allows_custom_themes,
            "custom_gradients": self.allows_custom_gradients,
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} code='{self.code}' name='{self.name}'>"


# ==============================================================================
# Concrete Plan Implementations
# ==============================================================================

class FreePlan(BasePlan):
    code = PLAN_FREE
    name = "Free"
    monthly_price = 0.0
    annual_price = 0.0
    storage_limit_bytes = 2 * GB
    max_quality_p = QUALITY_720
    upload_limit = 3
    upload_period = "lifetime"
    monthly_processing_hours = None  # Free trial: 3 lifetime uploads, no recurring processing allowance
    max_participants = 6             # Host + 5 guests
    yt_rooms_per_month = 20
    allows_collections = False
    allows_voice_chat = False
    allows_custom_themes = False
    allows_custom_gradients = False

    def validate_upload_count(self, current_uploads_count: int) -> None:
        if current_uploads_count >= self.upload_limit:
            raise HTTPException(
                status_code=403,
                detail="Free tier accounts include 3 lifetime video uploads. You have consumed all 3 uploads. Upgrade to Pro for monthly allowances!"
            )


class ProPlan(BasePlan):
    code = PLAN_PRO
    name = "Pro"
    monthly_price = 2.99
    annual_price = 29.99
    storage_limit_bytes = 10 * GB
    max_quality_p = QUALITY_1080
    upload_limit = 5
    upload_period = "billing_period"
    monthly_processing_hours = 10.0
    max_participants = 16
    yt_rooms_per_month = None  # Unlimited
    allows_collections = True
    allows_voice_chat = True
    allows_custom_themes = True
    allows_custom_gradients = False

    def validate_upload_count(self, current_uploads_count: int) -> None:
        if current_uploads_count >= self.upload_limit:
            raise HTTPException(
                status_code=403,
                detail="Pro tier accounts are capped at a maximum of 5 video uploads per billing period. Upgrade to Pro+ or Vibers for higher limits!"
            )


class ProPlusPlan(BasePlan):
    code = PLAN_PRO_PLUS
    name = "Pro+"
    monthly_price = 6.99
    annual_price = 69.99
    storage_limit_bytes = 20 * GB
    max_quality_p = QUALITY_1080
    upload_limit = 100
    upload_period = "billing_period"
    monthly_processing_hours = 50.0
    max_participants = 31
    yt_rooms_per_month = None
    allows_collections = True
    allows_voice_chat = True
    allows_custom_themes = True
    allows_custom_gradients = False

    def validate_upload_count(self, current_uploads_count: int) -> None:
        if current_uploads_count >= self.upload_limit:
            raise HTTPException(
                status_code=403,
                detail="Pro+ tier accounts are capped at a maximum of 100 video uploads per billing period. Upgrade to Vibers for higher limits!"
            )


class VibersPlan(BasePlan):
    code = PLAN_VIBERS
    name = "Vibers"
    monthly_price = 9.99
    annual_price = 99.99
    storage_limit_bytes = 50 * GB
    max_quality_p = QUALITY_4K
    upload_limit = 200
    upload_period = "billing_period"
    monthly_processing_hours = 50.0
    max_participants = 500  # Effectively unlimited
    yt_rooms_per_month = None
    allows_collections = True
    allows_voice_chat = True
    allows_custom_themes = True
    allows_custom_gradients = True  # Exclusive custom color and gradient selector mode

    def validate_upload_count(self, current_uploads_count: int) -> None:
        if current_uploads_count >= self.upload_limit:
            raise HTTPException(
                status_code=403,
                detail="Vibers tier accounts are capped at a maximum of 200 video uploads per billing period."
            )


# ==============================================================================
# Plan Registry & Factory
# ==============================================================================

class PlanRegistry:
    """Central registry providing singleton access and resolution of domain plan objects."""
    _instances: Dict[str, BasePlan] = {
        PLAN_FREE: FreePlan(),
        PLAN_PRO: ProPlan(),
        PLAN_PRO_PLUS: ProPlusPlan(),
        PLAN_VIBERS: VibersPlan(),
    }

    @classmethod
    def get(cls, plan_code: Optional[str]) -> BasePlan:
        """Fetch plan object by code, defaulting to FreePlan."""
        if not plan_code:
            return cls._instances[PLAN_FREE]
        return cls._instances.get(str(plan_code).strip().lower(), cls._instances[PLAN_FREE])

    @classmethod
    def all(cls) -> List[BasePlan]:
        """Return all registered plan objects."""
        return list(cls._instances.values())

    @classmethod
    def resolve_for_user(cls, user) -> BasePlan:
        """
        Dynamically determine the effective BasePlan domain instance for a user:
        1. Owner email => VibersPlan (lifetime free).
        2. Stored user.plan (falls back to FreePlan if unknown).
        3. Expiration check: if user.plan_expires_at is in the past => FreePlan.
        """
        if not user:
            return cls._instances[PLAN_FREE]

        if is_owner(user):
            return cls._instances[PLAN_VIBERS]

        stored_plan_code = getattr(user, "plan", None) or PLAN_FREE
        if stored_plan_code not in cls._instances or stored_plan_code == PLAN_FREE:
            return cls._instances[PLAN_FREE]

        expires_at = getattr(user, "plan_expires_at", None)
        if expires_at is not None:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                return cls._instances[PLAN_FREE]

        return cls._instances.get(stored_plan_code, cls._instances[PLAN_FREE])


# ==============================================================================
# Backwards Compatibility Layer (Dicts & Functions)
# ==============================================================================

PLAN_PRICING = {
    plan.code: {"monthly": plan.monthly_price, "annual": plan.annual_price}
    for plan in PlanRegistry.all()
}

PLAN_CONFIG = {
    plan.code: plan.to_dict()
    for plan in PlanRegistry.all()
}


def is_valid_plan(plan: str) -> bool:
    return plan in PlanRegistry._instances


def get_plan_config(plan: str) -> dict:
    return PlanRegistry.get(plan).to_dict()


def get_user_plan(user) -> str:
    """The raw plan stored on the user, falling back to Free for unknown values."""
    plan = getattr(user, "plan", None) or DEFAULT_PLAN
    return plan if is_valid_plan(plan) else DEFAULT_PLAN


def get_effective_plan(user) -> str:
    """Returns the code ('free', 'pro', 'pro_plus', 'vibers') of the active plan."""
    return PlanRegistry.resolve_for_user(user).code


def get_user_plan_config(user) -> dict:
    """Returns the legacy configuration dictionary of the user's active plan."""
    return PlanRegistry.resolve_for_user(user).to_dict()


def plan_allows(plan: str, feature: str) -> bool:
    """Check if a plan code permits a specific feature gate."""
    return bool(PlanRegistry.get(plan).to_dict().get(feature, False))


def user_allows(user, feature: str) -> bool:
    """Check if a user's active plan permits a specific feature gate."""
    return bool(PlanRegistry.resolve_for_user(user).to_dict().get(feature, False))


