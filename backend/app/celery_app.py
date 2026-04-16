from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

redis_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "co-watch",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enabled_utc=True,
)

celery_app.autodiscover_tasks(['app.streaming'], related_name='hls_worker')

# celery -A app.celery_app worker --loglevel=info --pool=solo
