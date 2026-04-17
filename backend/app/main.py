import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.videos.routes import router as videos_router
from app.rooms.routes import router as rooms_router
from app.rooms.websockets import router as websockets_router
from app.collections.routes import router as collections_router
from app.user.routes import router as user_router
from app.auth.routes import router as auth_router

from app.middleware.limiter import limiter
from app.middleware.cache_control import CacheControlMiddleware

from config import HLS_OUTPUT_DIR
import mimetypes

# SQLAlchemy DB
from app.database.config import engine
from app.database import models

app = FastAPI()

# 🛡️ Global Exception Handlers
from fastapi.exceptions import RequestValidationError
import logging

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"VALIDATION ERROR payload: {exc.body}")
    logging.error(f"VALIDATION ERROR errors: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 🔌 Middlewares
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS","http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CacheControlMiddleware)

@app.get("/")
@limiter.limit("5/minute")
async def read_root(request: Request, response: Response):
     return {"Hello": "World"}


app.include_router(videos_router, prefix="/api/videos")
app.include_router(rooms_router, prefix="/api")
app.include_router(websockets_router) 
app.include_router(collections_router, prefix="/api")
app.include_router(user_router, prefix="/api/user")
app.include_router(auth_router, prefix="/api")

mimetypes.add_type("application/vnd.apple.mpegurl", ".m3u8")
mimetypes.add_type("video/mp2t", ".ts")

os.makedirs(HLS_OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.join("storage", "videos"), exist_ok=True)

# Initialize SQLAlchemy DB Schema
try:
    print(f"🔍 Connecting to database...")
    models.Base.metadata.create_all(bind=engine)
    db_host = engine.url.host
    is_supabase = "supabase.co" in (db_host or "")
    db_type = "Supabase (Cloud)" if is_supabase else "PostgreSQL (Local)"
    print(f"✅ Database connected successfully: {db_type}")
    print(f"📡 Host: {db_host}")
except Exception as e:
    print(f"❌ DATABASE CONNECTION ERROR: {e}")
    print(f"💡 Tip: Check your .env file and ensure SSL settings are correct for Supabase.")


app.mount("/output/videos", StaticFiles(directory=os.path.join("storage", "videos")), name="videos")
app.mount("/output", StaticFiles(directory=HLS_OUTPUT_DIR), name="output")

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Main server entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
