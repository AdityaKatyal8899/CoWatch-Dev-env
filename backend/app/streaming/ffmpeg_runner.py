import os
import subprocess
from threading import Lock
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from config import RTSP_URL, HLS_OUTPUT_DIR
import glob
from typing import Dict, Any


#-------------------This is the architecture of the streaming-------------------
#-----Typically: RTSP -> FFmpeg -> HLS -> Player-----
_process = None
_lock = Lock()
_stderr_log = None

def start_stream():
    global _process
    global _stderr_log
    with _lock:
        if not RTSP_URL or not isinstance(RTSP_URL, str):
            return {"started": False, "error": "RTSP_URL is not set"}
        if not HLS_OUTPUT_DIR or not isinstance(HLS_OUTPUT_DIR, str):
            return {"started": False, "error": "HLS_OUTPUT_DIR is not set"}
        os.makedirs(HLS_OUTPUT_DIR, exist_ok=True)
        output_path = os.path.join(HLS_OUTPUT_DIR, "stream.m3u8")

        if not output_path or not isinstance(output_path, str):
            return {"started": False, "error": "Output playlist path invalid"}
        
        if _process and _process.poll() is None:
            return {"started": False, "running": True}
        
        if _process and _process.poll() is None:

            _process.terminate()

            try:
                _process.wait(timeout=5)

            except Exception:
                _process.kill()

            finally:
                _process = None

        for f in glob.glob(os.path.join(HLS_OUTPUT_DIR, "*.ts")):
            try:
                os.remove(f)

            except Exception as exc:
                pass

        args = [
            "ffmpeg",
            "-nostdin",
            "-rtsp_transport","tcp",
            "-fflags","nobuffer",
            "-flags","low_delay",
            "-reorder_queue_size","0",
            "-i", RTSP_URL,
            "-c:v","libx264",
            "-preset","veryfast",
            "-tune","zerolatency",
            "-x264-params","bframes=0:keyint=30:min-keyint=30:scenecut=0",
            "-c:a","aac",
            "-f","hls",
            "-hls_time","2",
            "-hls_list_size","5",
            "-hls_flags","delete_segments+append_list",
            output_path,
        ]

        log_path = os.path.join(HLS_OUTPUT_DIR, "ffmpeg.log")
        _stderr_log = open(log_path, "ab", buffering=0)
        _process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=_stderr_log)
        
        return {"started": True}

def stop_stream():
    global _process
    global _stderr_log
    with _lock:
        if _process and _process.poll() is None:
            _process.terminate()
            try:
                _process.wait(timeout=5)
            except Exception:
                _process.kill()
            finally:
                _process = None
                if _stderr_log:
                    try:
                        _stderr_log.close()
                    except Exception:
                        pass
            stderr_log = None
            for f in glob.glob(os.path.join(HLS_OUTPUT_DIR, "*.ts")):
                try:
                    os.remove(f)
                except Exception:
                    pass
            return True
        return False

def stream_status():
    with _lock:
        if _process and _process.poll() is None:
            return {"running": True}
        return {"running": False}
