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


def s3_sync_worker(output_dir: str, video_id: str, stop_event: threading.Event):
    """
    Background thread that monitors the output directory and uploads 
    new segments to S3 in real-time while FFmpeg is still running.
    """
    uploaded_files = set()
    # We use a smaller pool here to avoid overwhelming the network
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    
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
                        executor.submit(upload_file, file_path, s3_key, content_type)
                        
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

    executor.shutdown(wait=True)


@celery_app.task
def process_video_to_hls(video_id: str, input_path: str):
    """
    Highly optimized HLS processing:
    1. Metadata capture happens immediately.
    2. FFmpeg starts with 'ultrafast' preset.
    3. Background thread starts uploading segments to S3 instantly.
    4. Video is marked 'ready' as soon as first 2 segments exist.
    """
    total_start = time.perf_counter()
    output_dir = os.path.dirname(input_path)
    stream_playlist = os.path.join(output_dir, "stream.m3u8")

    update_video_status(video_id, "processing")

    # 1. Capture Metadata
    probe_duration_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input_path]
    exact_duration = 0.0
    try:
        dur_res = subprocess.run(probe_duration_cmd, capture_output=True, text=True)
        exact_duration = float(dur_res.stdout.strip())
    except: pass

    thumbnail_path = os.path.join(output_dir, "thumbnail.jpg")
    thumbnail_cmd = ["ffmpeg", "-y", "-i", input_path, "-ss", "00:00:02.000", "-vframes", "1", thumbnail_path]
    thumbnail_url = f"/output/videos/{video_id}/thumbnail.jpg"
    try:
        subprocess.run(thumbnail_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        upload_file(thumbnail_path, f"videos/{video_id}/thumbnail.jpg", "image/jpeg")
    except: pass

    update_video_metadata(video_id, exact_duration, thumbnail_url)

    # 2. Cleanup old files
    for f_name in os.listdir(output_dir):
        if f_name.endswith(".ts") or f_name.endswith(".m3u8"):
            try: os.remove(os.path.join(output_dir, f_name))
            except: pass

    # 3. Prepare FFmpeg Args
    # Using 'ultrafast' for speed and 'threads 0' for parallel CPU usage
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
    stop_event = threading.Event()
    sync_thread = threading.Thread(target=s3_sync_worker, args=(output_dir, video_id, stop_event))
    sync_thread.start()

    try:
        # Start FFmpeg in background
        process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # ⚡ PARALLEL SERVING: Enable playback as soon as first 2 segments exist
        ready_marked = False
        while process.poll() is None:
            if not ready_marked:
                if os.path.exists(stream_playlist):
                    segments = [f for f in os.listdir(output_dir) if f.endswith(".ts")]
                    if len(segments) >= 2:
                        update_video_status(video_id, "ready")
                        ready_marked = True
            time.sleep(2)

        process.wait()
        
        # Ensure it's marked ready if it was too fast
        if not ready_marked:
            update_video_status(video_id, "ready")

        # 5. Finalize S3 Sync
        stop_event.set()
        sync_thread.join()

        # 6. Cleanup
        if os.path.exists(input_path):
            os.remove(input_path)

    except Exception as e:
        update_video_status(video_id, "failed")
        stop_event.set()
        if sync_thread.is_alive():
            sync_thread.join()

