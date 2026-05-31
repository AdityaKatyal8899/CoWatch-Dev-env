import sys
import os
# Ensure backend directory is in python search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure UTF-8 for CLI encoding in Windows
os.environ["PYTHONIOENCODING"] = "utf-8"

from fastapi.testclient import TestClient
from app.main import app
from app.database.config import SessionLocal
from app.database import models

client = TestClient(app)

def test_token_endpoint():
    print("Connecting to database...")
    db = SessionLocal()
    test_room_id = "testroom"
    
    # Clean up existing test room if present
    existing = db.query(models.Room).filter(models.Room.room_id == test_room_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        
    # 1. Insert a mock room
    room = models.Room(
        room_id=test_room_id,
        title="Test LiveKit Room",
        host_id="test-host-id",
        stream_url="http://example.com/stream.m3u8",
        stream_status="waiting",
        is_playing=False
    )
    db.add(room)
    db.commit()
    print("✓ Created mock room 'testroom' in database.")
    
    try:
        # 2. Send token generation POST request (as Host to test permissions)
        payload = {
            "username": "Aditya",
            "room": test_room_id,
            "user_id": "test-host-id"
        }
        print(f"Sending request to /api/livekit/token with payload: {payload}")
        response = client.post("/api/livekit/token", json=payload)
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "token" in data, "Token missing in response"
        assert "url" in data, "URL missing in response"
        print("✓ Successfully fetched LiveKit JWT token!")
        print(f"JWT Token (truncated): {data['token'][:70]}...")
        print(f"LiveKit URL: {data['url']}")
        
    finally:
        # 3. Clean up the database
        db.delete(room)
        db.commit()
        db.close()
        print("✓ Cleaned up mock room from database.")

if __name__ == "__main__":
    test_token_endpoint()
