from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, BigInteger, Table, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database.config import Base
from sqlalchemy.sql import func
import uuid
from app.subscriptions.plans import DEFAULT_PLAN

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    display_name = Column(String, index=True)
    age = Column(Integer, nullable=True)
    genres = Column(JSON, default=[]) 
    theme = Column(String, default="default-dark")
    provider = Column(String, default="google")
    provider_id = Column(String)
    profile_picture = Column(String)
    storage_used = Column(BigInteger, default=0)
    storage_limit = Column(BigInteger, default=2 * 1024 ** 3)  # Free plan: 2 GB (enforced from plan config)
    plan = Column(String, default=DEFAULT_PLAN, nullable=False)  # free, pro, pro_plus, vibers
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)  # None = free or lifetime
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    videos = relationship("Video", back_populates="owner")
    collections = relationship("Collection", back_populates="owner")

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(String, unique=True, index=True, nullable=False) # For backward compatibility
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String)
    s3_key = Column(String, nullable=True)
    _stream_url = Column("stream_url", String, nullable=True)
    processing_status = Column(String, default="pending") # pending, processing, ready, failed

    @property
    def stream_url(self):
        if not self._stream_url:
            return None
        if self._stream_url.startswith("/output/videos/"):
            import os
            cdn_url = os.getenv("CDN_URL", "").strip()
            if not cdn_url.startswith(("http://", "https://")):
                cdn_url = "https://" + cdn_url
            parts = self._stream_url.split("/")
            if len(parts) >= 5:
                video_id = parts[3]
                return f"{cdn_url.rstrip('/')}/videos/{video_id}/stream.m3u8"
        return self._stream_url

    @stream_url.setter
    def stream_url(self, value):
        self._stream_url = value
    file_size = Column(BigInteger)
    duration = Column(Float)
    thumbnail_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="videos")
    rooms = relationship("Room", back_populates="video")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, unique=True, index=True, nullable=False) # Short persistent ID
    title = Column(String, nullable=True)
    host_id = Column(String, nullable=True) # Changed from UUID to String for guest support
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"))
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="SET NULL"), nullable=True)
    _stream_url = Column("stream_url", String, nullable=True) # Cached stream URL
    scheduled_time = Column(DateTime(timezone=True))
    media_type = Column(String, default="hls")
    video_url = Column(String, nullable=True)
    youtube_video_id = Column(String, nullable=True)

    @property
    def stream_url(self):
        if not self._stream_url:
            return None
        if self._stream_url.startswith("/output/videos/"):
            import os
            cdn_url = os.getenv("CDN_URL", "").strip()
            if not cdn_url.startswith(("http://", "https://")):
                cdn_url = "https://" + cdn_url
            parts = self._stream_url.split("/")
            if len(parts) >= 5:
                video_id = parts[3]
                return f"{cdn_url.rstrip('/')}/videos/{video_id}/stream.m3u8"
        return self._stream_url

    @stream_url.setter
    def stream_url(self, value):
        self._stream_url = value
    stream_status = Column(String, default="waiting") # waiting, live, paused, ended
    countdown_start = Column(DateTime(timezone=True))
    is_playing = Column(Boolean, default=False)
    offset = Column(Float, default=0.0)
    started_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    video = relationship("Video", back_populates="rooms")
    collection = relationship("Collection")

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="collections")
    videos = relationship("Video", secondary="collection_videos")

class CollectionVideo(Base):
    __tablename__ = "collection_videos"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"))
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"))

class Coupon(Base):
    """A code that grants a paid plan for free. Created by the owner and handed out."""
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    plan = Column(String, nullable=False)  # pro, pro_plus, vibers
    duration_days = Column(Integer, nullable=True)  # None = lifetime
    max_redemptions = Column(Integer, default=1)
    times_redeemed = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    redemptions = relationship("CouponRedemption", back_populates="coupon")

class CouponRedemption(Base):
    """Tracks who redeemed a coupon so the same user cannot reuse the same code."""
    __tablename__ = "coupon_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("coupon_id", "user_id", name="uq_coupon_user"),)

    coupon = relationship("Coupon", back_populates="redemptions")
