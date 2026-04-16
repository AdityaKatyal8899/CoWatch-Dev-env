import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize the limiter
# key_func determines how to identify users (by IP address in this case)
# storage_uri determines where to store the hits (memory for now, can be Redis)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    strategy="fixed-window",
    headers_enabled=True,
)
