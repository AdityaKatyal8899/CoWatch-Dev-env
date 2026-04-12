from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.database.config import get_db
from app.database.models import User
from app.auth.google import verify_google_token
from app.auth.jwt import create_access_token
from app.auth.oauth2 import get_current_user
from app.schemas import pydantic_model as schema
from app.middleware.limiter import limiter
from pydantic import BaseModel

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

class GoogleTokenRequest(BaseModel):
    id_token: str

@router.post("/google")
@limiter.limit("5/minute")
def google_auth(request: Request, response: Response, token_req: GoogleTokenRequest, db: Session = Depends(get_db)):
    google_user = verify_google_token(token_req.id_token)

    email = google_user.get("email")
    name = google_user.get("name")
    picture = google_user.get("picture")
    provider_id = google_user.get("sub")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create new user
        user = User(
            email=email,
            name=name,
            profile_picture=picture,
            provider="google",
            provider_id=provider_id
        )
        db.add(user)
    else:
        # Update existing user profile
        user.name = name
        user.profile_picture = picture
        user.provider_id = provider_id
    
    db.commit()
    db.refresh(user)

    # 3. Generate CoWatch JWT
    access_token = create_access_token(data={"sub": str(user.id)})
    
    user_schema = schema.UserSchema.model_validate(user) if hasattr(schema.UserSchema, 'model_validate') else schema.UserSchema.from_orm(user)
    user_data = user_schema.model_dump() if hasattr(user_schema, 'model_dump') else user_schema.dict()
    
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}

@router.get("/me", response_model=schema.UserSchema)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
