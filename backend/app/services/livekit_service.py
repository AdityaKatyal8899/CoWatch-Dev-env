from livekit import api
from app.livekit.config import settings

class LiveKitService:
    """
    Service layer encapsulating interactions with LiveKit's token system.
    """
    def __init__(self) -> None:
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.livekit_url = settings.LIVEKIT_URL

    def generate_room_token(self, identity: str, name: str, room_name: str, is_host: bool = False) -> str:
        """
        Generates a token with unique identity, display name, and permissions.
        Hosts are granted room_admin rights.
        """
        grants = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,      # Essential to talk
            can_subscribe=True,    # Essential to hear others
            can_publish_data=True, # Optional, useful for real-time control events
            room_admin=is_host     # Propagate host permissions into LiveKit grants
        )
        
        token = (
            api.AccessToken(self.api_key, self.api_secret)
            .with_identity(identity)
            .with_name(name)
            .with_grants(grants)
            .to_jwt()
        )
        
        return token


#Docker command to start livekit server (In production)
#docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS: "${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}" livekit/livekit-server:latest --dev --node-ip 127.0.0.1

#Docker command to start livekit server (Locally)
#docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server:latest --dev --node-ip 127.0.0.1
