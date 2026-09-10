"""
Generator for Vibers VIP Gift Invitation Emails and Messages.
Produces responsive, glassmorphic dark-mode HTML email templates
and rich markdown/chat templates for gifting Vibers subscriptions.
"""

def get_vibers_email_html(
    friend_name: str = "{{FRIEND_NAME}}",
    sender_name: str = "Aditya",
    coupon_code: str = "{{COUPON_CODE}}",
    duration_text: str = "1 Month of Vibers VIP",
    redeem_url: str = "http://localhost:3000/settings"
) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Gifted CoWatch Vibers VIP!</title>
  <style>
    /* Reset & Base */
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }}
    body {{
      margin: 0;
      padding: 0;
      width: 100% !important;
      height: 100% !important;
      background-color: #07070A;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #FFFFFF;
    }}
    .email-container {{
      max-width: 600px;
      margin: 0 auto;
      background: #0D0D12;
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(139, 92, 246, 0.25);
    }}
    .gradient-text {{
      background: linear-gradient(135deg, #A855F7 0%, #EC4899 50%, #3B82F6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .button {{
      display: inline-block;
      padding: 16px 36px;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #FFFFFF !important;
      background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
      text-decoration: none;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.5);
    }}
    .feature-card {{
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
    }}
    .coupon-box {{
      background: rgba(139, 92, 246, 0.1);
      border: 2px dashed rgba(168, 85, 247, 0.4);
      border-radius: 18px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }}
  </style>
</head>
<body style="margin: 0; padding: 40px 15px; background-color: #07070A;">

  <!-- Main Container -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #0D0D12; border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 24px; overflow: hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.25) 0%, transparent 70%);">
              
              <!-- Brand Logo & Badge -->
              <div style="margin-bottom: 20px;">
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #8B5CF6, #EC4899); width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle;">
                      <span style="color: #FFFFFF; font-size: 22px; line-height: 44px;">▶</span>
                    </td>
                    <td style="padding-left: 12px; text-align: left;">
                      <span style="font-size: 18px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">CoWatch</span><br>
                      <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #A78BFA;">VIP Stream Club</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Gift Pill -->
              <div style="display: inline-block; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); padding: 6px 16px; border-radius: 50px; margin-bottom: 18px;">
                <span style="font-size: 11px; font-weight: 800; color: #F472B6; text-transform: uppercase; letter-spacing: 1px;">🎁 Special VIP Gift from {sender_name}</span>
              </div>

              <!-- Main Title -->
              <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 900; line-height: 1.25; color: #FFFFFF; letter-spacing: -0.5px;">
                You've Received <span style="background: linear-gradient(135deg, #A855F7, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #C084FC;">Vibers VIP</span> Access!
              </h1>
              
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.7);">
                Hey <strong>{friend_name}</strong>! {sender_name} just gifted you an exclusive <span style="color: #C084FC; font-weight: 600;">{duration_text}</span> on CoWatch. Elevate your watch parties with ultra-high quality, bespoke gradients, and unlimited vibes.
              </p>
            </td>
          </tr>

          <!-- Coupon Code Highlight Section -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(236, 72, 153, 0.12)); border: 2px dashed rgba(168, 85, 247, 0.5); border-radius: 20px; padding: 26px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #C084FC;">
                      Your Unique Gift Voucher Code
                    </p>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 900; letter-spacing: 4px; color: #FFFFFF; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.15); padding: 14px 20px; border-radius: 12px; display: inline-block; margin: 8px 0 12px 0;">
                      {coupon_code}
                    </div>
                    <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.5);">
                      Single-use voucher • Unlocks all Vibers flagship features instantly
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 28px 40px 10px 40px; text-align: center;">
              <a href="{redeem_url}" class="button" style="display: inline-block; padding: 16px 40px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #FFFFFF !important; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); text-decoration: none; border-radius: 14px; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.45);">
                ✨ Redeem My Gift Voucher
              </a>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: rgba(255, 255, 255, 0.4);">
                Or enter this code in <strong>Settings ➔ Redeem Coupon</strong>
              </p>
            </td>
          </tr>

          <!-- Unlocked Vibers Features Grid -->
          <tr>
            <td style="padding: 30px 40px 10px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255, 255, 255, 0.4); text-align: center;">
                Exclusive Perks You're Unlocking:
              </p>
              
              <!-- Feature 1 -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px;">
                <tr>
                  <td width="36" valign="middle" style="font-size: 20px;">🎨</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #FFFFFF;">Bespoke Color Palette & Dual-Gradient Studio</div>
                    <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">Design custom linear or radial themes that illuminate your entire CoWatch UI.</div>
                  </td>
                </tr>
              </table>

              <!-- Feature 2 -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px;">
                <tr>
                  <td width="36" valign="middle" style="font-size: 20px;">🎬</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #FFFFFF;">4K Ultra-HD Stream Master Quality</div>
                    <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">Crystal-clear 2160p stream sync with 50 GB storage & 50 transcoding hours/mo.</div>
                  </td>
                </tr>
              </table>

              <!-- Feature 3 -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px;">
                <tr>
                  <td width="36" valign="middle" style="font-size: 20px;">🎙️</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #FFFFFF;">Unlimited Voice Rooms & Collections</div>
                    <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">Real-time spatial voice chat, custom video series, and massive party limits.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- How to Redeem Steps -->
          <tr>
            <td style="padding: 20px 40px 30px 40px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.15); border-radius: 16px; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #C084FC; margin-bottom: 10px;">
                      📋 How to Activate in 3 Easy Steps:
                    </div>
                    <ol style="margin: 0; padding-left: 18px; font-size: 12px; color: rgba(255, 255, 255, 0.7); line-height: 1.8;">
                      <li>Head to <a href="{redeem_url}" style="color: #EC4899; text-decoration: underline;">CoWatch Settings</a></li>
                      <li>Find the <strong>Redeem Coupon</strong> card on the right</li>
                      <li>Paste your code <code style="color: #A78BFA; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px;">{coupon_code}</code> and click <strong>Apply</strong>!</li>
                    </ol>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(0, 0, 0, 0.3);">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: rgba(255, 255, 255, 0.4);">
                Sent with ❤️ by {sender_name} via <strong>CoWatch Synchronized Streams</strong>.
              </p>
              <p style="margin: 0; font-size: 10px; color: rgba(255, 255, 255, 0.2);">
                Enjoy your shared movie nights and synchronized streaming!
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

