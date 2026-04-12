import boto3
import os
import uuid
from typing import Dict, Optional
from botocore.config import Config
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from absolute path
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

BUCKET = os.getenv("AWS_BUCKET_NAME")

if not BUCKET:
    raise RuntimeError("AWS_BUCKET_NAME not configured")

def get_s3_client():
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"}
        )
    )

def gen_presigned_url(object_key: str, expiration: int = 3600) -> str:
    s3 = get_s3_client()
    url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": BUCKET,
            "Key": object_key,
        },
        ExpiresIn=expiration,
    )
    return url

def generate_upload_url(user_id: str, file_type: str) -> Dict:
    ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
    if file_type not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported file type: {file_type}. Supported: {ALLOWED_TYPES}")

    ext = file_type.split("/")[-1]
    if ext == "jpeg": ext = "jpg"
    
    unique_id = str(uuid.uuid4())
    object_key = f"profiles/{user_id}/photos/{unique_id}.{ext}"

    s3 = get_s3_client()
    
    # Debug Environment Sanity
    from datetime import datetime






    
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET,
            "Key": object_key,
            "ContentType": file_type,
        },
        ExpiresIn=300, # 5 minutes
    )




    return {
        "upload_url": upload_url,
        "object_key": object_key
    }

def delete_s3_object(object_key: str):
    s3 = get_s3_client()
    s3.delete_object(Bucket=BUCKET, Key=object_key)

def upload_file(local_path: str, s3_key: str, content_type: Optional[str] = None):
    s3 = get_s3_client()
    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type
    
    s3.upload_file(local_path, BUCKET, s3_key, ExtraArgs=extra_args)


def upload_fileobj(file_obj, s3_key: str, content_type: Optional[str] = None):
    s3 = get_s3_client()
    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type
        
    s3.upload_fileobj(file_obj, BUCKET, s3_key, ExtraArgs=extra_args)


def get_s3_url(object_key: str) -> str:
    """
    Generate a permanent public S3 URL.
    Note: Requires the bucket/object to be publicly accessible.
    """
    region = os.getenv("AWS_REGION", "us-east-1")
    return f"https://{BUCKET}.s3.{region}.amazonaws.com/{object_key}"

def delete_video_folder(video_id: str):
    """
    Delete all segments and manifest for a specific video from S3.
    """
    s3 = get_s3_client()
    prefix = f"videos/{video_id}/"
    
    # List and delete all objects with the prefix
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=BUCKET, Prefix=prefix)
    
    delete_us = []
    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                delete_us.append({'Key': obj['Key']})
                
    if delete_us:
        # S3 delete_objects can handle up to 1000 keys at once
        # Chunk into batches of 1000 for safety
        for i in range(0, len(delete_us), 1000):
            batch = delete_us[i:i + 1000]
            s3.delete_objects(Bucket=BUCKET, Delete={'Objects': batch})

