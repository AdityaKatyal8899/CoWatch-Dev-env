import os
import subprocess
import json
import time
import shutil
import concurrent.futures
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
        pass

        pass

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


@celery_app.task
def process_video_to_hls(video_id: str, input_path: str):

    total_start = time.perf_counter()

    output_dir = os.path.dirname(input_path)
    stream_playlist = os.path.join(output_dir, "stream.m3u8")

    # Update status to processing
    update_video_status(video_id, "processing")

    # 1. Capture Metadata (Duration and Thumbnail)

    
    # Duration
    probe_duration_cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", input_path
    ]
    exact_duration = 0.0
    try:
        dur_res = subprocess.run(probe_duration_cmd, capture_output=True, text=True)
        exact_duration = float(dur_res.stdout.strip())
    except Exception as exc:
        pass

        pass

        pass


    # Thumbnail (Capture at 2 seconds)
    thumbnail_path = os.path.join(output_dir, "thumbnail.jpg")
    thumbnail_cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ss", "00:00:02.000", "-vframes", "1",
        thumbnail_path
    ]
    thumbnail_url = None
    try:
        subprocess.run(thumbnail_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Upload Thumbnail to S3
        thumbnail_s3_key = f"videos/{video_id}/thumbnail.jpg"
        upload_file(thumbnail_path, thumbnail_s3_key, content_type="image/jpeg")
        # In this app, we serve thumbnails from the same origin as HLS
        thumbnail_url = f"/output/videos/{video_id}/thumbnail.jpg"
    except Exception as exc:
        pass

        pass

        pass


    # Update Metadata in DB
    update_video_metadata(video_id, exact_duration, thumbnail_url)

    # 🔍 Compatibility check timing
    compatible, probe_time = is_hls_compatible(input_path)

    if compatible:

        codec_args = ["-c", "copy"]
    else:

        codec_args = ["-c:v", "libx264", "-c:a", "aac"]

    # 🎬 FFmpeg execution
    # 🧹 Delete stale HLS output before generation
    for f_name in os.listdir(output_dir):
        if f_name.endswith(".ts") or f_name.endswith(".m3u8"):
            try:
                os.remove(os.path.join(output_dir, f_name))
            except:
                pass

    remainder = exact_duration % 4.0
    # If the trailing remainder is less than 1.0 second, cut it out at the source!
    trim_duration = exact_duration - remainder if (0 < remainder < 1.0) else exact_duration

    args = [
        "ffmpeg",
        "-y",
        "-i", input_path
    ]

    if trim_duration and trim_duration > 0:
        args.extend(["-t", str(trim_duration)])

    args.extend(codec_args)
    args.extend([
        "-force_key_frames", "expr:gte(t,n_forced*1)",
        "-hls_time", "2",                 # Consistent segment length
        "-hls_list_size", "0",            # 0 means "Include ALL segments" (Critical for VOD)
        "-hls_playlist_type", "vod",      # Explicitly marks the file as VOD (Critical for seekers)
        "-start_number", "0",              # Forces segments to start at seg_000.ts
        "-hls_flags", "independent_segments", # Improves seeking and segment alignment
        "-avoid_negative_ts", "make_zero",
        "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
        stream_playlist
    ])

    try:
        subprocess.run(args, check=True)
        
        # ✅ IMMEDIATE PLAYBACK ENABLED
        # Mark as ready now so users can watch from local disk while S3 syncs
        update_video_status(video_id, "ready")


        # ☁️ Parallel Upload to S3

        files_to_upload = []
        for filename in os.listdir(output_dir):
            local_file_path = os.path.join(output_dir, filename)
            if os.path.isfile(local_file_path):
                s3_key = f"videos/{video_id}/{filename}"
                content_type = "application/x-mpegURL" if filename.endswith(".m3u8") else "video/MP2T" if filename.endswith(".ts") else "video/mp4"
                if filename.endswith(".jpg"):
                    content_type = "image/jpeg"
                files_to_upload.append((local_file_path, s3_key, content_type))

        # Use ThreadPoolExecutor for concurrent uploads
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            future_to_file = {executor.submit(upload_file, f[0], f[1], f[2]): f[1] for f in files_to_upload}
            for future in concurrent.futures.as_completed(future_to_file):
                file_key = future_to_file[future]
                try:
                    future.result()
                except Exception as exc:
                    pass


                
        # Clean up the original mp4 after ALL uploads are done (for safety)
        original_video_path = os.path.join(output_dir, "original.mp4")
        if os.path.exists(original_video_path):
            os.remove(original_video_path)



    except subprocess.CalledProcessError as e:
        update_video_status(video_id, "failed")
