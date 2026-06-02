import os
import subprocess
import json
import time
import shutil
import concurrent.futures
import threading
from app.services.s3_service import upload_file, get_s3_client, BUCKET
from app.database.config import SessionLocal
from app.database.models import Video
from app.celery_app import celery_app

def update_video_status(video_id: str, status: str):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            video.processing_status = status
            db.commit()
    finally:
        db.close()

def update_video_metadata(video_id: str, duration: float, thumbnail_url: str):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            video.duration = duration
            video.thumbnail_url = thumbnail_url
            db.commit()
    finally:
        db.close()

def update_stream_url(video_id: str, stream_url: str):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            video.stream_url = stream_url
            db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def fetch_initial_hls_segments(video_id: str):
    """
    Downloads the entire HLS playlist and ALL segments from S3 into the local drive.
    This guarantees continuous playback without on-demand starvation.
    """
    s3 = get_s3_client()
    local_dir = os.path.join("storage", "videos", video_id)
    os.makedirs(local_dir, exist_ok=True)
    
    # 1. Fetch stream.m3u8
    m3u8_key = f"videos/{video_id}/stream.m3u8"
    local_m3u8_path = os.path.join(local_dir, "stream.m3u8")
    
    try:
        s3.download_file(BUCKET, m3u8_key, local_m3u8_path)
    except Exception as exc:
        return
        
    # Read playlist to find ALL segment names
    with open(local_m3u8_path, "r") as f:
        lines = f.readlines()
        
    segments = [line.strip() for line in lines if line.strip().endswith(".ts")]
    
    for segment in segments:
        segment_key = f"videos/{video_id}/{segment}"
        local_segment_path = os.path.join(local_dir, segment)
        
        if not os.path.exists(local_segment_path):
            try:
                s3.download_file(BUCKET, segment_key, local_segment_path)
            except Exception as exc:
                pass


def is_hls_compatible(input_path: str) -> tuple[bool, float]:
    start = time.perf_counter()

    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name",
        "-of", "json",
        input_path
    ]

    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    video_streams = json.loads(res.stdout).get("streams", [])
    vid_codec = video_streams[0]["codec_name"] if video_streams else None

    probe_cmd_audio = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name",
        "-of", "json",
        input_path
    ]

    res_audio = subprocess.run(probe_cmd_audio, capture_output=True, text=True)
    audio_streams = json.loads(res_audio.stdout).get("streams", [])
    audio_codec = audio_streams[0]["codec_name"] if audio_streams else None

    end = time.perf_counter()

    return (vid_codec == "h264" and audio_codec == "aac"), (end - start)


def s3_sync_worker(output_dir: str, video_id: str, stop_event: threading.Event, error_container: list):
    """
    Background thread that monitors the output directory and uploads 
    new segments to S3 in real-time while FFmpeg is still running.
    """
    uploaded_files = set()
    # We use a smaller pool here to avoid overwhelming the network
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    futures = []
    
    try:
        while not stop_event.is_set() or any(f not in uploaded_files for f in os.listdir(output_dir) if f.endswith(".ts")):
            try:
                files = os.listdir(output_dir)
                for filename in files:
                    file_path = os.path.join(output_dir, filename)
                    
                    # Check if it's a file we care about
                    is_media = filename.endswith(".ts") or filename.endswith(".m3u8") or filename.endswith(".jpg")
                    
                    if is_media and os.path.isfile(file_path):
                        # We always re-upload .m3u8 as it evolves
                        if filename not in uploaded_files or filename.endswith(".m3u8"):
                            s3_key = f"videos/{video_id}/{filename}"
                            content_type = "application/x-mpegURL" if filename.endswith(".m3u8") else "video/MP2T" if filename.endswith(".ts") else "image/jpeg"
                            future = executor.submit(upload_file, file_path, s3_key, content_type)
                            futures.append(future)
                            
                            if not filename.endswith(".m3u8"):
                                uploaded_files.add(filename)
            except Exception:
                pass
                
            time.sleep(2)
            # If FFmpeg is done and all .ts files are uploaded, we can exit
            if stop_event.is_set():
                current_files = [f for f in os.listdir(output_dir) if f.endswith(".ts")]
                if all(f in uploaded_files for f in current_files):
                    break
    finally:
        executor.shutdown(wait=True)
        try:
            for future in futures:
                future.result()
        except Exception as e:
            error_container.append(e)


