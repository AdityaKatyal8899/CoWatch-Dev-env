from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware to ensure HLS manifest files (.m3u8) are never cached by the browser. 
    This prevents players from getting stuck on old segments.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        if request.url.path.endswith(".m3u8"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
        return response
