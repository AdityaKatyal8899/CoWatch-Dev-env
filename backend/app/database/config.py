from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback/Legacy support
    DATABASE_URL = os.getenv("DB_URL")

if not DATABASE_URL:
    raise ValueError("ERROR: DATABASE_URL not found in .env. Please check your configuration.")

# Handle SSL requirements (Required for Supabase)
connect_args = {}
if "postgresql" in DATABASE_URL:
    # Detect if it's a remote connection (not localhost) to apply SSL
    is_local = any(x in DATABASE_URL for x in ["localhost", "127.0.0.1", "0.0.0.0"])
    if not is_local or "supabase.co" in DATABASE_URL:
        connect_args["sslmode"] = "require"
elif DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL, 
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