def get_vibers_chat_markdown(
    friend_name: str = "Friend",
    sender_name: str = "Aditya",
    coupon_code: str = "XXXX-XXXX",
    duration_text: str = "1 Month of Vibers VIP",
    redeem_url: str = "http://localhost:3000/settings"
) -> str:
    return f"""🎁 **YOU’VE RECEIVED A COWATCH VIBERS VIP GIFT!** 👑

Hey **{friend_name}**! {sender_name} just gifted you an exclusive **{duration_text}** on CoWatch!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎟️ **YOUR VOUCHER CODE:**
`{coupon_code}`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ **WHAT YOU UNLOCK IMMEDIATELY:**
• 🎨 **Bespoke Color & Dual-Gradient Studio** — Design custom themes that illuminate the entire platform!
• 🎬 **4K Ultra-HD Stream Quality (2160p)** — Zero buffering with high-speed sync.
• 🎙️ **Real-Time Voice Chat** — Talk live with friends during watch parties.
• 📁 **Custom Video Collections** — Organize shows, anime, and movie series.
• 🚀 **50 GB Storage & 50 Video Processing Hours / mo** — Host big watch parties without limits.

👉 **HOW TO REDEEM:**
1. Open your **CoWatch Settings**: {redeem_url}
2. Find the **Redeem Coupon** box on the right.
3. Paste `{coupon_code}` and hit **Apply**!

Enjoy the movie night vibes! 🍿🎉"""

if __name__ == "__main__":
    html_preview = get_vibers_email_html(
        friend_name="Alex",
        sender_name="Aditya",
        coupon_code="VIBE-2026",
        duration_text="1 Month of Vibers VIP"
    )
    with open("c:/Users/AdityaJi/OneDrive/Desktop/Stream/backend/scratch/vibers_gift_template_preview.html", "w", encoding="utf-8") as f:
        f.write(html_preview)
    print("Template generated successfully!")
