from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.schemas import pydantic_model as schema
from app.database.models import User
from sqlalchemy.orm import Session
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
SECRET_KEY = os.getenv('JWT_SECRET')
ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt

def verify_token(token: str, db: Session, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")

        if user_id is None:

            raise credentials_exception

        try:
            user_id_uuid = uuid.UUID(user_id)
        except ValueError:

            raise credentials_exception

        # Verify token data structure
        token_data = schema.TokenData(user_id=str(user_id_uuid))

    except JWTError as e:

        raise credentials_exception

    user = db.query(User).filter(User.id == user_id_uuid).first()

    if user is None:

        raise credentials_exception
    
    return user
