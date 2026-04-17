from google.oauth2 import id_token
from google.auth.transport import requests
import os
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

def verify_google_token(token: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    
    try:
        idinfo = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            client_id, 
            clock_skew_in_seconds=60
        )

        result = {
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "sub": idinfo.get("sub")
        }
        logger.info(f"Google User Extracted: {result}")
        # print(f"Google User Extracted: {result}")
        return result

    except ValueError as e:
        # Invalid token
        logger.error(f"Google token validation failed: {str(e)}")
        # print(f"Google token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
