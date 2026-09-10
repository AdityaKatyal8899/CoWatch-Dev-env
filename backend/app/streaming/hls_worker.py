import os
import subprocess
import json
import time
import shutil
import concurrent.futures
import threading
import re
from typing import Optional, List, Dict, Any
from app.services.s3_service import upload_file, get_s3_client, BUCKET
from app.database.config import SessionLocal
from app.database.models import Video
from app.celery_app import celery_app

# Feature flag: Toggle Multi-Language / Multi-Audio HLS extraction.
# Kept False for standard single-stream HLS transcoding stability.
ENABLE_MULTI_AUDIO = False

# Comprehensive ISO 639-1 / 639-2 language code mapping
ISO_LANGUAGES = {
    "eng": ("English", "en"),
    "en": ("English", "en"),
    "spa": ("Spanish", "es"),
    "es": ("Spanish", "es"),
    "hin": ("Hindi", "hi"),
    "hi": ("Hindi", "hi"),
    "fra": ("French", "fr"),
    "fre": ("French", "fr"),
    "fr": ("French", "fr"),
    "deu": ("German", "de"),
    "ger": ("German", "de"),
    "de": ("German", "de"),
    "jpn": ("Japanese", "ja"),
    "ja": ("Japanese", "ja"),
    "kor": ("Korean", "ko"),
    "ko": ("Korean", "ko"),
    "zho": ("Chinese", "zh"),
    "chi": ("Chinese", "zh"),
    "zh": ("Chinese", "zh"),
    "ita": ("Italian", "it"),
    "it": ("Italian", "it"),
    "por": ("Portuguese", "pt"),
    "pt": ("Portuguese", "pt"),
    "rus": ("Russian", "ru"),
    "ru": ("Russian", "ru"),
    "ara": ("Arabic", "ar"),
    "ar": ("Arabic", "ar"),
    "ben": ("Bengali", "bn"),
    "bn": ("Bengali", "bn"),
    "tam": ("Tamil", "ta"),
    "ta": ("Tamil", "ta"),
    "tel": ("Telugu", "te"),
    "te": ("Telugu", "te"),
    "mar": ("Marathi", "mr"),
    "mr": ("Marathi", "mr"),
    "pan": ("Punjabi", "pa"),
    "pa": ("Punjabi", "pa"),
    "kan": ("Kannada", "kn"),
    "kn": ("Kannada", "kn"),
    "mal": ("Malayalam", "ml"),
    "ml": ("Malayalam", "ml"),
    "tur": ("Turkish", "tr"),
    "tr": ("Turkish", "tr"),
    "vie": ("Vietnamese", "vi"),
    "vi": ("Vietnamese", "vi"),
    "pol": ("Polish", "pl"),
    "pl": ("Polish", "pl"),
    "nld": ("Dutch", "nl"),
    "nl": ("Dutch", "nl"),
    "swe": ("Swedish", "sv"),
    "sv": ("Swedish", "sv"),
}


def update_video_status(video_id: str, status: str):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            video.processing_status = status
            db.commit()
    finally:
        db.close()


def update_video_metadata(video_id: str, duration: float, thumbnail_url: str, audio_tracks: Optional[List[Dict[str, Any]]] = None):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if video:
            video.duration = duration
            video.thumbnail_url = thumbnail_url
            if audio_tracks is not None:
                video.audio_tracks = audio_tracks
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


