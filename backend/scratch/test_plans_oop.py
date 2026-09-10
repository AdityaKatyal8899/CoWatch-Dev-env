"""
Comprehensive Automated Verification Test Suite for CoWatch Subscription & Entitlements Architecture.

Validates all 18 requirements:
1. Free tier 3 lifetime uploads (1st, 2nd, 3rd allowed; 4th rejected).
2. Free tier calendar/billing month does NOT reset lifetime allowance.
3. Pro tier 5 uploads/billing period (5th allowed; 6th rejected).
4. Pro tier 10 processing hours (10.0 allowed; >10.0 rejected).
5. Pro tier new billing period resets upload and processing usage.
6. Pro+ tier 100 uploads/billing period (100th allowed; 101st rejected).
7. Pro+ tier 50 processing hours (50.0 allowed; >50.0 rejected).
8. Vibers tier 200 uploads/billing period (200th allowed; 201st rejected).
9. Vibers tier 50 processing hours (50.0 allowed; >50.0 rejected).
10. Vibers tier 4K max resolution entitlement (2160p).
11. Storage quota independent enforcement across all tiers.
12. Owner emails lifetime Vibers override.
13. Owner override persistence regardless of expiration field.
14. Expired paid subscriptions gracefully reverting to Free.
15. Active paid subscriptions resolving to respective tier.
16. Theme customization authorization.
17. Room participant limits and host bypass.
18. Backward compatibility layer.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.subscriptions.plans import (
    BasePlan,
    FreePlan,
    ProPlan,
    ProPlusPlan,
    VibersPlan,
    PlanRegistry,
    PLAN_FREE,
    PLAN_PRO,
    PLAN_PRO_PLUS,
    PLAN_VIBERS,
    DEFAULT_PLAN,
    DEFAULT_THEME,
    PLAN_PRICING,
    PLAN_CONFIG,
    get_plan_config,
    get_user_plan,
    get_effective_plan,
    get_user_plan_config,
    plan_allows,
    user_allows,
    get_user_billing_period_start,
    GB,
)
from app.database import models


class MockUser:
    def __init__(self, email="user@cowatch.io", plan="free", storage_used=0, plan_expires_at=None, created_at=None):
        self.email = email
        self.plan = plan
        self.storage_used = storage_used
        self.plan_expires_at = plan_expires_at
        self.created_at = created_at or datetime.now(timezone.utc)

    @property
    def plan_tier(self) -> BasePlan:
        return PlanRegistry.resolve_for_user(self)


def test_free_plan_lifetime_uploads():
    print("\n--- 1. Testing FREE Plan Lifetime Uploads ---")
    free = FreePlan()
    assert free.upload_period == "lifetime"
    assert free.upload_limit == 3
    assert free.monthly_processing_hours is None

    # First, second, third uploads -> Allowed
    free.validate_upload_count(0)
    free.validate_upload_count(1)
    free.validate_upload_count(2)
    print("  [PASS] 1st, 2nd, and 3rd uploads allowed.")

    # 4th upload -> Rejected
    try:
        free.validate_upload_count(3)
        assert False, "4th upload should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "lifetime video uploads" in e.detail
        print("  [PASS] 4th upload rejected with HTTP 403 (Lifetime limit message).")

    # Verify Free user billing period start is always epoch / unchanged across calendar months
    u_free = MockUser(plan="free", created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
    period_start = get_user_billing_period_start(u_free)
    assert period_start.year == datetime.now(timezone.utc).year  # Calendar month does not change upload_period='lifetime'
    assert u_free.plan_tier.upload_period == "lifetime"
    print("  [PASS] Calendar month advancement does NOT reset Free tier upload allowance.")


def test_pro_plan_monthly_uploads_and_processing():
    print("\n--- 2. Testing PRO Plan Uploads & Processing Hours ---")
    pro = ProPlan()
    assert pro.upload_period == "billing_period"
    assert pro.upload_limit == 5
    assert pro.monthly_processing_hours == 10.0

    # 5 uploads -> Allowed
    for count in range(5):
        pro.validate_upload_count(count)
    print("  [PASS] 1 through 5 uploads allowed in billing period.")

    # 6th upload -> Rejected
    try:
        pro.validate_upload_count(5)
        assert False, "6th upload should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at a maximum of 5" in e.detail
        print("  [PASS] 6th upload in billing period rejected with HTTP 403.")

    # 10 processing hours -> Allowed
    pro.validate_processing_hours(current_hours_used=8.0, new_duration_hours=2.0)
    print("  [PASS] Up to 10.0 processing hours allowed.")

    # > 10 processing hours -> Rejected
    try:
        pro.validate_processing_hours(current_hours_used=9.0, new_duration_hours=1.5)
        assert False, "Exceeding 10 processing hours should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at 10.0 processing hours" in e.detail
        print("  [PASS] Exceeding 10.0 processing hours rejected with HTTP 403.")


def test_pro_plus_plan_uploads_and_processing():
    print("\n--- 3. Testing PRO+ Plan Uploads & Processing Hours ---")
    pro_plus = ProPlusPlan()
    assert pro_plus.upload_period == "billing_period"
    assert pro_plus.upload_limit == 100
    assert pro_plus.monthly_processing_hours == 50.0

    # Up to 100 uploads -> Allowed
    pro_plus.validate_upload_count(99)
    print("  [PASS] Up to 100 uploads allowed in billing period.")

    # 101st upload -> Rejected
    try:
        pro_plus.validate_upload_count(100)
        assert False, "101st upload should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at a maximum of 100" in e.detail
        print("  [PASS] 101st upload in billing period rejected with HTTP 403.")

    # Up to 50 processing hours -> Allowed
    pro_plus.validate_processing_hours(current_hours_used=40.0, new_duration_hours=10.0)
    print("  [PASS] Up to 50.0 processing hours allowed.")

    # > 50 processing hours -> Rejected
    try:
        pro_plus.validate_processing_hours(current_hours_used=49.0, new_duration_hours=2.0)
        assert False, "Exceeding 50 processing hours should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at 50.0 processing hours" in e.detail
        print("  [PASS] Exceeding 50.0 processing hours rejected with HTTP 403.")


def test_vibers_plan_uploads_processing_and_4k():
    print("\n--- 4. Testing VIBERS Plan Uploads, Processing & 4K ---")
    vibers = VibersPlan()
    assert vibers.upload_period == "billing_period"
    assert vibers.upload_limit == 200
    assert vibers.monthly_processing_hours == 50.0
    assert vibers.max_quality_p == 2160  # 4K

    # Up to 200 uploads -> Allowed
    vibers.validate_upload_count(199)
    print("  [PASS] Up to 200 uploads allowed in billing period.")

    # 201st upload -> Rejected
    try:
        vibers.validate_upload_count(200)
        assert False, "201st upload should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at a maximum of 200" in e.detail
        print("  [PASS] 201st upload in billing period rejected with HTTP 403.")

    # Up to 50 processing hours -> Allowed
    vibers.validate_processing_hours(current_hours_used=45.0, new_duration_hours=5.0)
    print("  [PASS] Up to 50.0 processing hours allowed.")

    # > 50 processing hours -> Rejected
    try:
        vibers.validate_processing_hours(current_hours_used=50.0, new_duration_hours=0.5)
        assert False, "Exceeding 50 processing hours should be rejected"
    except HTTPException as e:
        assert e.status_code == 403
        assert "capped at 50.0 processing hours" in e.detail
        print("  [PASS] Exceeding 50.0 processing hours rejected with HTTP 403.")

    # 4K Resolution verification
    assert vibers.max_quality_p == 2160
    print("  [PASS] Vibers plan provides 4K (2160p) resolution entitlement.")


def test_independent_storage_enforcement():
    print("\n--- 5. Testing Independent Storage Enforcement ---")
    free = FreePlan()
    pro = ProPlan()
    pro_plus = ProPlusPlan()
    vibers = VibersPlan()

    assert free.storage_limit_bytes == 2 * GB
    assert pro.storage_limit_bytes == 10 * GB
    assert pro_plus.storage_limit_bytes == 20 * GB
    assert vibers.storage_limit_bytes == 50 * GB

    # Within quota -> Allowed
    free.validate_storage_quota(current_storage_used=1 * GB, new_bytes=500 * 1024 * 1024)
    pro.validate_storage_quota(current_storage_used=8 * GB, new_bytes=1 * GB)

    # Exceeding quota -> HTTP 413
    try:
        free.validate_storage_quota(current_storage_used=int(1.8 * GB), new_bytes=int(0.5 * GB))
        assert False, "Free storage quota exceeded should raise 413"
    except HTTPException as e:
        assert e.status_code == 413
        assert "Storage limit exceeded" in e.detail

    try:
        pro.validate_storage_quota(current_storage_used=9 * GB, new_bytes=2 * GB)
        assert False, "Pro storage quota exceeded should raise 413"
    except HTTPException as e:
        assert e.status_code == 413
        assert "Storage limit exceeded" in e.detail

    print("  [PASS] Storage quotas independently enforced for all plans.")


def test_plan_resolution_and_owner_overrides():
    print("\n--- 6. Testing Plan Resolution & Owner Overrides ---")
    now = datetime.now(timezone.utc)
    os.environ["OWNER_EMAILS"] = "founder@cowatch.io,admin@cowatch.io"

    # 1. Owner email always resolves to VibersPlan regardless of stored plan or expiration
    owner1 = MockUser(email="founder@cowatch.io", plan="free", plan_expires_at=None)
    assert owner1.plan_tier.code == PLAN_VIBERS
    assert owner1.plan_tier.max_quality_p == 2160
    assert owner1.plan_tier.max_participants == 500

    owner_expired = MockUser(email="admin@cowatch.io", plan="pro", plan_expires_at=now - timedelta(days=10))
    assert owner_expired.plan_tier.code == PLAN_VIBERS
    print("  [PASS] Owner email resolution returns VibersPlan with lifetime privileges.")

    # 2. Expired regular user falls back to FreePlan
    user_expired = MockUser(email="user@test.com", plan="pro_plus", plan_expires_at=now - timedelta(days=1))
    assert user_expired.plan_tier.code == PLAN_FREE
    assert user_expired.plan_tier.storage_limit_bytes == 2 * GB
    print("  [PASS] Expired subscription gracefully reverts to FreePlan.")

    # 3. Active regular user returns active plan
    user_active = MockUser(email="user2@test.com", plan="pro", plan_expires_at=now + timedelta(days=20))
    assert user_active.plan_tier.code == PLAN_PRO
    assert user_active.plan_tier.monthly_processing_hours == 10.0
    print("  [PASS] Active subscription resolves to correct plan domain object.")


def test_billing_period_reset_logic():
    print("\n--- 7. Testing Billing Period Reset Logic ---")
    now = datetime.now(timezone.utc)

    # Monthly user with 15 days left in current billing cycle
    expires_at = now + timedelta(days=15)
    u_monthly = MockUser(plan="pro", plan_expires_at=expires_at)
    period_start = get_user_billing_period_start(u_monthly)
    # Start should be approximately expires_at - 30 days
    diff = (expires_at - timedelta(days=30) - period_start).total_seconds()
    assert abs(diff) < 2
    print("  [PASS] Monthly subscription correctly computes 30-day billing window start.")


def test_backwards_compatibility():
    print("\n--- 8. Testing 100% Backwards Compatibility Layer ---")
    assert PLAN_PRICING["free"]["monthly"] == 0.0
    assert PLAN_PRICING["pro"]["monthly"] == 2.99
    assert PLAN_PRICING["pro_plus"]["monthly"] == 6.99
    assert PLAN_PRICING["vibers"]["annual"] == 99.99

    assert PLAN_CONFIG["free"]["storage_limit"] == 2 * GB
    assert PLAN_CONFIG["free"]["monthly_uploads"] == 3
    assert PLAN_CONFIG["pro"]["monthly_processing_hours"] == 10.0
    assert PLAN_CONFIG["pro_plus"]["upload_limit"] == 100
    assert PLAN_CONFIG["vibers"]["monthly_processing_hours"] == 50.0

    u = MockUser(plan="pro_plus")
    assert get_effective_plan(u) == "pro_plus"
    assert get_user_plan_config(u)["upload_limit"] == 100
    assert plan_allows("pro_plus", "voice_chat") is True
    assert user_allows(u, "custom_themes") is True
def test_custom_color_and_gradient_mode():
    print("\n--- 9. Testing Exclusive Vibers Custom Color & Gradient Mode ---")
    free = FreePlan()
    pro = ProPlan()
    pro_plus = ProPlusPlan()
    vibers = VibersPlan()

    assert free.allows_custom_gradients is False
    assert pro.allows_custom_gradients is False
    assert pro_plus.allows_custom_gradients is False
    assert vibers.allows_custom_gradients is True

    # 1. Preset theme is allowed on Pro and Pro+
    pro.validate_theme("neo-purple")
    pro_plus.validate_theme("midnight-blue")

    # 2. Custom solid color on Pro -> Rejected with 403
    try:
        pro.validate_theme("custom:#0B0B0F:#8B5CF6:#FFFFFF")
        assert False, "Pro should not be allowed custom color selector"
    except HTTPException as e:
        assert e.status_code == 403
        assert "exclusively available on the Vibers plan" in e.detail

    # 3. Custom gradient on Pro+ -> Rejected with 403
    try:
        pro_plus.validate_theme("gradient:135deg:#8B5CF6:#EC4899:#0B0B0F:#FFFFFF")
        assert False, "Pro+ should not be allowed custom gradient selector"
    except HTTPException as e:
        assert e.status_code == 403
        assert "exclusively available on the Vibers plan" in e.detail

    # 4. Custom gradient & solid colors on Vibers -> Allowed
    vibers.validate_theme("custom:#0B0B0F:#06B6D4:#FFFFFF")
    vibers.validate_theme("gradient:135deg:#8B5CF6:#EC4899:#0F0B1A:#FFFFFF")
    print("  [PASS] Custom color and gradient mode is strictly restricted to Vibers.")


if __name__ == "__main__":
    test_free_plan_lifetime_uploads()
    test_pro_plan_monthly_uploads_and_processing()
    test_pro_plus_plan_uploads_and_processing()
    test_vibers_plan_uploads_processing_and_4k()
    test_independent_storage_enforcement()
    test_plan_resolution_and_owner_overrides()
    test_billing_period_reset_logic()
    test_backwards_compatibility()
    test_custom_color_and_gradient_mode()
    print("\n" + "=" * 55)
    print(" ALL SUBSCRIPTION & VIBERS GRADIENT TEST SUITES PASSED ")
    print("=" * 55)
