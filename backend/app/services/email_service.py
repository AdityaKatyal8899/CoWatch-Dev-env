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


def send_subscription_receipt_email(
    to_email: str,
    username: str,
    plan_name: str,
    billing_cycle: str,
    amount: float,
    currency: str = "USD",
    transaction_id: str = "",
    stripe_session_id: str = "",
    plan_expires_at: str = "",
    frontend_url: str = "https://cowatch-theta.vercel.app"
):
    """
    Delivers a luxury dark-themed subscription receipt email matching the CoWatch UI.
    """
    subject = f"🎉 Welcome to CoWatch {plan_name}! Your Subscription Receipt"
    plan_lower = plan_name.lower()

    # Plan theme colors
    if "vibers" in plan_lower:
        primary_color = "#8B5CF6"
        gradient = "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
        glow_color = "rgba(139, 92, 246, 0.35)"
        storage_text = "50 GB High-Speed Cloud Storage"
        quality_text = "2K Quad HD (1440p) Streaming"
        capacity_text = "Up to 500 Participants / Room"
        exclusive_feature = """
        <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 12px; padding: 14px; margin-top: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: #C4B5FD; margin-bottom: 4px;">🎨 Custom Gradient & Studio Mode Unlocked</div>
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">Design your own custom color palettes, CSS gradient glows, and vanity watch party aesthetics.</div>
        </div>
        """
    elif "pro+" in plan_lower or "pro_plus" in plan_lower:
        primary_color = "#EC4899"
        gradient = "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)"
        glow_color = "rgba(236, 72, 153, 0.35)"
        storage_text = "20 GB High-Speed Cloud Storage"
        quality_text = "1080p Full HD Video Streaming"
        capacity_text = "Up to 31 Participants / Room"
        exclusive_feature = ""
    else:
        primary_color = "#3B82F6"
        gradient = "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)"
        glow_color = "rgba(59, 130, 246, 0.35)"
        storage_text = "10 GB High-Speed Cloud Storage"
        quality_text = "1080p Full HD Video Streaming"
        capacity_text = "Up to 16 Participants / Room"
        exclusive_feature = ""

    action_url = f"{frontend_url.rstrip('/')}/dashboard"
    settings_url = f"{frontend_url.rstrip('/')}/settings"

    curr_upper = (currency or "USD").upper()
    curr_symbols = {"INR": "₹", "USD": "$", "GBP": "£", "EUR": "€", "JPY": "¥", "KRW": "₩"}
    symbol = curr_symbols.get(curr_upper, "$")
    if curr_upper in ["JPY", "KRW"]:
        formatted_amount = f"{symbol}{int(round(amount)):,} {curr_upper}"
    else:
        formatted_amount = f"{symbol}{amount:.2f} {curr_upper}"
    formatted_cycle = billing_cycle.capitalize()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 36px 12px; background-color: #07070A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: #0D0D12; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 60px -15px {glow_color};">
          
          <!-- Top Glow & Hero Header -->
          <tr>
            <td style="padding: 40px 36px 20px 36px; text-align: center; background: radial-gradient(circle at 50% 0%, {glow_color} 0%, transparent 75%);">
              
              <!-- CoWatch Logo Mark -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <td style="background: {gradient}; width: 44px; height: 44px; border-radius: 14px; text-align: center; vertical-align: middle; box-shadow: 0 8px 20px {glow_color};">
                    <span style="color: #FFFFFF; font-size: 22px; font-weight: 900; line-height: 44px;">▶</span>
                  </td>
                  <td style="padding-left: 14px; text-align: left;">
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF;">CoWatch</span><br>
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: {primary_color};">Subscription Activated</span>
                  </td>
                </tr>
              </table>

              <!-- Verified Status Badge -->
              <div style="display: inline-block; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 16px; border-radius: 50px; margin-bottom: 16px;">
                <span style="font-size: 11px; font-weight: 800; color: #34D399; text-transform: uppercase; letter-spacing: 1px;">
                  🛡️ Payment Verified & Active
                </span>
              </div>

              <!-- Main Title -->
              <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px;">
                Welcome to {plan_name}!
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.65);">
                Hey <strong>{username}</strong>, your payment was processed successfully. Your account has been upgraded with elevated streaming capabilities.
              </p>
            </td>
          </tr>

          <!-- Receipt & Invoice Table Box -->
          <tr>
            <td style="padding: 10px 36px 20px 36px;">
              <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 22px;">
                
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 12px; margin-bottom: 14px;">
                  <tr>
                    <td style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255, 255, 255, 0.8);">
                      🧾 Transaction Receipt
                    </td>
                    <td align="right" style="font-size: 11px; font-weight: 700; color: #34D399;">
                      ● PAID
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 2.1;">
                  <tr>
                    <td style="color: rgba(255, 255, 255, 0.5);">Plan Subscribed</td>
                    <td align="right" style="font-weight: 700; color: #FFFFFF;">{plan_name}</td>
                  </tr>
                  <tr>
                    <td style="color: rgba(255, 255, 255, 0.5);">Billing Interval</td>
                    <td align="right" style="font-weight: 600; color: #FFFFFF;">{formatted_cycle}</td>
                  </tr>
                  <tr>
                    <td style="color: rgba(255, 255, 255, 0.5);">Amount Paid</td>
                    <td align="right" style="font-weight: 800; color: #FFFFFF; font-size: 14px;">{formatted_amount}</td>
                  </tr>
                  {f'<tr><td style="color: rgba(255, 255, 255, 0.5);">Transaction ID</td><td align="right" style="font-family: monospace; font-size: 12px; color: rgba(255, 255, 255, 0.8);">#{transaction_id}</td></tr>' if transaction_id else ''}
                  {f'<tr><td style="color: rgba(255, 255, 255, 0.5);">Valid Until</td><td align="right" style="font-weight: 600; color: #A78BFA;">{plan_expires_at}</td></tr>' if plan_expires_at else ''}
                </table>

              </div>
            </td>
          </tr>

          <!-- Superpowers Unlocked Showcase -->
          <tr>
            <td style="padding: 0 36px 20px 36px;">
              <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 22px;">
                
                <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: {primary_color}; margin-bottom: 14px;">
                  ✨ Unlocked Superpowers
                </div>

                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 12px; color: rgba(255, 255, 255, 0.85); line-height: 2;">
                  <tr>
                    <td style="padding: 3px 0;">⚡ <strong>Quality:</strong> {quality_text}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0;">💾 <strong>Storage:</strong> {storage_text}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0;">🎙️ <strong>Voice:</strong> LiveKit Spatial Audio Channels</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0;">👥 <strong>Capacity:</strong> {capacity_text}</td>
                  </tr>
                </table>

                {exclusive_feature}
              </div>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding: 10px 36px 30px 36px; text-align: center;">
              <a href="{action_url}" style="display: inline-block; width: 80%; max-width: 380px; padding: 16px 24px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #FFFFFF !important; background: {gradient}; text-decoration: none; border-radius: 14px; box-shadow: 0 12px 30px {glow_color};">
                ▶ Jump Into Watch Parties
              </a>
              <p style="margin: 14px 0 0 0; font-size: 12px; color: rgba(255, 255, 255, 0.45);">
                Manage your subscription or profile anytime in <a href="{settings_url}" style="color: {primary_color}; text-decoration: underline;">Settings</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(0, 0, 0, 0.35);">
              <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.35); line-height: 1.5;">
                CoWatch Platform • Real-time Synchronized Video Streaming<br>
                This email confirms your official receipt for tax and subscription records.
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
