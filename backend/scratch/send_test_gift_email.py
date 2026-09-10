import os
import sys
from dotenv import load_dotenv

# Setup path so we can import from app
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.email_service import _send_html_email
from scratch.generate_vibers_gift_template import get_vibers_email_html

def send_test_gift_email(recipient_email: str):
    subject = "🎁 You've Been Gifted CoWatch Vibers VIP! (Test Verification)"
    
    html_content = get_vibers_email_html(
        friend_name="Aditya",
        sender_name="Aditya",
        coupon_code="VIBE-SAMPLE-PREVIEW-2026",
        duration_text="1 Month of Vibers VIP",
        redeem_url="https://cowatch-theta.vercel.app/settings"
    )
    
    print(f"Sending test gift email to {recipient_email}...")
    success = _send_html_email(recipient_email, subject, html_content)
    if success:
        print(f"[SUCCESS] Successfully delivered test email to {recipient_email}!")
    else:
        print(f"[FAILED] Failed to deliver email to {recipient_email}.")
    return success

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "adityakatyal8899@gmail.com"
    send_test_gift_email(target)