@celery_app.task
def process_video_to_hls(video_id: str, input_path: str):
    """
    Highly optimized HLS processing:
    1. Metadata capture happens immediately.
    2. FFmpeg processes the video.
    3. Background thread uploads segments to S3.
    4. Database stream_url and status are updated only upon successful completion of all steps.
    5. Clean up local processing directory.
    """
    output_dir = os.path.dirname(input_path)
    stream_playlist = os.path.join(output_dir, "stream.m3u8")
    thumbnail_path = os.path.join(output_dir, "thumbnail.jpg")
    
    # Initialize variables for cleanup in finally block
    sync_thread = None
    stop_event = threading.Event()
    error_container = []
    
    try:
        update_video_status(video_id, "processing")

        # 1. Capture Metadata
        probe_duration_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input_path]
        exact_duration = 0.0
        try:
            dur_res = subprocess.run(probe_duration_cmd, capture_output=True, text=True)
            exact_duration = float(dur_res.stdout.strip())
        except:
            pass

        thumbnail_cmd = ["ffmpeg", "-y", "-i", input_path, "-ss", "00:00:02.000", "-vframes", "1", thumbnail_path]
        thumbnail_url = f"/output/videos/{video_id}/thumbnail.jpg"
        try:
            subprocess.run(thumbnail_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            upload_file(thumbnail_path, f"videos/{video_id}/thumbnail.jpg", "image/jpeg")
        except:
            pass

        update_video_metadata(video_id, exact_duration, thumbnail_url)

        # 2. Cleanup old files
        for f_name in os.listdir(output_dir):
            if f_name.endswith(".ts") or f_name.endswith(".m3u8"):
                try:
                    os.remove(os.path.join(output_dir, f_name))
                except:
                    pass

        # 3. Prepare FFmpeg Args
        args = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
            "-c:a", "aac", "-b:a", "128k",
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-hls_time", "4",
            "-hls_list_size", "0",
            "-hls_playlist_type", "vod",
            "-start_number", "0",
            "-hls_flags", "independent_segments",
            "-threads", "0",
            "-avoid_negative_ts", "make_zero",
            "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
            stream_playlist
        ]

        # 4. Parallel S3 Sync Thread
        sync_thread = threading.Thread(target=s3_sync_worker, args=(output_dir, video_id, stop_event, error_container))
        sync_thread.start()

        # Start FFmpeg and wait for completion
        process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process.wait()
        
        if process.returncode != 0:
            raise Exception(f"FFmpeg failed with exit code {process.returncode}")

        if not os.path.exists(stream_playlist):
            raise Exception("FFmpeg completed but stream.m3u8 playlist was not generated")

        # 5. Finalize S3 Sync
        stop_event.set()
        sync_thread.join()

        # Check S3 upload errors
        if error_container:
            raise error_container[0]

        # Update database: stream_url first, then status to ready
        cdn_url = os.getenv("CDN_URL", "").strip()
        if not cdn_url.startswith(("http://", "https://")):
            cdn_url = "https://" + cdn_url
        new_stream_url = f"{cdn_url.rstrip('/')}/videos/{video_id}/stream.m3u8"
        update_stream_url(video_id, new_stream_url)
        update_video_status(video_id, "ready")

    except Exception as e:
        update_video_status(video_id, "failed")
        raise e
    finally:
        # Guarantee sync thread terminates
        stop_event.set()
        if sync_thread and sync_thread.is_alive():
            sync_thread.join()
        
        # Recursively remove the local processing directory
        if os.path.exists(output_dir):
            try:
                shutil.rmtree(output_dir)
            except Exception as exc:
                pass


from celery.signals import worker_ready

@worker_ready.connect
def cleanup_orphaned_directories(sender, **kwargs):
    """
    On celery worker startup, scan local storage/videos/ directory
    for subdirectories and clean up orphaned/expired temporary assets older than 24 hours.
    """
    videos_dir = os.path.join("storage", "videos")
    if not os.path.exists(videos_dir):
        return

    now = time.time()
    db = SessionLocal()
    try:
        for dir_name in os.listdir(videos_dir):
            dir_path = os.path.join(videos_dir, dir_name)
            if not os.path.isdir(dir_path):
                continue

            try:
                mtime = os.path.getmtime(dir_path)
                age_hours = (now - mtime) / 3600.0
                
                # Check if it's older than 24 hours
                if age_hours < 24:
                    continue
                
                # Query database for this video_id
                video = db.query(Video).filter(Video.video_id == dir_name).first()
                
                should_delete = False
                if not video:
                    # Video does not exist in DB, orphaned
                    should_delete = True
                elif video.processing_status in ("ready", "failed"):
                    # Transcoding already finished/failed, these are stale local files
                    should_delete = True
                else:
                    # Video is in "processing" or "pending" status, but folder is older than 24 hours.
                    # This means it's expired/abandoned.
                    should_delete = True

                if should_delete:
                    print(f"[Startup Cleanup] Found stale/orphaned directory: {dir_path} (age: {age_hours:.1f} hours). Deleting...", flush=True)
                    shutil.rmtree(dir_path)
            except Exception as e:
                pass
    finally:
        db.close()


