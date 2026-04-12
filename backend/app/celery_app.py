from celery import Celery

celery_app = Celery(
    "co-watch",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
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
