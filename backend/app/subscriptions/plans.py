"""
Subscription plan definitions and entitlement helpers.

Single source of truth for what each plan allows. All per-plan limits
(storage, upload quality, room capacity, feature gates) live here so routes
can enforce them uniformly instead of hardcoding values.
"""

import os
from datetime import datetime, timezone

PLAN_FREE = "free"
PLAN_PRO = "pro"
PLAN_PRO_PLUS = "pro_plus"
PLAN_VIBERS = "vibers"

DEFAULT_PLAN = PLAN_FREE

# Theme a Free user is locked to. Theme customization (any change,
# including custom colors) requires a paid plan.
DEFAULT_THEME = "default-dark"

# Max upload quality in vertical resolution pixels.
QUALITY_720 = 720
QUALITY_1080 = 1080
QUALITY_4K = 2160

GB = 1024 ** 3

PLAN_CONFIG = {
    PLAN_FREE: {
        "storage_limit": 2 * GB,
        "max_quality": QUALITY_720,
        "max_participants": 6,  # host + 5 guests
        "yt_rooms_per_month": 20,  # None = unlimited
        "collections": False,
        "voice_chat": False,
        "custom_themes": False,
    },
    PLAN_PRO: {
        "storage_limit": 10 * GB,
        "max_quality": QUALITY_1080,
        "max_participants": 16,
        "yt_rooms_per_month": None,
        "collections": True,
        "voice_chat": True,
        "custom_themes": True,
    },
    PLAN_PRO_PLUS: {
        "storage_limit": 20 * GB,
        "max_quality": QUALITY_1080,
        "max_participants": 31,
        "yt_rooms_per_month": None,
        "collections": True,
        "voice_chat": True,
        "custom_themes": True,
    },
    PLAN_VIBERS: {
        "storage_limit": 50 * GB,
        "max_quality": QUALITY_4K,
        "max_participants": 500,  # effectively unlimited
        "yt_rooms_per_month": None,
        "collections": True,
        "voice_chat": True,
        "custom_themes": True,
    },
}


def is_valid_plan(plan: str) -> bool:
    return plan in PLAN_CONFIG


def get_plan_config(plan: str) -> dict:
    return PLAN_CONFIG.get(plan, PLAN_CONFIG[DEFAULT_PLAN])


def get_user_plan(user) -> str:
    """The plan stored on the user, falling back to Free for unknown values."""
    plan = getattr(user, "plan", None) or DEFAULT_PLAN
    return plan if is_valid_plan(plan) else DEFAULT_PLAN


def _owner_emails() -> set:
    """Comma-separated OWNER_EMAILS env var. The owner always gets full access for free."""
    raw = os.environ.get("OWNER_EMAILS", "").strip()
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_owner(user) -> bool:
    email = getattr(user, "email", None) or ""
    return email.strip().lower() in _owner_emails()


def get_effective_plan(user) -> str:
    """
    The plan actually applied to a user right now:
    - Owner => Vibers (lifetime, free).
    - Stored plan, unless it has expired => back to Free.
    """
    if is_owner(user):
        return PLAN_VIBERS

    plan = get_user_plan(user)
    if plan == PLAN_FREE:
        return PLAN_FREE

    expires_at = getattr(user, "plan_expires_at", None)
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return PLAN_FREE

    return plan


def get_user_plan_config(user) -> dict:
    return get_plan_config(get_effective_plan(user))


def plan_allows(plan: str, feature: str) -> bool:
    return bool(get_plan_config(plan).get(feature, False))


def user_allows(user, feature: str) -> bool:
    return plan_allows(get_effective_plan(user), feature)
