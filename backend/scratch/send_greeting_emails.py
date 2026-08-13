import os
import sys
from dotenv import load_dotenv

# Setup path so we can import from app
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database.config import SessionLocal
from app.database import models
from app.services.email_service import _send_html_email, _get_base_template

def send_greeting_email(to_email: str, username: str):
    subject = "Welcome to CoWatch Mail Services!"
    body = f"""
    <p>Hello {username},</p>
    <p>We are excited to let you know that <strong>CoWatch</strong> has officially launched its automated mail notification service!</p>
    <p>From now on, you will receive important security alerts, room updates, and system notifications directly to your inbox. This helps us ensure that CoWatch remains a safe, fun, and reliable place for you to host and watch videos with your friends.</p>
    <p>If you have any questions or feedback, feel free to reply directly to this mail or reach out to our team.</p>
    <p>Thank you for being part of the CoWatch community!</p>
    <p>Best regards,<br><strong>The CoWatch Team</strong></p>
    """
    html = _get_base_template(subject, body)
    return _send_html_email(to_email, subject, html)

def main():
    print("=" * 60)
    print("      COWATCH GREETING EMAIL BROADCASTER (ONE-OFF)      ")
    print("=" * 60)

    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        valid_users = [u for u in users if u.email and "@" in u.email]
        
        print(f"Found {len(users)} registered users ({len(valid_users)} with valid email addresses).")
        confirm = input("Do you want to send the greeting email to ALL valid users? (y/n): ").strip().lower()
        if confirm != 'y':
            print("Cancelled.")
            return

        sent_count = 0
        for user in valid_users:
            print(f"Sending greeting email to {user.name} ({user.email})...")
            success = send_greeting_email(user.email, user.name)
            if success:
                sent_count += 1
                print(" -> Sent successfully!")
            else:
                print(" -> FAILED to send!")

        print(f"\nDone! Successfully sent greeting emails to {sent_count} users.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
