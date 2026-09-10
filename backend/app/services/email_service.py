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

def send_video_ready_email(
    to_email: str,
    username: str,
    video_title: str,
    duration: float = 0.0,
    thumbnail_url: str = "",
    video_id: str = "",
    frontend_url: str = "https://cowatch-theta.vercel.app"
):
    """Send attractive, glassmorphic dark-mode email notifying user their uploaded video is processed and ready to stream."""
    subject = f"🎬 Your Video \"{video_title}\" is Ready to Stream on CoWatch!"
    
    # Format duration
    mins = int(duration // 60)
    secs = int(duration % 60)
    hrs = mins // 60
    mins = mins % 60
    if hrs > 0:
        duration_str = f"{hrs}h {mins}m {secs}s"
    else:
        duration_str = f"{mins}m {secs}s"

    action_url = f"{frontend_url.rstrip('/')}/create-stream?video_id={video_id}" if video_id else f"{frontend_url.rstrip('/')}/dashboard"
    
    thumbnail_html = ""
    if thumbnail_url:
        thumbnail_html = f"""
        <div style="margin: 20px 0; border-radius: 14px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.3); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <img src="{thumbnail_url}" alt="{video_title}" style="width: 100%; max-height: 260px; object-fit: cover; display: block;" />
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 40px 15px; background-color: #07070A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #0D0D12; border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(139, 92, 246, 0.25);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; background: radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.25) 0%, transparent 70%);">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #8B5CF6, #EC4899); width: 40px; height: 40px; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="color: #FFFFFF; font-size: 20px; line-height: 40px;">▶</span>
                  </td>
                  <td style="padding-left: 12px; text-align: left;">
                    <span style="font-size: 18px; font-weight: 800; color: #FFFFFF;">CoWatch</span><br>
                    <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #A78BFA;">Streaming Platform</span>
                  </td>
                </tr>
              </table>

              <div style="display: inline-block; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); padding: 5px 14px; border-radius: 50px; margin-bottom: 14px;">
                <span style="font-size: 10px; font-weight: 800; color: #4ADE80; text-transform: uppercase; letter-spacing: 1px;">✅ Transcoding Complete</span>
              </div>

              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #FFFFFF;">
                Your Video is Ready to Stream!
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.7);">
                Hey <strong>{username}</strong>, your uploaded video has been optimized into high-speed HLS segments and is now ready for synchronized watch parties.
              </p>
            </td>
          </tr>

          <!-- Video Details Card -->
          <tr>
            <td style="padding: 0 36px;">
              {thumbnail_html}

              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-top: 10px;">
                <div style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 8px;">
                  {video_title}
                </div>
                <div style="font-size: 12px; color: rgba(255, 255, 255, 0.5); line-height: 1.8;">
                  ⏱️ <strong>Duration:</strong> {duration_str}<br>
                  ⚡ <strong>Delivery:</strong> Multi-Bitrate HLS Master Stream<br>
                  🔒 <strong>Status:</strong> Ready for Live Synchronization
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 28px 36px 16px 36px; text-align: center;">
              <a href="{action_url}" style="display: inline-block; padding: 15px 36px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #FFFFFF !important; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); text-decoration: none; border-radius: 14px; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.45);">
                ▶ Host Watch Party Now
              </a>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: rgba(255, 255, 255, 0.4);">
                Or access this video anytime in your <a href="{frontend_url.rstrip('/')}/dashboard" style="color: #A78BFA; text-decoration: underline;">Dashboard</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(0, 0, 0, 0.3);">
              <p style="margin: 0; font-size: 10px; color: rgba(255, 255, 255, 0.3);">
                CoWatch Video Pipeline • Synchronized Movie Nights & Watch Parties
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return _send_html_email(to_email, subject, html)
