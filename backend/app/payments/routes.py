import os
import uuid
import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
import stripe

from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user
from app.subscriptions.plans import PlanRegistry, PLAN_PRICING, REGIONAL_PRICING, CURRENCIES, get_plan_config
from app.services.email_service import send_subscription_receipt_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

# Load Cashfree Credentials
cashfree_app_id = os.getenv("CASHFREE_APP_ID", "").strip()
cashfree_secret_key = os.getenv("CASHFREE_SECRET_KEY", "").strip()
cashfree_env = os.getenv("CASHFREE_ENV", "production").strip().lower()
cashfree_api_version = os.getenv("CASHFREE_API_VERSION", "2023-08-01").strip()
cashfree_base_url = "https://sandbox.cashfree.com/pg" if cashfree_env == "sandbox" else "https://api.cashfree.com/pg"
is_cashfree_configured = bool(cashfree_app_id and cashfree_secret_key)

# Load Stripe Credentials from environment
stripe_publishable_key = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

# Guard against live keys in testing sandbox
if stripe_publishable_key.startswith("pk_live_") or stripe_secret_key.startswith("sk_live_"):
    logger.warning("⚠️ CRITICAL SECURITY WARNING: Live Stripe keys detected in test environment!")

is_test_mode = stripe_secret_key.startswith("sk_test_")
is_configured = bool(stripe_secret_key and is_test_mode and stripe_secret_key != "sk_test_placeholder")

if is_configured:
    stripe.api_key = stripe_secret_key


def get_frontend_url(request: Request) -> str:
    """Determine dynamic frontend origin for success/cancel redirects."""
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    frontend_env = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return frontend_env.split(",")[0].strip().rstrip("/")


class CheckoutSessionRequest(BaseModel):
    plan_id: str  # pro | pro_plus | vibers
    billing: str = "monthly"  # monthly | annual
    currency: str = "inr"  # inr | usd | etc.
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str
    amount: float
    currency: str
    plan_id: str
    plan_name: str
    payment_session_id: Optional[str] = None
    payment_gateway: str = "cashfree"  # cashfree | stripe


class TransactionResponse(BaseModel):
    id: int
    stripe_session_id: str
    payment_intent_id: Optional[str]
    plan_id: str
    billing_cycle: str
    amount: float
    currency: str
    status: str
    customer_email: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


def get_session_metadata(session: Any) -> Dict[str, Any]:
    """Safely extracts a dictionary from Stripe session metadata (StripeObject / dict)."""
    if not session or not getattr(session, "metadata", None):
        return {}
    meta = session.metadata
    if hasattr(meta, "to_dict"):
        return meta.to_dict()
    if isinstance(meta, dict):
        return meta
    try:
        return dict(meta)
    except Exception:
        return {}


