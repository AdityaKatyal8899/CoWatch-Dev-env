import os
from dotenv import load_dotenv

load_dotenv()

RTSP_URL = os.getenv("RTSP_URL", "rtsp://localhost:8554/mystream")
HLS_OUTPUT_DIR = os.path.abspath(os.environ.get("HLS_OUTPUT_DIR", os.path.join(os.path.dirname(__file__), "outputs")))
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME")
