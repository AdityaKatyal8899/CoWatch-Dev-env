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

    print("Migration check completed.")
