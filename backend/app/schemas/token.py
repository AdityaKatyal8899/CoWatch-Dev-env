from pydantic import BaseModel, Field, field_validator
from typing import Optional

class TokenRequest(BaseModel):
    username: str = Field(..., min_length=1, description="LiveKit participant username/identity")
    room: str = Field(..., min_length=1, description="LiveKit Room name to join")
    user_id: Optional[str] = Field(None, description="Optional user ID (UUID string) for validation")

    @field_validator("username", "room")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        """Ensure inputs do not consist solely of whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or contain only whitespace.")
        return stripped

class TokenResponse(BaseModel):
    token: str = Field(..., description="LiveKit JWT signed access token")
    url: str = Field(..., description="LiveKit server WebSocket URL")
