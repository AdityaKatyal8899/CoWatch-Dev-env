from google.oauth2 import id_token
from google.auth.transport import requests
import os
import requests as http_requests
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
        logger.info(f"Google User Extracted via ID Token: {result}")
        return result

    except ValueError as e:
        logger.error(f"Google token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def verify_google_access_token(access_token: str):
    """
    Verifies the access token by querying Google's userinfo endpoint.
    """
    try:
        url = "https://www.googleapis.com/oauth2/v3/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = http_requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            raise ValueError(f"Failed to fetch userinfo: {response.text}")
            
        userinfo = response.json()
        result = {
            "email": userinfo.get("email"),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
            "sub": userinfo.get("sub")
        }
        logger.info(f"Google User Extracted via Access Token: {result}")
        return result
    except Exception as e:
        logger.error(f"Google access token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google access token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def fetch_google_birthday(access_token: str) -> str | None:
    """
    Queries Google People API to retrieve the user's birthday.
    Returns date in 'YYYY-MM-DD' format or None.
    """
    try:
        url = "https://people.googleapis.com/v1/people/me?personFields=birthdays"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = http_requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            birthdays = data.get("birthdays", [])
            for entry in birthdays:
                date_info = entry.get("date", {})
                year = date_info.get("year")
                month = date_info.get("month")
                day = date_info.get("day")
                if month and day:
                    # Google might not return a year if the user hides it; default to a placeholder
                    year = year or 1900
                    return f"{year:04d}-{month:02d}-{day:02d}"
        else:
            logger.warning(f"Google People API returned {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Failed to fetch Google birthday: {str(e)}")
    return None
