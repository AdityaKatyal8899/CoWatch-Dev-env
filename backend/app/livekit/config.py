import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "ws://localhost:7880").strip().strip('"').strip("'")
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "devkey").strip().strip('"').strip("'")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "secret").strip().strip('"').strip("'")

    def validate(self) -> None:
        if not self.LIVEKIT_API_KEY or not self.LIVEKIT_API_SECRET:
            raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be configured.")

settings = Settings()
settings.validate()
