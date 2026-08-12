import os
import time
import uuid
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
import razorpay
import requests

from app.database.config import get_db
from app.database import models
from app.auth.oauth2 import get_current_user
from app.subscriptions.plans import get_plan_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

# Fallback USD to INR conversion multiplier in case of API failure
FALLBACK_USD_TO_INR = 83.0

def get_usd_to_inr_rate() -> float:
    """Retrieve dynamic exchange rate from a public keyless API with a robust fallback."""
    try:
        response = requests.get("https://open.er-api.com/v6/latest/USD", timeout=4)
        if response.status_code == 200:
            data = response.json()
            rate = data.get("rates", {}).get("INR")
            if rate:
                logger.info(f"Fetched live USD to INR exchange rate: {rate}")
                return float(rate)
    except Exception as e:
        logger.warning(f"Failed to fetch live exchange rate: {e}. Using fallback {FALLBACK_USD_TO_INR}.")
    return FALLBACK_USD_TO_INR

class OrderCreateRequest(BaseModel):
    plan_id: str  # pro | pro_plus
    billing: str  # monthly | annual

class OrderCreateResponse(BaseModel):
    order_id: str
    amount: int
    currency: str

class PaymentVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan_id: str
    billing: str

def get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay API credentials not configured in backend environment."
        )
    return razorpay.Client(auth=(key_id, key_secret))

@router.post("/create-order", response_model=OrderCreateResponse)
async def create_order(
    payload: OrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    plan_id = payload.plan_id.strip().lower()
    billing = payload.billing.strip().lower()

    if plan_id not in ["pro", "pro_plus"]:
        raise HTTPException(status_code=400, detail="Only Pro and Pro+ plans can be purchased via checkout.")

    # Determine amount in USD based on plans structure
    if plan_id == "pro":
        usd_amount = 1.99 if billing == "monthly" else 19.00
    else:  # pro_plus
        usd_amount = 5.99 if billing == "monthly" else 59.00

    # Retrieve dynamic exchange rate and convert to Paise (INR)
    live_rate = get_usd_to_inr_rate()
    amount_in_paise = int(usd_amount * live_rate * 100)

    try:
        client = get_razorpay_client()
        order_data = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"receipt_usr_{str(current_user.id)[:8]}_{int(time.time())}",
            "payment_capture": 1
        }
        order = client.order.create(data=order_data)
        return OrderCreateResponse(
            order_id=order["id"],
            amount=order["amount"],
            currency=order["currency"]
        )
    except Exception as e:
        logger.error(f"Failed to create Razorpay order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize payment gateway: {str(e)}")

@router.post("/verify-payment")
async def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        client = get_razorpay_client()
        params_dict = {
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature
        }
        
        # Verify the signature
        client.utility.verify_payment_signature(params_dict)
    except Exception as e:
        logger.error(f"Razorpay signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid payment signature. Payment verification failed.")

    # Update user plan status
    plan_id = payload.plan_id.strip().lower()
    billing = payload.billing.strip().lower()
    duration_days = 30 if billing == "monthly" else 365

    try:
        # Save subscription details
        current_user.plan = plan_id
        current_user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)
        current_user.storage_limit = get_plan_config(plan_id)["storage_limit"]
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "success": True,
            "plan": current_user.plan,
            "plan_expires_at": current_user.plan_expires_at,
            "message": f"Successfully subscribed to {plan_id.upper()}!"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating user plan: {e}")
        raise HTTPException(status_code=500, detail="Payment verified, but failed to update user profile plan.")
