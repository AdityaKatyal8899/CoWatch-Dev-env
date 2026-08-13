import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# Load configurations
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "CoWatch Safety")

def _send_html_email(to_email: str, subject: str, html_content: str):
    """Deliver email using SMTP client, falling back to log console in development."""
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning(
            f"[EMAIL SIMULATION] SMTP credentials unconfigured. Printing email details:\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Content: {html_content}\n"
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USERNAME}>"
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect and send
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=8) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, to_email, msg.as_string())
        
        logger.info(f"Successfully sent email notification to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to deliver SMTP email to {to_email}: {e}")
        return False

def _get_base_template(title: str, message_body: str):
    """Return common styled HTML template reflecting CoWatch's dark aesthetic."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{title}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #0B0B0F;
                color: #E5E7EB;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 550px;
                margin: 0 auto;
                background-color: #15151A;
                border: 1px solid #27272A;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }}
            .logo {{
                font-size: 22px;
                font-weight: 800;
                color: #8B5CF6;
                text-decoration: none;
                margin-bottom: 24px;
                display: inline-block;
            }}
            .title {{
                font-size: 20px;
                font-weight: 700;
                color: #FFFFFF;
                margin-bottom: 16px;
                border-bottom: 1px solid #27272A;
                padding-bottom: 12px;
            }}
            .body {{
                font-size: 14px;
                line-height: 1.6;
                color: #A1A1AA;
                margin-bottom: 24px;
            }}
            .warning {{
                background-color: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.2);
                border-radius: 8px;
                padding: 16px;
                color: #F87171;
                font-size: 13px;
                margin-bottom: 24px;
            }}
            .footer {{
                font-size: 11px;
                color: #52525B;
                text-align: center;
                border-top: 1px solid #27272A;
                padding-top: 16px;
                margin-top: 24px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">CoWatch</div>
            <div class="title">{title}</div>
            <div class="body">
                {message_body}
            </div>
            <div class="footer">
                This is an automated safety alert from CoWatch. Please do not reply to this email.
            </div>
        </div>
    </body>
    </html>
    """

def send_room_disbanded_email(to_email: str, room_title: str, reason: str):
    """Inform host that their room was closed by moderation."""
    subject = f"CoWatch Safety Notice: Room Disbanded"
    body = f"""
    <p>Hello,</p>
    <p>This is to inform you that your watch room <strong>"{room_title}"</strong> has been disbanded by our safety systems.</p>
    <div class="warning">
        <strong>Reason:</strong> {reason}
    </div>
    <p>Please review our Community Guidelines. Repeated violations of our policies will result in warnings or complete suspension of your account.</p>
    """
    html = _get_base_template(subject, body)
    return _send_html_email(to_email, subject, html)

def send_user_muted_email(to_email: str, room_title: str, reason: str):
    """Inform participant they were muted in a room chat."""
    subject = "CoWatch Safety Notice: Chat Permissions Restricted"
    body = f"""
    <p>Hello,</p>
    <p>Your chat permissions have been temporarily muted in the room <strong>"{room_title}"</strong>.</p>
    <div class="warning">
        <strong>Reason:</strong> {reason}
    </div>
    <p>Harassment, abusive language, or spamming is not tolerated in CoWatch. Please ensure your contributions remain respectful to other viewers.</p>
    """
    html = _get_base_template(subject, body)
    return _send_html_email(to_email, subject, html)

def send_user_warning_email(to_email: str, reason: str):
    """Send formal account warning letter."""
    subject = "CoWatch Safety Alert: Official Account Warning"
    body = f"""
    <p>Hello,</p>
    <p>We are issuing an official warning to your CoWatch account due to a violation of our terms.</p>
    <div class="warning">
        <strong>Violation Details:</strong> {reason}
    </div>
    <p>Please note that any further violations will result in the immediate and permanent ban of your account and all associated data.</p>
    """
    html = _get_base_template(subject, body)
    return _send_html_email(to_email, subject, html)

def send_user_ban_email(to_email: str, reason: str):
    """Send formal account ban letter."""
    subject = "CoWatch Safety Alert: Account Terminated"
    body = f"""
    <p>Hello,</p>
    <p>This is to inform you that your CoWatch account has been **permanently terminated** due to severe or repeated violations of our Community Guidelines.</p>
    <div class="warning">
        <strong>Reason for Termination:</strong> {reason}
    </div>
    <p>All active sessions have been invalidated, and you will no longer be permitted to log in or host rooms. If you believe this action was taken in error, you may submit an appeal using the support portal.</p>
    """
    html = _get_base_template(subject, body)
    return _send_html_email(to_email, subject, html)
