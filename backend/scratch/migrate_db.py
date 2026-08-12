import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env variables from backend directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    db_url = os.getenv("DB_URL")

print(f"Connecting to database: {db_url}")

engine = create_engine(db_url)

with engine.connect() as conn:
    # Check current columns in rooms table
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'rooms';
    """))
    existing_columns = [row[0] for row in result.fetchall()]
    print(f"Existing columns in 'rooms': {existing_columns}")

    # Add media_type if not exists
    if "media_type" not in existing_columns:
        print("Adding 'media_type' column...")
        conn.execute(text("ALTER TABLE rooms ADD COLUMN media_type VARCHAR DEFAULT 'hls';"))
        conn.commit()
        print("'media_type' column added successfully.")

    # Add video_url if not exists
    if "video_url" not in existing_columns:
        print("Adding 'video_url' column...")
        conn.execute(text("ALTER TABLE rooms ADD COLUMN video_url VARCHAR;"))
        conn.commit()
        print("'video_url' column added successfully.")

    # Add youtube_video_id if not exists
    if "youtube_video_id" not in existing_columns:
        print("Adding 'youtube_video_id' column...")
        conn.execute(text("ALTER TABLE rooms ADD COLUMN youtube_video_id VARCHAR;"))
        conn.commit()
        print("'youtube_video_id' column added successfully.")

    # Add collection_id if not exists (collection-bound rooms / in-room playlist switching)
    if "collection_id" not in existing_columns:
        print("Adding 'collection_id' column...")
        conn.execute(text("ALTER TABLE rooms ADD COLUMN collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL;"))
        conn.commit()
        print("'collection_id' column added successfully.")

    # Check current columns in users table
    result = conn.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users';
    """))
    existing_columns = [row[0] for row in result.fetchall()]
    print(f"Existing columns in 'users': {existing_columns}")

    # Add plan column if not exists (subscriptions)
    if "plan" not in existing_columns:
        print("Adding 'plan' column...")
        conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR DEFAULT 'free' NOT NULL;"))
        conn.commit()
        print("'plan' column added successfully.")

    # Add plan_expires_at column if not exists (coupon/expiry grants)
    if "plan_expires_at" not in existing_columns:
        print("Adding 'plan_expires_at' column...")
        conn.execute(text("ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMPTZ;"))
        conn.commit()
        print("'plan_expires_at' column added successfully.")

    # --- Moderation / age-verification columns on users ---
    user_mod_cols = {
        "date_of_birth": "DATE",
        "age_verified": "BOOLEAN NOT NULL DEFAULT FALSE",
        "age_verification_method": "VARCHAR(32) NOT NULL DEFAULT 'none'",
        "terms_accepted_at": "TIMESTAMPTZ",
        "is_banned": "BOOLEAN NOT NULL DEFAULT FALSE",
        "banned_reason": "VARCHAR",
    }
    for col, ddl in user_mod_cols.items():
        if col not in existing_columns:
            print(f"Adding 'users.{col}' column...")
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {ddl};"))
            conn.commit()
            print(f"'users.{col}' column added successfully.")

    # --- Moderation columns on rooms ---
    result = conn.execute(text("""
        SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms';
    """))
    room_columns = [row[0] for row in result.fetchall()]

    room_mod_cols = {
        "is_adult": "BOOLEAN NOT NULL DEFAULT FALSE",
        "status": "VARCHAR(32) NOT NULL DEFAULT 'active'",
    }
    for col, ddl in room_mod_cols.items():
        if col not in room_columns:
            print(f"Adding 'rooms.{col}' column...")
            conn.execute(text(f"ALTER TABLE rooms ADD COLUMN {col} {ddl};"))
            conn.commit()
            print(f"'rooms.{col}' column added successfully.")

    # New moderation tables (moderation_warnings, moderation_reports, moderation_appeals)
    # are auto-created by models.Base.metadata.create_all on backend startup (run on
    # Windows / your deployment). No manual DDL needed here.

    print("Migration check completed.")