def probe_audio_streams(input_path: str) -> List[Dict[str, Any]]:
    """
    Extracts all audio streams from media file with language codes and user-friendly labels.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index,codec_name,channels:stream_tags=language,title,handler_name",
        "-of", "json",
        input_path
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        streams = json.loads(res.stdout).get("streams", [])
    except Exception as e:
        print(f"[Audio Probe Error] Failed to probe audio streams: {e}", flush=True)
        return []

    audio_tracks = []
    seen_names = set()
    for idx, s in enumerate(streams):
        tags = s.get("tags", {}) or {}
        raw_lang = (tags.get("language") or tags.get("lang") or "").lower().strip()
        raw_title = tags.get("title") or tags.get("handler_name") or ""
        
        lang_info = ISO_LANGUAGES.get(raw_lang)
        if lang_info:
            friendly_name, lang_code = lang_info
        elif raw_title:
            friendly_name = raw_title
            lang_code = raw_lang if raw_lang else "und"
        elif raw_lang:
            friendly_name = raw_lang.upper()
            lang_code = raw_lang
        else:
            friendly_name = f"Audio Track {idx + 1}"
            lang_code = "und"
            
        if friendly_name in seen_names:
            friendly_name = f"{friendly_name} ({idx + 1})"
        seen_names.add(friendly_name)

        audio_tracks.append({
            "id": idx,
            "stream_index": s.get("index", idx),
            "name": friendly_name,
            "language": lang_code,
            "codec": s.get("codec_name", "aac"),
            "channels": s.get("channels", 2),
            "default": (idx == 0)
        })

    return audio_tracks


def normalize_m3u8_playlists(output_dir: str, audio_tracks: Optional[List[Dict[str, Any]]] = None):
    """
    Normalizes Windows backslashes in .m3u8 manifests to standard forward slashes
    for web/HLS standard compatibility and ensures human-readable audio track names.
    """
    if not os.path.exists(output_dir):
        return
    for root, _, files in os.walk(output_dir):
        for f in files:
            if f.endswith(".m3u8"):
                fpath = os.path.join(root, f)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as m3u8_file:
                        content = m3u8_file.read()
                    fixed_lines = []
                    for line in content.splitlines():
                        if line.startswith("#EXT-X-MEDIA") and 'URI="' in line:
                            # Fix URI attribute backslashes
                            line = re.sub(r'URI="([^"]+)"', lambda m: f'URI="{m.group(1).replace(chr(92), "/")}"', line)
                            # Enhance audio track NAME with user-friendly label if available
                            if audio_tracks:
                                for t in audio_tracks:
                                    clean_name = re.sub(r'[,:\s]+', '_', t['name'])
                                    if f"v{clean_name}/" in line or f'LANGUAGE="{t["language"]}"' in line:
                                        line = re.sub(r'NAME="[^"]*"', f'NAME="{t["name"]}"', line)
                                        break
                        elif not line.startswith("#") and line.strip():
                            line = line.replace('\\', '/')
                        fixed_lines.append(line)
                    fixed_content = "\n".join(fixed_lines) + "\n"
                    with open(fpath, "w", encoding="utf-8") as m3u8_file:
                        m3u8_file.write(fixed_content)
                except Exception as e:
                    print(f"[Manifest Normalize Error] {fpath}: {e}", flush=True)


def fetch_initial_hls_segments(video_id: str):
    """
    Downloads the entire HLS playlist and ALL segments (video & multi-audio) from S3
    into local drive. Guarantees continuous playback without on-demand starvation.
    """
    s3 = get_s3_client()
    local_dir = os.path.join("storage", "videos", video_id)
    os.makedirs(local_dir, exist_ok=True)
    
    # 1. Fetch stream.m3u8
    m3u8_key = f"videos/{video_id}/stream.m3u8"
    local_m3u8_path = os.path.join(local_dir, "stream.m3u8")
    
    try:
        s3.download_file(BUCKET, m3u8_key, local_m3u8_path)
    except Exception:
        return
        
    with open(local_m3u8_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    sub_playlists = []
    for line in lines:
        line_s = line.strip()
        if 'URI="' in line_s:
            match = re.search(r'URI="([^"]+)"', line_s)
            if match:
                sub_playlists.append(match.group(1))
        elif line_s and not line_s.startswith('#') and line_s.endswith('.m3u8'):
            sub_playlists.append(line_s)
            
    all_segment_keys = []
    if sub_playlists:
        for sub_pl in sub_playlists:
            sub_pl_clean = sub_pl.replace('\\', '/')
            sub_key = f"videos/{video_id}/{sub_pl_clean}"
            local_sub_path = os.path.join(local_dir, *sub_pl_clean.split('/'))
            os.makedirs(os.path.dirname(local_sub_path), exist_ok=True)
            try:
                s3.download_file(BUCKET, sub_key, local_sub_path)
                with open(local_sub_path, "r", encoding="utf-8", errors="ignore") as sub_f:
                    sub_lines = sub_f.readlines()
                sub_dir_rel = os.path.dirname(sub_pl_clean)
                for sline in sub_lines:
                    s_clean = sline.strip()
                    if s_clean.endswith('.ts'):
                        seg_rel = f"{sub_dir_rel}/{s_clean}" if sub_dir_rel else s_clean
                        all_segment_keys.append(seg_rel)
            except Exception:
                pass
    else:
        for line in lines:
            line_s = line.strip()
            if line_s.endswith(".ts"):
                all_segment_keys.append(line_s)

    for seg_rel in all_segment_keys:
        seg_rel_clean = seg_rel.replace('\\', '/')
        segment_key = f"videos/{video_id}/{seg_rel_clean}"
        local_segment_path = os.path.join(local_dir, *seg_rel_clean.split('/'))
        os.makedirs(os.path.dirname(local_segment_path), exist_ok=True)
        if not os.path.exists(local_segment_path):
            try:
                s3.download_file(BUCKET, segment_key, local_segment_path)
            except Exception:
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


def upload_file_with_retry(local_path: str, s3_key: str, content_type: str, max_retries: int = 5) -> bool:
    abs_path = os.path.abspath(local_path)
    if not os.path.exists(abs_path):
        print(f"[Upload Warning] Local file missing or already deleted: {abs_path}", flush=True)
        return False

    backoff = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Upload] Uploading {abs_path} to S3 (Attempt {attempt})...", flush=True)
            upload_file(abs_path, s3_key, content_type)
            print(f"[Upload] Successfully uploaded {s3_key} to S3.", flush=True)
            return True
        except Exception as e:
            print(f"[Upload Error] Attempt {attempt} failed for {abs_path}: {e}", flush=True)
            if attempt == max_retries:
                raise e
            time.sleep(backoff)
            backoff *= 2.0
    return False


def generate_and_upload_master_playlist(output_dir: str, video_id: str, audio_tracks: Optional[List[Dict[str, Any]]] = None) -> str:
    """
    Constructs the master stream.m3u8 containing all audio track declarations
    and video stream-inf, and immediately uploads it to S3 at Step 0.
    """
    master_path = os.path.join(output_dir, "stream.m3u8")
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:6",
    ]
    if audio_tracks:
        for idx, track in enumerate(audio_tracks):
            clean_name = re.sub(r'[,:\s]+', '_', track['name'])
            default_val = "YES" if idx == 0 else "NO"
            lang = track.get("language", "und")
            lines.append(
                f'#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="{track["name"]}",DEFAULT={default_val},AUTOSELECT=YES,LANGUAGE="{lang}",URI="v{clean_name}/playlist.m3u8"'
            )
        lines.append('#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"')
        lines.append("v0/playlist.m3u8")
    else:
        lines.append('#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"')
        lines.append("v0/playlist.m3u8")

    content = "\n".join(lines) + "\n"
    with open(master_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[Pre-Play Master] Uploading initial stream.m3u8 master playlist to S3...", flush=True)
    upload_file_with_retry(master_path, f"videos/{video_id}/stream.m3u8", "application/x-mpegURL")
    return master_path


def publish_safe_playlists(output_dir: str, video_id: str, uploaded_files: set, is_final: bool = False):
    """
    Scans all variant subdirectories (v0, vHindi, vEnglish, etc.),
    extracts the segment entries from the local FFmpeg playlist.m3u8,
    and publishes a safe playlist to S3 containing ONLY the segments
    that have confirmed uploaded to S3 (preventing 404 race conditions).
    """
    for root, _, files in os.walk(output_dir):
        if "playlist.m3u8" in files:
            local_m3u8 = os.path.join(root, "playlist.m3u8")
            rel_dir = os.path.relpath(root, output_dir).replace('\\', '/')
            if rel_dir == '.':
                rel_dir = ''
            
            try:
                with open(local_m3u8, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                
                safe_segment_blocks = []
                current_extinf = None
                target_duration = 4
                media_seq = 0
                
                for line in lines:
                    line_s = line.strip()
                    if line_s.startswith("#EXT-X-TARGETDURATION:"):
                        try:
                            target_duration = int(line_s.split(":")[1])
                        except Exception:
                            pass
                    elif line_s.startswith("#EXT-X-MEDIA-SEQUENCE:"):
                        try:
                            media_seq = int(line_s.split(":")[1])
                        except Exception:
                            pass
                    elif line_s.startswith("#EXTINF:"):
                        current_extinf = line_s
                    elif line_s.endswith(".ts") and current_extinf is not None:
                        seg_file = line_s
                        rel_seg_key = f"{rel_dir}/{seg_file}" if rel_dir else seg_file
                        if rel_seg_key in uploaded_files:
                            safe_segment_blocks.append(f"{current_extinf}\n{seg_file}")
                        current_extinf = None
                
                # Only publish if there are uploaded segments or if final
                if safe_segment_blocks or is_final:
                    safe_lines = [
                        "#EXTM3U",
                        "#EXT-X-VERSION:6",
                        f"#EXT-X-TARGETDURATION:{target_duration}",
                        f"#EXT-X-MEDIA-SEQUENCE:{media_seq}",
                    ]
                    if is_final:
                        safe_lines.append("#EXT-X-PLAYLIST-TYPE:VOD")
                    else:
                        safe_lines.append("#EXT-X-PLAYLIST-TYPE:EVENT")
                    
                    safe_lines.extend(safe_segment_blocks)
                    
                    if is_final:
                        safe_lines.append("#EXT-X-ENDLIST")
                    
                    safe_manifest_content = "\n".join(safe_lines) + "\n"
                    
                    safe_temp_path = os.path.join(root, "_safe_playlist.m3u8")
                    with open(safe_temp_path, "w", encoding="utf-8") as sf:
                        sf.write(safe_manifest_content)
                    
                    s3_m3u8_key = f"videos/{video_id}/{rel_dir}/playlist.m3u8" if rel_dir else f"videos/{video_id}/playlist.m3u8"
                    upload_file_with_retry(safe_temp_path, s3_m3u8_key, "application/x-mpegURL")
                    
                    if os.path.exists(safe_temp_path):
                        try:
                            os.remove(safe_temp_path)
                        except Exception:
                            pass
            except Exception as e:
                print(f"[Safe Manifest Error] Failed for {local_m3u8}: {e}", flush=True)


def s3_sync_worker(
    output_dir: str, 
    video_id: str, 
    stop_event: threading.Event, 
    error_container: list, 
    window_size: int = 10, 
    duration: float = 0.0,
    audio_tracks: Optional[List[Dict[str, Any]]] = None
):
    """
    Background thread that recursively monitors the output directory (including multi-track subdirectories)
    and uploads new segments and safe manifests to S3 in windows in real-time, then deletes segments immediately.
    """
    import math
    uploaded_files = set()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    seg_pattern = re.compile(r"^seg_(\d+)\.ts$")
    
    total_tracks = 1 + (len(audio_tracks) if audio_tracks else 0)
    expected_segments = max(1, math.ceil(duration / 4.0)) * total_tracks
    pre_play_threshold = max(1, math.ceil(expected_segments * 0.30))
    pre_play_triggered = False
    
    try:
        def has_unuploaded_segments():
            for root, _, files in os.walk(output_dir):
                for f in files:
                    if f.endswith(".ts"):
                        rel_path = os.path.relpath(os.path.join(root, f), output_dir).replace('\\', '/')
                        if rel_path not in uploaded_files:
                            return True
            return False

        while not stop_event.is_set() or has_unuploaded_segments():
            if error_container:
                break
                
            try:
                # Group segments by directory
                dir_segments: Dict[str, List[tuple]] = {}
                for root, _, files in os.walk(output_dir):
                    rel_dir = os.path.relpath(root, output_dir).replace('\\', '/')
                    if rel_dir == '.':
                        rel_dir = ''
                    for f in files:
                        match = seg_pattern.match(f)
                        if match:
                            idx = int(match.group(1))
                            dir_segments.setdefault(rel_dir, []).append((idx, f, os.path.join(root, f)))

                if not dir_segments:
                    time.sleep(1)
                    continue

                uploadable = []
                for rel_dir, seg_list in dir_segments.items():
                    seg_list.sort(key=lambda x: x[0])
                    max_index = seg_list[-1][0]
                    for idx, fname, full_path in seg_list:
                        rel_key = f"{rel_dir}/{fname}" if rel_dir else fname
                        if rel_key in uploaded_files:
                            continue
                        if idx < max_index or stop_event.is_set():
                            uploadable.append((rel_key, full_path))

                if len(uploadable) >= window_size or (stop_event.is_set() and len(uploadable) > 0):
                    batch = uploadable[:window_size]
                    print(f"[Sync Worker] Processing batch of {len(batch)} segments: {[b[0] for b in batch]}", flush=True)
                    
                    futures = {}
                    for rel_key, file_path in batch:
                        s3_key = f"videos/{video_id}/{rel_key}"
                        content_type = "video/MP2T"
                        future = executor.submit(upload_file_with_retry, file_path, s3_key, content_type)
                        futures[future] = (rel_key, file_path)
                    
                    failed_uploads = []
                    for future, (rel_key, file_path) in futures.items():
                        try:
                            future.result()
                        except Exception as e:
                            failed_uploads.append((rel_key, e))
                            
                    if failed_uploads:
                        raise Exception(f"Batch upload failed for: {[f[0] for f in failed_uploads]}. Errors: {[str(f[1]) for f in failed_uploads]}")
                    
                    # Delete local copies immediately upon successful upload and mark uploaded
                    for rel_key, file_path in batch:
                        if os.path.exists(file_path):
                            try:
                                os.remove(file_path)
                                print(f"[Cleanup] Deleted local segment: {rel_key}", flush=True)
                            except Exception as exc:
                                print(f"[Cleanup Error] Failed to delete local segment {rel_key}: {exc}", flush=True)
                        uploaded_files.add(rel_key)
                        
                    # Publish safe intermediate playlists to S3 containing ONLY confirmed uploaded segments
                    publish_safe_playlists(output_dir, video_id, uploaded_files, is_final=False)

                    # Pre-play threshold check (30% segments uploaded)
                    if not pre_play_triggered and len(uploaded_files) >= pre_play_threshold:
                        print(f"[Sync Worker] 30% HLS segments pre-play threshold reached ({len(uploaded_files)}/{pre_play_threshold}). Marking video ready for instant playback.", flush=True)
                        cdn_url = os.getenv("CDN_URL", "").strip()
                        if not cdn_url.startswith(("http://", "https://")):
                            cdn_url = "https://" + cdn_url
                        new_stream_url = f"{cdn_url.rstrip('/')}/videos/{video_id}/stream.m3u8"
                        update_stream_url(video_id, new_stream_url)
                        update_video_status(video_id, "ready")
                        pre_play_triggered = True
                else:
                    time.sleep(1)
            except Exception as e:
                error_container.append(e)
                break

        # When all segments are processed, publish final VOD playlists with #EXT-X-ENDLIST
        if not error_container:
            print(f"[Sync Worker] Publishing final complete VOD playlists to S3...", flush=True)
            publish_safe_playlists(output_dir, video_id, uploaded_files, is_final=True)

    finally:
        executor.shutdown(wait=True)


@celery_app.task
def process_video_to_hls(video_id: str, input_path: str):
    """
    Highly optimized multi-audio HLS processing with streaming-window uploads:
    1. Probes exact duration, thumbnail, and all audio streams.
    2. Pre-generates master stream.m3u8 and uploads immediately to S3.
    3. Background thread uploads segments in windows and updates safe intermediate manifests.
    4. Triggers instant playback at 30% uploaded buffer.
    5. Finalizes VOD playlists upon 100% completion and cleans up local disk.
    """
    output_dir = os.path.dirname(input_path)
    stream_playlist = os.path.join(output_dir, "stream.m3u8")
    thumbnail_path = os.path.join(output_dir, "thumbnail.jpg")
    
    sync_thread = None
    stop_event = threading.Event()
    error_container = []
    success = False
    
    try:
        update_video_status(video_id, "processing")

        # 1. Capture Metadata (Duration, Thumbnail, Audio Tracks)
        probe_duration_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input_path]
        exact_duration = 0.0
        try:
            dur_res = subprocess.run(probe_duration_cmd, capture_output=True, text=True)
            exact_duration = float(dur_res.stdout.strip())
        except Exception as e:
            print(f"[Metadata Error] Failed to capture duration: {e}", flush=True)

        thumbnail_cmd = ["ffmpeg", "-y", "-i", input_path, "-ss", "00:00:02.000", "-vframes", "1", thumbnail_path]
        cdn_url = os.getenv("CDN_URL", "").strip()
        if not cdn_url.startswith(("http://", "https://")):
            cdn_url = "https://" + cdn_url
        thumbnail_url = f"{cdn_url.rstrip('/')}/videos/{video_id}/thumbnail.jpg"
        try:
            subprocess.run(thumbnail_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            upload_file_with_retry(thumbnail_path, f"videos/{video_id}/thumbnail.jpg", "image/jpeg")
        except Exception as e:
            print(f"[Metadata Error] Failed to generate/upload thumbnail: {e}", flush=True)

        # Probe audio streams if multi-audio is enabled
        if ENABLE_MULTI_AUDIO:
            audio_tracks = probe_audio_streams(input_path)
            print(f"[Audio Tracks] Detected {len(audio_tracks)} audio stream(s): {audio_tracks}", flush=True)
        else:
            audio_tracks = None
            print("[Audio Tracks] Multi-Audio feature disabled. Running standard single-stream HLS transcoding.", flush=True)

        update_video_metadata(video_id, exact_duration, thumbnail_url, audio_tracks)

        # 2. Cleanup old files
        for root, dirs, files in os.walk(output_dir):
            for f_name in files:
                if f_name.endswith(".ts") or f_name.endswith(".m3u8"):
                    try:
                        os.remove(os.path.join(root, f_name))
                    except Exception as e:
                        print(f"[Cleanup Error] Failed to remove old file {f_name}: {e}", flush=True)

        common_hls_args = [
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-hls_time", "4",
            "-hls_list_size", "0",
            "-hls_playlist_type", "vod",
            "-start_number", "0",
            "-hls_flags", "independent_segments",
            "-threads", "2",
            "-avoid_negative_ts", "make_zero",
        ]

        # 3. Configure FFmpeg (Multi-Audio vs Standard Single-Stream)
        if ENABLE_MULTI_AUDIO and audio_tracks:
            # Multi-Audio sub-variant directories and master playlist setup
            os.makedirs(os.path.join(output_dir, "v0"), exist_ok=True)
            for track in audio_tracks:
                clean_name = re.sub(r'[,:\s]+', '_', track['name'])
                os.makedirs(os.path.join(output_dir, f"v{clean_name}"), exist_ok=True)

            generate_and_upload_master_playlist(output_dir, video_id, audio_tracks)

            args = [
                "ffmpeg", "-y", "-i", input_path,
                "-map", "0:v:0",
                "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
            ]

            for idx, track in enumerate(audio_tracks):
                args += [
                    "-map", f"0:a:{idx}",
                    f"-c:a:{idx}", "aac",
                    f"-b:a:{idx}", "128k",
                    f"-ac:a:{idx}", "2"
                ]

            args += common_hls_args

            v_map = "v:0,agroup:audio,default:yes"
            a_maps = []
            for idx, track in enumerate(audio_tracks):
                clean_name = re.sub(r'[,:\s]+', '_', track['name'])
                def_str = "yes" if idx == 0 else "no"
                a_maps.append(f"a:{idx},agroup:audio,name:{clean_name},language:{track['language']},default:{def_str}")

            var_stream_map_str = f"{v_map} " + " ".join(a_maps)

            args += [
                "-master_pl_name", "stream.m3u8",
                "-var_stream_map", var_stream_map_str,
                "-hls_segment_filename", os.path.join(output_dir, "v%v", "seg_%03d.ts"),
                os.path.join(output_dir, "v%v", "playlist.m3u8")
            ]
        else:
            # Standard single-stream HLS transcoding: Video + Default Stereo Audio in one manifest
            args = [
                "ffmpeg", "-y", "-i", input_path,
                "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
                "-c:a", "aac", "-b:a", "128k", "-ac", "2",
            ] + common_hls_args + [
                "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
                stream_playlist
            ]

        # 4. Parallel S3 Sync Thread
        sync_thread = threading.Thread(
            target=s3_sync_worker, 
            args=(output_dir, video_id, stop_event, error_container),
            kwargs={"window_size": 10, "duration": exact_duration, "audio_tracks": audio_tracks}
        )
        sync_thread.start()

        # Start FFmpeg and monitor process and upload errors
        ffmpeg_log_path = os.path.join(output_dir, "ffmpeg.log")
        with open(ffmpeg_log_path, "w") as log_file:
            process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=log_file)
            
            while process.poll() is None:
                if error_container:
                    print(f"[Task Error] S3 Sync Thread failed with error: {error_container[0]}. Terminating FFmpeg...", flush=True)
                    process.terminate()
                    process.wait()
                    raise error_container[0]
                time.sleep(1)
            
            if process.returncode != 0:
                error_msg = "Unknown FFmpeg error"
                try:
                    if os.path.exists(ffmpeg_log_path):
                        with open(ffmpeg_log_path, "r") as f:
                            error_msg = f.read()
                except Exception as read_err:
                    error_msg = f"Failed to read FFmpeg log: {read_err}"
                raise Exception(f"FFmpeg failed with exit code {process.returncode}. Details:\n{error_msg}")

        # 5. Finalize S3 Sync
        update_video_status(video_id, "uploading")
        stop_event.set()
        sync_thread.join()

        # Check S3 upload errors
        if error_container:
            raise error_container[0]

        # 6. Final Manifests Normalization and Upload
        if ENABLE_MULTI_AUDIO and audio_tracks:
            normalize_m3u8_playlists(output_dir, audio_tracks)

        if os.path.exists(stream_playlist):
            print(f"[Finalizing] Uploading final stream.m3u8 playlist...", flush=True)
            upload_file_with_retry(stream_playlist, f"videos/{video_id}/stream.m3u8", "application/x-mpegURL")
        else:
            raise Exception("FFmpeg completed but stream.m3u8 playlist was not generated")

        # Update database: stream_url first, then status to ready
        cdn_url = os.getenv("CDN_URL", "").strip()
        if not cdn_url.startswith(("http://", "https://")):
            cdn_url = "https://" + cdn_url
        new_stream_url = f"{cdn_url.rstrip('/')}/videos/{video_id}/stream.m3u8"
        update_stream_url(video_id, new_stream_url)
        success = True

    except Exception as e:
        update_video_status(video_id, "failed")
        raise e
    finally:
        # Guarantee sync thread terminates
        stop_event.set()
        if sync_thread and sync_thread.is_alive():
            sync_thread.join()
        
        # Recursively remove the local processing directory
        cleanup_succeeded = False
        if os.path.exists(output_dir):
            try:
                print(f"[Cleanup] Deleting local processing directory: {output_dir}", flush=True)
                shutil.rmtree(output_dir)
                print(f"[Cleanup] Successfully deleted local processing directory.", flush=True)
                cleanup_succeeded = True
            except Exception as exc:
                print(f"[Cleanup Error] Failed to delete directory {output_dir}: {exc}", flush=True)
        else:
            cleanup_succeeded = True

        if success and cleanup_succeeded:
            update_video_status(video_id, "ready")
            # Notify user via email that their uploaded video is processed and ready to stream
            try:
                db_notify = SessionLocal()
                video_obj = db_notify.query(Video).filter(Video.video_id == video_id).first()
                if video_obj and video_obj.owner and video_obj.owner.email:
                    from app.services.email_service import send_video_ready_email
                    frontend_base = os.getenv("FRONTEND_URL", "https://cowatch-theta.vercel.app").split(",")[0].strip()
                    send_video_ready_email(
                        to_email=video_obj.owner.email,
                        username=video_obj.owner.display_name or video_obj.owner.name or "Creator",
                        video_title=video_obj.title or "Untitled Video",
                        duration=video_obj.duration or exact_duration,
                        thumbnail_url=video_obj.thumbnail_url or thumbnail_url,
                        video_id=video_id,
                        frontend_url=frontend_base
                    )
                db_notify.close()
            except Exception as notify_err:
                print(f"[Email Notification Error] Could not send video ready notification: {notify_err}", flush=True)
        elif success:
            update_video_status(video_id, "failed")


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
                
                if age_hours < 24:
                    continue
                
                video = db.query(Video).filter(Video.video_id == dir_name).first()
                should_delete = False
                if not video:
                    should_delete = True
                elif video.processing_status in ("ready", "failed"):
                    should_delete = True
                else:
                    should_delete = True

                if should_delete:
                    print(f"[Startup Cleanup] Found stale/orphaned directory: {dir_path} (age: {age_hours:.1f} hours). Deleting...", flush=True)
                    shutil.rmtree(dir_path)
            except Exception:
                pass
    finally:
        db.close()
