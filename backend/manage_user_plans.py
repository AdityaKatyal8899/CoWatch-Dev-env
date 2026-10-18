"""
CLI script to inspect and manage user subscription plans in Supabase DB.
Usage:
    python manage_user_plans.py list
    python manage_user_plans.py downgrade <email>
    python manage_user_plans.py set <email> <free|pro|pro_plus|vibers>
"""

import sys
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load env variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("❌ Error: DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(db_url)

PLAN_STORAGE_LIMITS = {
    "free": 2 * 1024 * 1024 * 1024,        # 2 GB
    "pro": 10 * 1024 * 1024 * 1024,       # 10 GB
    "pro_plus": 20 * 1024 * 1024 * 1024,  # 20 GB
    "vibers": 50 * 1024 * 1024 * 1024,    # 50 GB
}


def list_users():
    with engine.connect() as conn:
        users = conn.execute(
            text("SELECT id, email, display_name, plan, plan_expires_at, storage_limit FROM users ORDER BY created_at DESC")
        ).fetchall()
        
        print("\n" + "=" * 80)
        print(f"{'Email':<32} {'Plan':<10} {'Expires At':<25} {'Storage'}")
        print("=" * 80)
        for u in users:
            uid, email, name, plan, exp, storage = u
            exp_str = exp.strftime("%Y-%m-%d %H:%M") if exp else "None (Free/Lifetime)"
            gb = round(storage / (1024 ** 3), 1) if storage else 0
            flag = "* " if plan != "free" else "  "
            print(f"{flag} {email:<30} {plan:<10} {exp_str:<25} {gb} GB")
        print("=" * 80 + "\n")


def set_user_plan(email: str, plan_name: str):
    plan_name = plan_name.lower().strip()
    if plan_name not in PLAN_STORAGE_LIMITS:
        print(f"❌ Invalid plan '{plan_name}'. Must be one of: {list(PLAN_STORAGE_LIMITS.keys())}")
        return

    storage = PLAN_STORAGE_LIMITS[plan_name]
    with engine.begin() as conn:
        res = conn.execute(
            text("SELECT id, email, plan FROM users WHERE LOWER(email) = LOWER(:email)"),
            {"email": email.strip()}
        ).first()

        if not res:
            print(f"❌ User with email '{email}' not found.")
            return

        conn.execute(
            text("""
                UPDATE users 
                SET plan = :plan, 
                    plan_expires_at = CASE WHEN :plan = 'free' THEN NULL ELSE plan_expires_at END,
                    storage_limit = :storage
                WHERE LOWER(email) = LOWER(:email)
            """),
            {"plan": plan_name, "storage": storage, "email": email.strip()}
        )
        print(f"✅ Successfully updated '{email}' to '{plan_name}' ({round(storage / (1024**3))} GB)!")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] == "list":
        list_users()
    elif sys.argv[1] == "downgrade" and len(sys.argv) >= 3:
        set_user_plan(sys.argv[2], "free")
    elif sys.argv[1] == "set" and len(sys.argv) >= 4:
        set_user_plan(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
