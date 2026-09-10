import os
import sys
import secrets
import string
from dotenv import load_dotenv

# Setup path so we can import from app
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database.config import SessionLocal
from app.database import models
from app.services.email_service import _send_html_email
from scratch.generate_vibers_gift_template import get_vibers_email_html, get_vibers_chat_markdown

RECIPIENTS = [
    {
        "name": "Paras Thakur",
        "email": "parasthakur19012006@gmail.com",
        "code_prefix": "VIBE-PARAS"
    },
    {
        "name": "Ayush Singh",
        "email": "ayushsingh8279@gmail.com",
        "code_prefix": "VIBE-AYUSH"
    }
]

def generate_unique_code(db, prefix: str) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        suffix = "".join(secrets.choice(alphabet) for _ in range(4))
        code = f"{prefix}-{suffix}"
        existing = db.query(models.Coupon).filter(models.Coupon.code == code).first()
        if not existing:
            return code
    return f"{prefix}-{secrets.token_hex(2).upper()}"

def main():
    print("=" * 65)
    print("      COWATCH VIBERS VIP - GIFT COUPON CREATOR & SENDER      ")
    print("=" * 65)

    db = SessionLocal()
    results = []

    try:
        for recipient in RECIPIENTS:
            name = recipient["name"]
            email = recipient["email"]
            prefix = recipient["code_prefix"]

            # Generate new coupon in database
            code = generate_unique_code(db, prefix)
            coupon = models.Coupon(
                code=code,
                plan="vibers",
                duration_days=30,
                max_redemptions=1,
                times_redeemed=0,
                active=True,
                created_by="adityakatyal8899@gmail.com"
            )
            db.add(coupon)
            db.commit()
            db.refresh(coupon)

            print(f"[COUPON CREATED] Code: {code} | Plan: Vibers (30 Days) | Max Redemptions: 1")

            # Render HTML Email
            subject = f"🎁 You've Received CoWatch Vibers VIP from Aditya!"
            html_content = get_vibers_email_html(
                friend_name=name,
                sender_name="Aditya",
                coupon_code=code,
                duration_text="1 Month of Vibers VIP",
                redeem_url="https://cowatch-theta.vercel.app/settings"
            )

            # Send Email
            print(f"[SENDING] Delivering gift email to {name} <{email}>...")
            sent = _send_html_email(email, subject, html_content)

            chat_msg = get_vibers_chat_markdown(
                friend_name=name,
                sender_name="Aditya",
                coupon_code=code,
                duration_text="1 Month of Vibers VIP",
                redeem_url="https://cowatch-theta.vercel.app/settings"
            )

            results.append({
                "name": name,
                "email": email,
                "code": code,
                "sent": sent,
                "chat_msg": chat_msg
            })

            if sent:
                print(f"[SUCCESS] Gift email successfully delivered to {email}!")
            else:
                print(f"[FAILED] Could not send email to {email}.")

        print("\n" + "=" * 65)
        print("                   DISPATCH SUMMARY                   ")
        print("=" * 65)
        for r in results:
            status = "DELIVERED" if r["sent"] else "FAILED"
            print(f"Recipient: {r['name']} ({r['email']})")
            print(f"Coupon Code: {r['code']}")
            print(f"Email Status: {status}")
            print("-" * 65)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Transaction failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