def process_successful_payment(session: Any, db: Session) -> Optional[models.PaymentTransaction]:
    """
    Idempotently upgrades user plan and logs transaction in database upon verified Stripe checkout.
    """
    stripe_session_id = session.id

    # Check for duplicate processing
    existing_txn = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.stripe_session_id == stripe_session_id
    ).first()
    if existing_txn:
        return existing_txn

    meta = get_session_metadata(session)
    user_id = meta.get("user_id") or getattr(session, "client_reference_id", None)
    plan_id = meta.get("plan_id") or "pro"
    billing_cycle = meta.get("billing_cycle") or "monthly"

    cust_details = getattr(session, "customer_details", None)
    customer_email = getattr(cust_details, "email", None) if cust_details else None

    user = None
    if user_id:
        try:
            user = db.query(models.User).filter(models.User.id == user_id).first()
        except Exception as e:
            logger.warning(f"Failed to query user by id {user_id}: {e}")

    if not user and customer_email:
        user = db.query(models.User).filter(models.User.email == customer_email).first()

    if not user:
        logger.error(f"Cannot associate payment session {stripe_session_id} with any user.")
        return None

    target_plan = PlanRegistry.get(plan_id)
    duration_days = 365 if billing_cycle.lower() == "annual" else 30

    # Apply subscription tier upgrade
    user.plan = target_plan.code
    user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)
    user.storage_limit = target_plan.storage_limit_bytes

    # Create payment transaction record with currency handling
    curr_val = (getattr(session, "currency", None) or "usd").lower()
    is_zero_decimal = curr_val in ["jpy", "krw"]
    amount_total = getattr(session, "amount_total", None)
    if amount_total is not None:
        amount_val = float(amount_total) if is_zero_decimal else (amount_total / 100.0)
    else:
        amount_val = target_plan.get_billing_price(billing_cycle, currency=curr_val)
    
    payment_intent = getattr(session, "payment_intent", None)
    pi_id = payment_intent if isinstance(payment_intent, str) else (
        getattr(payment_intent, "id", None) if payment_intent else None
    )
    cust_email = customer_email or user.email

    txn = models.PaymentTransaction(
        user_id=user.id,
        stripe_session_id=stripe_session_id,
        payment_intent_id=pi_id,
        plan_id=target_plan.code,
        billing_cycle=billing_cycle,
        amount=amount_val,
        currency=curr_val,
        status="succeeded",
        customer_email=cust_email,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    db.refresh(user)
    logger.info(f"Successfully applied plan {target_plan.name} to user {user.email} (Txn ID: {txn.id})")

    # Send receipt invoice email (exact dark UI replica)
    try:
        expires_str = user.plan_expires_at.strftime("%B %d, %Y") if user.plan_expires_at else "Lifetime"
        user_name = getattr(user, "display_name", None) or getattr(user, "name", None) or user.email.split("@")[0]
        send_subscription_receipt_email(
            to_email=user.email,
            username=user_name,
            plan_name=target_plan.name,
            billing_cycle=billing_cycle,
            amount=amount_val,
            currency=curr_val,
            transaction_id=str(txn.id),
            stripe_session_id=stripe_session_id,
            plan_expires_at=expires_str,
        )
    except Exception as em_err:
        logger.warning(f"Failed to dispatch subscription receipt email: {em_err}")

    return txn


@router.get("/config")
async def get_payment_config():
    """Returns safe, public Payment configuration details including Cashfree and Stripe."""
    return {
        "configured": is_cashfree_configured or is_configured,
        "cashfree": {
            "configured": is_cashfree_configured,
            "mode": cashfree_env,
        },
        "stripe": {
            "configured": is_configured,
            "publishable_key": stripe_publishable_key if is_configured else None,
            "is_test_mode": is_test_mode,
        },
        "pricing": PLAN_PRICING,
        "regional_pricing": REGIONAL_PRICING,
        "currencies": CURRENCIES,
    }


@router.get("/detect-region")
async def detect_region(request: Request):
    """
    Infers user country and currency from cloudflare headers / client IP.
    Returns matched regional currency and metadata.
    """
    country = (
        request.headers.get("cf-ipcountry")
        or request.headers.get("x-vercel-ip-country")
        or request.headers.get("cloudfront-viewer-country")
        or request.headers.get("x-country-code")
        or ""
    ).upper()

    country_to_curr = {
        "IN": "inr",
        "US": "usd",
        "GB": "gbp",
        "UK": "gbp",
        "JP": "jpy",
        "KR": "krw",
        "DE": "eur", "FR": "eur", "IT": "eur", "ES": "eur", "NL": "eur", "BE": "eur",
        "AT": "eur", "IE": "eur", "PT": "eur", "FI": "eur", "GR": "eur",
    }

    if country in country_to_curr:
        currency_code = country_to_curr[country]
    elif country and country != "UNKNOWN":
        currency_code = "usd"
    else:
        currency_code = "inr"

    return {
        "country": country or "LOCAL",
        "currency": currency_code,
        "currency_info": CURRENCIES.get(currency_code, CURRENCIES["inr"]),
    }


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generates a checkout session. Uses Cashfree Production PG for INR / domestic payments,
    and Stripe for global cards / international fallback.
    """
    plan_id = payload.plan_id.strip().lower()
    billing = payload.billing.strip().lower()
    currency = (payload.currency or "inr").strip().lower()

    if currency not in CURRENCIES:
        currency = "inr"

    if plan_id not in ["pro", "pro_plus", "vibers"]:
        raise HTTPException(status_code=400, detail="Only Pro, Pro+, and Vibers plans are eligible for checkout.")

    target_plan = PlanRegistry.get(plan_id)
    try:
        price_amount = target_plan.get_billing_price(billing, currency=currency)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    if price_amount <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid pricing amount for plan {plan_id}.")

    frontend_base = get_frontend_url(request)

    # 1. CASHFREE PRIMARY (for INR and whenever Cashfree is configured)
    if is_cashfree_configured and (currency == "inr" or not is_configured):
        # Distinct prefix so CoWatch transactions never mix with MyFlix
        cf_order_id = f"cowatch_{plan_id[:3]}_{billing[:3]}_{str(uuid.uuid4())[:8]}"

        # In Production, Cashfree requires HTTPS. In Sandbox, localhost is fully supported.
        if cashfree_env == "production" and frontend_base.startswith("http://"):
            cf_frontend = "https://cowatch-theta.vercel.app"
        else:
            cf_frontend = frontend_base

        return_url = f"{cf_frontend}/payment/success?session_id={{order_id}}"
        notify_url = "https://newcowatchserver.duckdns.org/api/payments/cashfree/webhook"

        # Clean customer phone fallback for Cashfree
        customer_phone = getattr(current_user, "phone", None) or "9999999999"
        if len(str(customer_phone).strip()) < 10:
            customer_phone = "9999999999"

        customer_name = getattr(current_user, "display_name", None) or getattr(current_user, "name", None) or (current_user.email.split("@")[0])

        cf_payload = {
            "order_id": cf_order_id,
            "order_amount": float(price_amount),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": str(current_user.id),
                "customer_name": customer_name[:50],
                "customer_email": current_user.email,
                "customer_phone": str(customer_phone)[-10:],
            },
            "order_meta": {
                "return_url": return_url,
                "notify_url": notify_url,
                "payment_methods": "upi,cc,dc,nb",
            },
            "order_note": f"CoWatch {target_plan.name} ({billing.capitalize()})",
            "order_tags": {
                "user_id": str(current_user.id),
                "plan_id": target_plan.code,
                "billing_cycle": billing,
                "currency": "INR",
                "app": "cowatch",
            },
        }

        cf_headers = {
            "x-client-id": cashfree_app_id,
            "x-client-secret": cashfree_secret_key,
            "x-api-version": cashfree_api_version,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{cashfree_base_url}/orders", json=cf_payload, headers=cf_headers)
            
            if res.status_code not in [200, 201]:
                logger.error(f"Cashfree order creation error {res.status_code}: {res.text}")
                raise HTTPException(status_code=500, detail=f"Cashfree error: {res.text}")

            cf_data = res.json()
            payment_session_id = cf_data.get("payment_session_id")
            
            # Cashfree hosted payment link (universal across desktop & mobile UPI)
            checkout_url = f"https://payments.cashfree.com/order/#/{payment_session_id}" if cashfree_env == "production" else f"https://sandbox.cashfree.com/order/#/{payment_session_id}"

            return CheckoutSessionResponse(
                session_id=cf_order_id,
                url=checkout_url,
                amount=price_amount,
                currency="INR",
                plan_id=target_plan.code,
                plan_name=target_plan.name,
                payment_session_id=payment_session_id,
                payment_gateway="cashfree",
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create Cashfree order: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Cashfree order creation failed: {str(e)}")

    # 2. STRIPE GLOBAL FALLBACK
    if not is_configured:
        raise HTTPException(
            status_code=500,
            detail="Payment processor is not configured. Please check Cashfree/Stripe settings.",
        )

    is_zero_decimal = CURRENCIES.get(currency, {}).get("is_zero_decimal", False)
    unit_amount = int(round(price_amount)) if is_zero_decimal else int(round(price_amount * 100))
    success_url = payload.success_url or f"{frontend_base}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = payload.cancel_url or f"{frontend_base}/payment/cancel"

    try:
        session = stripe.checkout.Session.create(
            managed_payments={"enabled": False},
            line_items=[
                {
                    "price_data": {
                        "currency": currency,
                        "product_data": {
                            "name": f"CoWatch {target_plan.name} ({billing.capitalize()})",
                            "description": f"CoWatch {target_plan.name} Tier: {target_plan.storage_limit_bytes // (1024**3)}GB Storage, {target_plan.max_quality_p}p quality.",
                        },
                        "unit_amount": unit_amount,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            client_reference_id=str(current_user.id),
            customer_email=current_user.email,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": str(current_user.id),
                "plan_id": target_plan.code,
                "plan_name": target_plan.name,
                "billing_cycle": billing,
                "currency": currency,
                "app": "cowatch",
            },
        )

        return CheckoutSessionResponse(
            session_id=session.id,
            url=session.url,
            amount=price_amount,
            currency=currency.upper(),
            plan_id=target_plan.code,
            plan_name=target_plan.name,
            payment_gateway="stripe",
        )
    except Exception as e:
        logger.error(f"Failed to create Stripe Checkout Session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout initialization failed: {str(e)}")


def process_successful_cashfree_order(cf_order: Dict[str, Any], db: Session) -> Optional[models.PaymentTransaction]:
    """
    Idempotently upgrades user plan and logs transaction in database upon verified Cashfree payment.
    """
    cf_order_id = cf_order.get("order_id")
    if not cf_order_id:
        return None

    # Check for existing processed transaction
    existing_txn = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.stripe_session_id == cf_order_id
    ).first()
    if existing_txn:
        return existing_txn

    order_tags = cf_order.get("order_tags") or {}
    cust_details = cf_order.get("customer_details") or {}
    user_id = order_tags.get("user_id") or cust_details.get("customer_id")
    plan_id = order_tags.get("plan_id") or "pro"
    billing_cycle = order_tags.get("billing_cycle") or "monthly"
    customer_email = cust_details.get("customer_email")

    user = None
    if user_id:
        try:
            user = db.query(models.User).filter(models.User.id == user_id).first()
        except Exception as e:
            logger.warning(f"Failed to query user by id {user_id}: {e}")

    if not user and customer_email:
        user = db.query(models.User).filter(models.User.email == customer_email).first()

    if not user:
        logger.error(f"Cannot associate Cashfree order {cf_order_id} with any user.")
        return None

    target_plan = PlanRegistry.get(plan_id)
    duration_days = 365 if billing_cycle.lower() == "annual" else 30

    # Apply subscription tier upgrade
    user.plan = target_plan.code
    user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)
    user.storage_limit = target_plan.storage_limit_bytes

    amount_val = float(cf_order.get("order_amount", 149.0))
    curr_val = (cf_order.get("order_currency") or "INR").lower()
    cf_id = str(cf_order.get("cf_order_id") or "")

    txn = models.PaymentTransaction(
        user_id=user.id,
        stripe_session_id=cf_order_id,
        payment_intent_id=f"cf_{cf_id}" if cf_id else None,
        plan_id=target_plan.code,
        billing_cycle=billing_cycle,
        amount=amount_val,
        currency=curr_val,
        status="succeeded",
        customer_email=customer_email or user.email,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    db.refresh(user)
    logger.info(f"Successfully upgraded user {user.email} to {target_plan.name} via Cashfree (Order: {cf_order_id})")

    # Send receipt invoice email
    try:
        expires_str = user.plan_expires_at.strftime("%B %d, %Y") if user.plan_expires_at else "Lifetime"
        user_name = getattr(user, "display_name", None) or getattr(user, "name", None) or user.email.split("@")[0]
        send_subscription_receipt_email(
            to_email=user.email,
            username=user_name,
            plan_name=target_plan.name,
            billing_cycle=billing_cycle,
            amount=amount_val,
            currency=curr_val,
            transaction_id=str(txn.id),
            stripe_session_id=cf_order_id,
            plan_expires_at=expires_str,
        )
    except Exception as em_err:
        logger.warning(f"Failed to dispatch subscription receipt email: {em_err}")

    return txn


@router.get("/session-status/{session_id}")
async def get_session_status(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetches verified checkout session status directly from Cashfree or Stripe API and upgrades user plan if completed.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="Invalid session ID.")

    # 1. CASHFREE ORDER STATUS
    if session_id.startswith("cowatch_") or not session_id.startswith("cs_"):
        if not is_cashfree_configured:
            raise HTTPException(status_code=500, detail="Cashfree is not configured.")

        cf_headers = {
            "x-client-id": cashfree_app_id,
            "x-client-secret": cashfree_secret_key,
            "x-api-version": cashfree_api_version,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"{cashfree_base_url}/orders/{session_id}", headers=cf_headers)

            if res.status_code != 200:
                logger.error(f"Failed to retrieve Cashfree order {session_id}: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=f"Cashfree order lookup failed: {res.text}")

            cf_order = res.json()
            order_status = cf_order.get("order_status", "ACTIVE")
            is_paid = (order_status == "PAID")

            txn = None
            if is_paid:
                txn = process_successful_cashfree_order(cf_order, db)
                db.refresh(current_user)

            order_tags = cf_order.get("order_tags") or {}
            plan_id = order_tags.get("plan_id", "pro")
            target_plan = PlanRegistry.get(plan_id)
            billing_cycle = order_tags.get("billing_cycle", "monthly")
            amount_val = float(cf_order.get("order_amount", 149.0))
            cust_details = cf_order.get("customer_details") or {}

            return {
                "session_id": session_id,
                "status": "complete" if is_paid else "pending",
                "payment_status": "paid" if is_paid else "unpaid",
                "amount_total": amount_val,
                "currency": (cf_order.get("order_currency") or "INR").upper(),
                "customer_email": cust_details.get("customer_email") or current_user.email,
                "payment_intent_id": str(cf_order.get("cf_order_id") or ""),
                "plan_id": plan_id,
                "plan_name": target_plan.name,
                "billing_cycle": billing_cycle,
                "transaction_id": txn.id if txn else None,
                "user_plan": current_user.plan,
                "plan_expires_at": current_user.plan_expires_at,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching Cashfree order status: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to retrieve Cashfree order: {str(e)}")

    # 2. STRIPE SESSION STATUS
    if not is_configured:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")

    try:
        session = stripe.checkout.Session.retrieve(
            session_id,
            expand=["payment_intent", "line_items"],
        )

        txn = None
        if session.payment_status == "paid" or session.status == "complete":
            txn = process_successful_payment(session, db)
            db.refresh(current_user)

        meta = get_session_metadata(session)
        plan_id = meta.get("plan_id", "pro")
        plan_name = meta.get("plan_name", "Pro")
        billing_cycle = meta.get("billing_cycle", "monthly")

        payment_intent = getattr(session, "payment_intent", None)
        pi_id = payment_intent if isinstance(payment_intent, str) else (
            getattr(payment_intent, "id", None) if payment_intent else None
        )

        cust_details = getattr(session, "customer_details", None)
        customer_email = getattr(cust_details, "email", None) if cust_details else None
        amount_total = getattr(session, "amount_total", None)

        return {
            "session_id": session.id,
            "status": getattr(session, "status", "complete"),
            "payment_status": getattr(session, "payment_status", "paid"),
            "amount_total": (amount_total / 100.0) if amount_total else None,
            "currency": (getattr(session, "currency", None) or "usd").upper(),
            "customer_email": customer_email,
            "payment_intent_id": pi_id,
            "plan_id": plan_id,
            "plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "transaction_id": txn.id if txn else None,
            "user_plan": current_user.plan,
            "plan_expires_at": current_user.plan_expires_at,
        }
    except Exception as e:
        logger.error(f"Error fetching Stripe session status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve Stripe session: {str(e)}")


@router.post("/cashfree/webhook")
async def cashfree_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Cashfree Webhook handler to listen for asynchronous payment completion events.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    event_type = body.get("type", "")
    data = body.get("data", {})
    order_data = data.get("order", {}) or {}

    logger.info(f"Received Cashfree webhook: {event_type}")

    if event_type == "PAYMENT_SUCCESS_WEBHOOK" or event_type == "ORDER_PAID_WEBHOOK":
        cf_order_id = order_data.get("order_id")
        if cf_order_id:
            # Re-verify directly from Cashfree API to ensure security
            cf_headers = {
                "x-client-id": cashfree_app_id,
                "x-client-secret": cashfree_secret_key,
                "x-api-version": cashfree_api_version,
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(f"{cashfree_base_url}/orders/{cf_order_id}", headers=cf_headers)
                if res.status_code == 200:
                    verified_order = res.json()
                    if verified_order.get("order_status") == "PAID":
                        process_successful_cashfree_order(verified_order, db)
            except Exception as err:
                logger.error(f"Error handling Cashfree webhook order {cf_order_id}: {err}")

    return {"status": "success"}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe Webhook handler to listen for asynchronous payment completion events.
    """
    payload_body = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = None
    if stripe_webhook_secret and stripe_webhook_secret != "whsec_test_placeholder" and sig_header:
        try:
            event = stripe.Webhook.construct_event(
                payload_body, sig_header, stripe_webhook_secret
            )
        except Exception as err:
            logger.error(f"Stripe webhook signature verification failed: {err}")
            raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature.")
    else:
        import json
        try:
            event = json.loads(payload_body)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event_type = event.get("type") if isinstance(event, dict) else getattr(event, "type", None)
    data_object = (event.get("data", {}).get("object", {}) if isinstance(event, dict) else getattr(getattr(event, "data", None), "object", None))

    logger.info(f"Received Stripe webhook event: {event_type}")

    if event_type == "checkout.session.completed":
        session_id = data_object.get("id") if isinstance(data_object, dict) else getattr(data_object, "id", None)
        if session_id:
            try:
                full_session = stripe.checkout.Session.retrieve(session_id, expand=["payment_intent"])
                process_successful_payment(full_session, db)
            except Exception as e:
                logger.error(f"Error processing webhook session completed: {e}")

    return {"status": "success", "received": event_type}


@router.get("/history", response_model=List[TransactionResponse])
async def get_payment_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetches the transaction history for the authenticated user.
    """
    transactions = (
        db.query(models.PaymentTransaction)
        .filter(models.PaymentTransaction.user_id == current_user.id)
        .order_by(models.PaymentTransaction.created_at.desc())
        .all()
    )
    return transactions
