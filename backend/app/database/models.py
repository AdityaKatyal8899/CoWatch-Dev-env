from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Float, BigInteger, Table, JSON, UniqueConstraint
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
    # --- Moderation / age verification ---
    date_of_birth = Column(Date, nullable=True)  # captured at onboarding; source of truth for age gate
    age_verified = Column(Boolean, default=False, nullable=False)  # True once DOB proves >= 18
    age_verification_method = Column(String, default="none", nullable=False)  # none | self_declared | google | kyc
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)  # NULL = terms not yet accepted
    is_banned = Column(Boolean, default=False, nullable=False)  # set by Tier 1 / appeal-denied enforcement
    banned_reason = Column(String, nullable=True)
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

    # --- Moderation ---
    is_adult = Column(Boolean, default=False, nullable=False)  # host-flagged 18+ room (age gate applies)
    status = Column(String, default="active", nullable=False)  # active | cancelled (moderation auto-cancel)

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


class ModerationWarning(Base):
    """A warning issued to a user (e.g., hosting an unflagged adult room)."""
    __tablename__ = "moderation_warnings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=True)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ModerationReport(Base):
    """A user/submission report (Tier 2/3/4). Triaged via the review queue."""
    __tablename__ = "moderation_reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = Column(String, nullable=False)  # room | user | message
    target_id = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, default="open", nullable=False)  # open | reviewed | dismissed | actioned
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ModerationAppeal(Base):
    """An appeal against a warning or ban (excluding confirmed Tier 1)."""
    __tablename__ = "moderation_appeals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = Column(String, nullable=False)  # warning | report | ban
    target_id = Column(String, nullable=False)
    text = Column(String, nullable=True)
    status = Column(String, default="open", nullable=False)  # open | approved | denied
    created_at = Column(DateTime(timezone=True), server_default=func.now())
