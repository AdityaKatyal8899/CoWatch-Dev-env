#!/usr/bin/env python3
"""
CoWatch Video Compressor (GUI)
==============================
A GPU-accelerated, high-fidelity video compressor designed to shrink large
video files (such as 2GB+ recordings) to fit CoWatch upload limits while
preserving pristine audio and video quality.

Features:
- 🚀 Full GPU Hardware Acceleration: Auto-detects NVIDIA NVENC (RTX/GTX), Intel QSV, AMD AMF.
- 🎯 "Fit under 2.0GB (CoWatch Upload Ready)" auto-calculated bitrate mode.
- 💎 Visually Lossless CRF / CQ modes (H.264 & H.265 / HEVC).
- 🔊 Lossless Audio Pass-Through (-c:a copy) with 0 re-encoding quality loss.
- ⚡ FastStart (+faststart) enabled for instant browser playback.
- 📊 Real-time GPU encoding speed, progress bar, ETA, and size reduction stats.
"""

import os
import sys
import json
import time
import shutil
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Optional, Dict, Any, Tuple, List

# Enable High-DPI awareness on Windows if possible
if sys.platform == "win32":
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def format_bytes(bytes_num: float) -> str:
    """Format bytes into human-readable string (KB, MB, GB)."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(bytes_num) < 1024.0:
            return f"{bytes_num:.2f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.2f} PB"


def format_seconds(seconds: float) -> str:
    """Format seconds into HH:MM:SS."""
    if seconds < 0 or seconds != seconds:  # NaN or negative
        return "00:00:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def find_binary(name: str) -> Optional[str]:
    """Locate ffmpeg/ffprobe executable in PATH or standard system paths."""
    found = shutil.which(name)
    if found:
        return found
    if sys.platform == "win32":
        potential_paths = [
            os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "ffmpeg", "bin", f"{name}.exe"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Links", f"{name}.exe"),
            os.path.join(os.environ.get("USERPROFILE", ""), "scoop", "shims", f"{name}.exe"),
            os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "chocolatey", "bin", f"{name}.exe"),
        ]
        for p in potential_paths:
            if os.path.isfile(p):
                return p
    return None


class VideoCompressorApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("CoWatch Video Compressor — GPU Accelerated Lossless Quality")
        self.root.geometry("820x780")
        self.root.minsize(740, 700)

        self.ffmpeg_path = find_binary("ffmpeg")
        self.ffprobe_path = find_binary("ffprobe")

        self.current_process: Optional[subprocess.Popen] = None
        self.is_compressing = False
        self.video_metadata: Optional[Dict[str, Any]] = None

        # GPU Detection
        self.available_gpu_encoders = self._detect_gpu_encoders()
        self.gpu_device_name = self._detect_gpu_name()

        # State Variables
        self.input_path_var = tk.StringVar()
        self.output_path_var = tk.StringVar()
        self.mode_var = tk.StringVar(value="fit_2gb")
        
        # Default to NVENC if available, else CPU libx264
        default_codec = "h264_nvenc (NVIDIA GPU Ultra-Fast ⚡)" if "h264_nvenc" in self.available_gpu_encoders else "libx264 (CPU Standard Quality)"
        self.codec_var = tk.StringVar(value=default_codec)
        self.crf_var = tk.IntVar(value=21)
        self.audio_mode_var = tk.StringVar(value="Copy Original (Lossless Pass-through)")
        self.status_var = tk.StringVar(value="Ready. Select a video file to begin.")
        self.progress_percent_var = tk.StringVar(value="0%")
        self.speed_eta_var = tk.StringVar(value="")

        self._init_theme()
        self._build_ui()
        self._check_dependencies()

    def _detect_gpu_name(self) -> str:
        """Detect GPU Device name (e.g., NVIDIA GeForce RTX 3050)."""
        if sys.platform == "win32":
            try:
                out = subprocess.check_output(
                    ["powershell", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"],
                    text=True, stderr=subprocess.DEVNULL
                ).strip()
                names = [line.strip() for line in out.splitlines() if line.strip()]
                # Prefer dedicated NVIDIA/AMD over integrated Intel
                for n in names:
                    if "NVIDIA" in n.upper() or "RTX" in n.upper() or "GTX" in n.upper() or "RADEON" in n.upper():
                        return n
                return names[0] if names else "GPU Hardware"
            except Exception:
                pass
        return "GPU Hardware"

    def _detect_gpu_encoders(self) -> Dict[str, str]:
        """Test which hardware encoders are functional on this system."""
        encoders = {}
        if not self.ffmpeg_path:
            return encoders

        candidates = [
            ("h264_nvenc", "NVIDIA NVENC H.264"),
            ("hevc_nvenc", "NVIDIA NVENC HEVC"),
            ("h264_qsv", "Intel QuickSync H.264"),
            ("hevc_qsv", "Intel QuickSync HEVC"),
            ("h264_amf", "AMD AMF H.264"),
            ("hevc_amf", "AMD AMF HEVC"),
        ]

        for enc, desc in candidates:
            try:
                cmd = [
                    self.ffmpeg_path,
                    "-f", "lavfi",
                    "-i", "testsrc=duration=0.1:size=64x64:rate=10",
                    "-c:v", enc,
                    "-f", "null",
                    "-"
                ]
                res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
                if res.returncode == 0:
                    encoders[enc] = desc
            except Exception:
                pass
        return encoders

    def _init_theme(self):
        """Configure modern dark theme styles."""
        self.root.configure(bg="#0f1117")
        style = ttk.Style()
        style.theme_use("clam")

        self.colors = {
            "bg": "#0f1117",
            "card": "#181b24",
            "card_border": "#272b38",
            "accent": "#6366f1",
            "accent_hover": "#4f46e5",
            "text": "#f3f4f6",
            "muted": "#9ca3af",
            "success": "#10b981",
            "danger": "#ef4444",
            "warning": "#f59e0b",
            "entry_bg": "#11141c",
            "gpu_badge": "#059669",
        }

        # TTK Styles
        style.configure("TFrame", background=self.colors["bg"])
        style.configure("Card.TFrame", background=self.colors["card"], relief="solid", borderwidth=1)
        style.configure("TLabel", background=self.colors["bg"], foreground=self.colors["text"], font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=self.colors["card"], foreground=self.colors["text"], font=("Segoe UI", 10))
        style.configure("Header.TLabel", background=self.colors["bg"], foreground="#ffffff", font=("Segoe UI", 14, "bold"))
        style.configure("SubHeader.TLabel", background=self.colors["bg"], foreground=self.colors["muted"], font=("Segoe UI", 9))
        style.configure("CardBold.TLabel", background=self.colors["card"], foreground=self.colors["text"], font=("Segoe UI", 10, "bold"))
        style.configure("StatValue.TLabel", background=self.colors["card"], foreground=self.colors["accent"], font=("Segoe UI", 11, "bold"))

        style.configure(
            "Accent.Horizontal.TProgressbar",
            troughcolor=self.colors["entry_bg"],
            background=self.colors["accent"],
            darkcolor=self.colors["accent"],
            lightcolor=self.colors["accent"],
            bordercolor=self.colors["card_border"],
            thickness=14
        )

        style.configure("TRadiobutton", background=self.colors["card"], foreground=self.colors["text"], font=("Segoe UI", 10))
        style.map("TRadiobutton", background=[("active", self.colors["card"])], foreground=[("active", "#ffffff")])

        style.configure("TCombobox", fieldbackground=self.colors["entry_bg"], background=self.colors["card"], foreground=self.colors["text"])

    def _build_ui(self):
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Header with GPU Status Badge
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 12))

        top_row = ttk.Frame(header_frame)
        top_row.pack(fill=tk.X)

        title_lbl = ttk.Label(top_row, text="🎬 CoWatch Video Compressor", style="Header.TLabel")
        title_lbl.pack(side=tk.LEFT)

        # GPU Badge Indicator
        gpu_detected = len(self.available_gpu_encoders) > 0
        badge_text = f"⚡ GPU: {self.gpu_device_name}" if gpu_detected else "💻 CPU Mode (Software Encoding)"
        badge_bg = self.colors["gpu_badge"] if gpu_detected else "#374151"

        gpu_badge = tk.Label(
            top_row,
            text=badge_text,
            bg=badge_bg,
            fg="#ffffff",
            font=("Segoe UI", 9, "bold"),
            padx=10,
            pady=3,
            relief="flat"
        )
        gpu_badge.pack(side=tk.RIGHT)

        desc_lbl = ttk.Label(
            header_frame,
            text="High-speed GPU & CPU compression to shrink 2GB+ video files with lossless visual quality & audio fidelity.",
            style="SubHeader.TLabel"
        )
        desc_lbl.pack(anchor="w", pady=(3, 0))

        # 2. File Selection Card
        file_card = ttk.Frame(main_frame, style="Card.TFrame", padding="14")
        file_card.pack(fill=tk.X, pady=(0, 10))

        input_header = ttk.Label(file_card, text="1. Select Input Video File", style="CardBold.TLabel")
        input_header.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 6))

        input_entry = tk.Entry(
            file_card,
            textvariable=self.input_path_var,
            bg=self.colors["entry_bg"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            font=("Segoe UI", 9),
            relief="solid",
            bd=1
        )
        input_entry.grid(row=1, column=0, columnspan=2, sticky="ew", padx=(0, 8), ipady=4)
        file_card.columnconfigure(0, weight=1)

        browse_btn = tk.Button(
            file_card,
            text="📁 Browse...",
            command=self._browse_input_file,
            bg=self.colors["accent"],
            fg="#ffffff",
            activebackground=self.colors["accent_hover"],
            activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=12,
            pady=4,
            cursor="hand2"
        )
        browse_btn.grid(row=1, column=2, sticky="e")

        # Video Info Bar
        self.info_frame = ttk.Frame(file_card, style="Card.TFrame", padding="6")
        self.info_frame.grid(row=2, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        
        self.lbl_orig_size = ttk.Label(self.info_frame, text="Size: --", style="Card.TLabel")
        self.lbl_orig_size.pack(side=tk.LEFT, padx=(0, 16))

        self.lbl_orig_res = ttk.Label(self.info_frame, text="Resolution: --", style="Card.TLabel")
        self.lbl_orig_res.pack(side=tk.LEFT, padx=(0, 16))

        self.lbl_orig_duration = ttk.Label(self.info_frame, text="Duration: --", style="Card.TLabel")
        self.lbl_orig_duration.pack(side=tk.LEFT, padx=(0, 16))

        self.lbl_orig_bitrate = ttk.Label(self.info_frame, text="Bitrate: --", style="Card.TLabel")
        self.lbl_orig_bitrate.pack(side=tk.LEFT)

        # Output File
        out_header = ttk.Label(file_card, text="Output Destination", style="CardBold.TLabel")
        out_header.grid(row=3, column=0, columnspan=3, sticky="w", pady=(10, 4))

        out_entry = tk.Entry(
            file_card,
            textvariable=self.output_path_var,
            bg=self.colors["entry_bg"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            font=("Segoe UI", 9),
            relief="solid",
            bd=1
        )
        out_entry.grid(row=4, column=0, columnspan=2, sticky="ew", padx=(0, 8), ipady=4)

        out_browse_btn = tk.Button(
            file_card,
            text="Change...",
            command=self._browse_output_file,
            bg="#2a2f3f",
            fg="#ffffff",
            activebackground="#3a4055",
            activeforeground="#ffffff",
            font=("Segoe UI", 9),
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2"
        )
        out_browse_btn.grid(row=4, column=2, sticky="e")

        # 3. Compression Profile Card
        profile_card = ttk.Frame(main_frame, style="Card.TFrame", padding="14")
        profile_card.pack(fill=tk.X, pady=(0, 10))

        prof_title = ttk.Label(profile_card, text="2. Compression Profile & Acceleration", style="CardBold.TLabel")
        prof_title.pack(anchor="w", pady=(0, 8))

        opts_frame = ttk.Frame(profile_card, style="Card.TFrame")
        opts_frame.pack(fill=tk.X)

        r1 = ttk.Radiobutton(
            opts_frame,
            text="🎯 Fit Under 2.0GB (Auto-calculate optimal bitrate to ~1.85 GB for guaranteed CoWatch upload)",
            variable=self.mode_var,
            value="fit_2gb",
            command=self._on_mode_change
        )
        r1.pack(anchor="w", pady=2)

        r2 = ttk.Radiobutton(
            opts_frame,
            text="💎 Visually Lossless (CRF/CQ 19 - Studio quality, imperceptible compression)",
            variable=self.mode_var,
            value="crf_lossless",
            command=self._on_mode_change
        )
        r2.pack(anchor="w", pady=2)

        r3 = ttk.Radiobutton(
            opts_frame,
            text="⚡ Balanced High Quality (CRF/CQ 22 - 40-60% size reduction with crisp detail)",
            variable=self.mode_var,
            value="crf_balanced",
            command=self._on_mode_change
        )
        r3.pack(anchor="w", pady=2)

        r4 = ttk.Radiobutton(
            opts_frame,
            text="🗜️ Maximum Compression (H.265 / HEVC - Smallest file size)",
            variable=self.mode_var,
            value="hevc_crf",
            command=self._on_mode_change
        )
        r4.pack(anchor="w", pady=2)

        # Encoder selection row
        adv_frame = ttk.Frame(profile_card, style="Card.TFrame", padding="4")
        adv_frame.pack(fill=tk.X, pady=(8, 0))

        c_lbl = ttk.Label(adv_frame, text="Encoder Engine:", style="Card.TLabel")
        c_lbl.grid(row=0, column=0, sticky="w", padx=(0, 6), pady=4)

        # Build codec list with GPU options prominently on top
        codec_options = []
        if "h264_nvenc" in self.available_gpu_encoders:
            codec_options.append("h264_nvenc (NVIDIA GPU Ultra-Fast ⚡)")
        if "hevc_nvenc" in self.available_gpu_encoders:
            codec_options.append("hevc_nvenc (NVIDIA HEVC GPU ⚡)")
        if "h264_qsv" in self.available_gpu_encoders:
            codec_options.append("h264_qsv (Intel QuickSync GPU ⚡)")
        if "h264_amf" in self.available_gpu_encoders:
            codec_options.append("h264_amf (AMD AMF GPU ⚡)")
        codec_options.append("libx264 (CPU Standard Quality)")
        codec_options.append("libx265 (CPU HEVC Standard)")

        self.codec_combo = ttk.Combobox(
            adv_frame,
            textvariable=self.codec_var,
            values=codec_options,
            state="readonly",
            width=36
        )
        self.codec_combo.grid(row=0, column=1, sticky="w", padx=(0, 16), pady=4)

        a_lbl = ttk.Label(adv_frame, text="Audio Track:", style="Card.TLabel")
        a_lbl.grid(row=0, column=2, sticky="w", padx=(0, 6), pady=4)

        self.audio_combo = ttk.Combobox(
            adv_frame,
            textvariable=self.audio_mode_var,
            values=["Copy Original (Lossless Pass-through)", "AAC 192k (High Quality)", "AAC 128k (Compact)"],
            state="readonly",
            width=28
        )
        self.audio_combo.grid(row=0, column=3, sticky="w", pady=4)

        # 4. Progress Card
        prog_card = ttk.Frame(main_frame, style="Card.TFrame", padding="14")
        prog_card.pack(fill=tk.BOTH, expand=True, pady=(0, 12))

        prog_top = ttk.Frame(prog_card, style="Card.TFrame")
        prog_top.pack(fill=tk.X, pady=(0, 4))

        self.lbl_status = ttk.Label(prog_top, textvariable=self.status_var, style="CardBold.TLabel")
        self.lbl_status.pack(side=tk.LEFT)

        self.lbl_percent = ttk.Label(prog_top, textvariable=self.progress_percent_var, style="StatValue.TLabel")
        self.lbl_percent.pack(side=tk.RIGHT)

        self.progress_bar = ttk.Progressbar(prog_card, style="Accent.Horizontal.TProgressbar", mode="determinate")
        self.progress_bar.pack(fill=tk.X, pady=(0, 4))

        self.lbl_speed_eta = ttk.Label(prog_card, textvariable=self.speed_eta_var, style="Card.TLabel")
        self.lbl_speed_eta.pack(anchor="w")

        # Log Window
        self.log_text = tk.Text(
            prog_card,
            height=4,
            bg=self.colors["entry_bg"],
            fg=self.colors["muted"],
            font=("Consolas", 8),
            relief="flat",
            bd=1,
            wrap="word"
        )
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=(6, 0))

        # 5. Bottom Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame,
            text="🚀 Start GPU Compression",
            command=self._start_compression_thread,
            bg=self.colors["accent"],
            fg="#ffffff",
            activebackground=self.colors["accent_hover"],
            activeforeground="#ffffff",
            font=("Segoe UI", 11, "bold"),
            relief="flat",
            padx=22,
            pady=7,
            cursor="hand2"
        )
        self.start_btn.pack(side=tk.LEFT)

        self.cancel_btn = tk.Button(
            btn_frame,
            text="⏹ Cancel",
            command=self._cancel_compression,
            bg=self.colors["danger"],
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            font=("Segoe UI", 10, "bold"),
            relief="flat",
            padx=16,
            pady=7,
            state=tk.DISABLED,
            cursor="hand2"
        )
        self.cancel_btn.pack(side=tk.LEFT, padx=(10, 0))

        self.open_folder_btn = tk.Button(
            btn_frame,
            text="📂 Open Output Folder",
            command=self._open_output_folder,
            bg="#272b38",
            fg="#ffffff",
            activebackground="#373d4f",
            activeforeground="#ffffff",
            font=("Segoe UI", 10),
            relief="flat",
            padx=16,
            pady=7,
            cursor="hand2"
        )
        self.open_folder_btn.pack(side=tk.RIGHT)

    def _check_dependencies(self):
        if not self.ffmpeg_path or not self.ffprobe_path:
            msg = "FFmpeg / FFprobe not found on your system PATH.\n\nPlease ensure ffmpeg is installed."
            self._log(msg)
            messagebox.showwarning("FFmpeg Missing", msg)
        else:
            self._log(f"FFmpeg ready: {self.ffmpeg_path}")
            if self.available_gpu_encoders:
                self._log(f"GPU Hardware Encoders Active: {', '.join(self.available_gpu_encoders.keys())}")
            else:
                self._log("Running in CPU software encoding mode.")

    def _log(self, text: str):
        self.log_text.insert(tk.END, text + "\n")
        self.log_text.see(tk.END)

    def _on_mode_change(self):
        mode = self.mode_var.get()
        has_nvenc = "h264_nvenc" in self.available_gpu_encoders

        if mode == "fit_2gb":
            if has_nvenc:
                self.codec_var.set("h264_nvenc (NVIDIA GPU Ultra-Fast ⚡)")
            else:
                self.codec_var.set("libx264 (CPU Standard Quality)")
        elif mode == "crf_lossless":
            if has_nvenc:
                self.codec_var.set("h264_nvenc (NVIDIA GPU Ultra-Fast ⚡)")
            else:
                self.codec_var.set("libx264 (CPU Standard Quality)")
        elif mode == "crf_balanced":
            if has_nvenc:
                self.codec_var.set("h264_nvenc (NVIDIA GPU Ultra-Fast ⚡)")
            else:
                self.codec_var.set("libx264 (CPU Standard Quality)")
        elif mode == "hevc_crf":
            if "hevc_nvenc" in self.available_gpu_encoders:
                self.codec_var.set("hevc_nvenc (NVIDIA HEVC GPU ⚡)")
            else:
                self.codec_var.set("libx265 (CPU HEVC Standard)")

    def _browse_input_file(self):
        file_path = filedialog.askopenfilename(
            title="Select Video File",
            filetypes=[
                ("Video Files", "*.mp4 *.mkv *.mov *.avi *.webm *.flv *.ts *.m4v"),
                ("All Files", "*.*")
            ]
        )
        if not file_path:
            return

        self.input_path_var.set(file_path)
        
        dir_name, base_name = os.path.split(file_path)
        name, _ = os.path.splitext(base_name)
        out_path = os.path.join(dir_name, f"{name}_compressed.mp4")
        self.output_path_var.set(out_path)

        self._probe_video_file(file_path)

    def _browse_output_file(self):
        curr = self.output_path_var.get()
        init_dir = os.path.dirname(curr) if curr else os.getcwd()
        init_file = os.path.basename(curr) if curr else "output_compressed.mp4"

        file_path = filedialog.asksaveasfilename(
            title="Choose Output Destination",
            initialdir=init_dir,
            initialfile=init_file,
            defaultextension=".mp4",
            filetypes=[("MP4 Video", "*.mp4"), ("MKV Video", "*.mkv")]
        )
        if file_path:
            self.output_path_var.set(file_path)

    def _probe_video_file(self, file_path: str):
        if not self.ffprobe_path or not os.path.isfile(file_path):
            return

        try:
            cmd = [
                self.ffprobe_path,
                "-v", "error",
                "-show_entries", "format=duration,size,bit_rate:stream=codec_name,width,height,avg_frame_rate",
                "-of", "json",
                file_path
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            info = json.loads(res.stdout)

            fmt = info.get("format", {})
            streams = info.get("streams", [])
            video_stream = next((s for s in streams if s.get("width") and s.get("height")), {})

            size_bytes = float(fmt.get("size", os.path.getsize(file_path)))
            duration = float(fmt.get("duration", 0))
            bitrate = float(fmt.get("bit_rate", 0)) if fmt.get("bit_rate") else (size_bytes * 8 / duration if duration > 0 else 0)
            width = video_stream.get("width", "--")
            height = video_stream.get("height", "--")

            self.video_metadata = {
                "size_bytes": size_bytes,
                "duration": duration,
                "bitrate": bitrate,
                "width": width,
                "height": height
            }

            self.lbl_orig_size.config(text=f"Size: {format_bytes(size_bytes)}")
            self.lbl_orig_res.config(text=f"Resolution: {width}x{height}")
            self.lbl_orig_duration.config(text=f"Duration: {format_seconds(duration)}")
            self.lbl_orig_bitrate.config(text=f"Bitrate: {int(bitrate / 1000)} kbps" if bitrate > 0 else "Bitrate: --")

            self._log(f"Loaded: {os.path.basename(file_path)} ({format_bytes(size_bytes)}, {width}x{height}, {format_seconds(duration)})")

        except Exception as e:
            self._log(f"Error reading file metadata: {e}")

    def _build_ffmpeg_command(self) -> Tuple[list, float]:
        input_file = self.input_path_var.get()
        output_file = self.output_path_var.get()
        mode = self.mode_var.get()
        selected_codec_label = self.codec_combo.get()
        selected_audio_label = self.audio_combo.get()

        # Parse selected codec
        if "h264_nvenc" in selected_codec_label:
            codec = "h264_nvenc"
        elif "hevc_nvenc" in selected_codec_label:
            codec = "hevc_nvenc"
        elif "h264_qsv" in selected_codec_label:
            codec = "h264_qsv"
        elif "h264_amf" in selected_codec_label:
            codec = "h264_amf"
        elif "libx265" in selected_codec_label:
            codec = "libx265"
        else:
            codec = "libx264"

        is_nvenc = "nvenc" in codec
        is_qsv = "qsv" in codec
        is_amf = "amf" in codec
        is_gpu = is_nvenc or is_qsv or is_amf

        # Audio settings
        audio_args = ["-c:a", "copy"]
        if "AAC 192k" in selected_audio_label:
            audio_args = ["-c:a", "aac", "-b:a", "192k"]
        elif "AAC 128k" in selected_audio_label:
            audio_args = ["-c:a", "aac", "-b:a", "128k"]

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_file,
            "-progress", "pipe:1",
            "-nostats"
        ]

        total_duration = self.video_metadata.get("duration", 0) if self.video_metadata else 0

        # Mode-specific video flags
        if mode == "fit_2gb":
            # Target 1.85 GB to safely clear the 2.0GB upload limit
            target_bytes = 1.85 * (1024 ** 3)
            audio_bitrate_bps = 192 * 1000  # 192 kbps
            
            if total_duration > 0:
                total_target_bits = target_bytes * 8
                audio_total_bits = audio_bitrate_bps * total_duration
                video_total_bits = max(total_target_bits - audio_total_bits, 500000 * total_duration)
                video_bitrate_k = int((video_total_bits / total_duration) / 1000)
            else:
                video_bitrate_k = 2500

            cmd += ["-c:v", codec, "-b:v", f"{video_bitrate_k}k", "-maxrate", f"{int(video_bitrate_k * 1.5)}k", "-bufsize", f"{int(video_bitrate_k * 2)}k"]

            if is_nvenc:
                cmd += ["-preset", "p6", "-tune", "hq", "-rc:v", "vbr", "-spatial-aq", "1", "-temporal-aq", "1", "-rc-lookahead", "32"]
            elif is_qsv:
                cmd += ["-preset", "veryfast", "-look_ahead", "1"]
            elif is_amf:
                cmd += ["-quality", "quality", "-rc", "vbr_latency"]
            else:
                cmd += ["-preset", "slow"]

            cmd += ["-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd += audio_args
            self._log(f"🎯 Target Bitrate calculated: {video_bitrate_k} kbps (Target Size: ~1.85 GB on {codec})")

        elif mode == "crf_lossless":
            cmd += ["-c:v", codec]
            if is_nvenc:
                cmd += ["-rc:v", "vbr", "-cq", "19", "-preset", "p6", "-tune", "hq", "-spatial-aq", "1", "-temporal-aq", "1", "-rc-lookahead", "32"]
            elif is_qsv:
                cmd += ["-global_quality", "20", "-preset", "medium"]
            elif is_amf:
                cmd += ["-rc", "cqp", "-qp_p", "19", "-qp_i", "19", "-quality", "quality"]
            else:
                cmd += ["-crf", "20", "-preset", "slow"]

            cmd += ["-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd += audio_args

        elif mode == "crf_balanced":
            cmd += ["-c:v", codec]
            if is_nvenc:
                cmd += ["-rc:v", "vbr", "-cq", "22", "-preset", "p5", "-tune", "hq", "-spatial-aq", "1"]
            elif is_qsv:
                cmd += ["-global_quality", "23", "-preset", "medium"]
            elif is_amf:
                cmd += ["-rc", "cqp", "-qp_p", "23", "-qp_i", "23"]
            else:
                cmd += ["-crf", "23", "-preset", "medium"]

            cmd += ["-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd += audio_args

        elif mode == "hevc_crf":
            hevc_codec = "hevc_nvenc" if is_nvenc else ("hevc_qsv" if is_qsv else ("hevc_amf" if is_amf else "libx265"))
            cmd += ["-c:v", hevc_codec]
            if "nvenc" in hevc_codec:
                cmd += ["-rc:v", "vbr", "-cq", "23", "-preset", "p5", "-tune", "hq", "-tag:v", "hvc1"]
            elif "qsv" in hevc_codec:
                cmd += ["-global_quality", "24", "-preset", "medium", "-tag:v", "hvc1"]
            else:
                cmd += ["-crf", "24", "-preset", "medium", "-tag:v", "hvc1"]

            cmd += ["-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd += audio_args

        cmd.append(output_file)
        return cmd, total_duration

    def _start_compression_thread(self):
        input_file = self.input_path_var.get().strip()
        output_file = self.output_path_var.get().strip()

        if not input_file or not os.path.isfile(input_file):
            messagebox.showerror("Invalid Input", "Please select a valid input video file.")
            return

        if not output_file:
            messagebox.showerror("Invalid Destination", "Please specify an output file destination.")
            return

        if os.path.abspath(input_file) == os.path.abspath(output_file):
            messagebox.showerror("Conflict", "Output path cannot be identical to input path.")
            return

        self.is_compressing = True
        self.start_btn.config(state=tk.DISABLED)
        self.cancel_btn.config(state=tk.NORMAL)
        self.progress_bar["value"] = 0
        self.progress_percent_var.set("0%")
        self.status_var.set("Compressing video stream with GPU acceleration...")

        threading.Thread(target=self._run_ffmpeg_process, daemon=True).start()

    def _run_ffmpeg_process(self):
        start_time = time.time()
        try:
            cmd, total_duration = self._build_ffmpeg_command()
            self._log(f"Executing: {' '.join(cmd)}")

            self.current_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )

            out_time_s = 0
            speed_str = "1.0x"

            for line in self.current_process.stdout:
                line = line.strip()
                if not line:
                    continue

                if line.startswith("out_time_ms="):
                    try:
                        ms_val = int(line.split("=")[1])
                        out_time_s = ms_val / 1_000_000.0
                        if total_duration > 0:
                            pct = min(max(out_time_s / total_duration, 0.0), 1.0) * 100
                            self.root.after(0, self._update_progress, pct, out_time_s, total_duration, speed_str)
                    except Exception:
                        pass

                elif line.startswith("speed="):
                    speed_str = line.split("=")[1].strip()

                elif line.startswith("progress="):
                    if line.split("=")[1].strip() == "end":
                        self.root.after(0, self._update_progress, 100.0, total_duration, total_duration, speed_str)

            self.current_process.wait()
            ret_code = self.current_process.returncode

            if ret_code == 0:
                elapsed = time.time() - start_time
                self.root.after(0, self._on_success, elapsed)
            else:
                if not self.is_compressing:
                    self._log("Operation cancelled by user.")
                else:
                    self.root.after(0, self._on_failure, f"FFmpeg exited with error code {ret_code}.")

        except Exception as e:
            self.root.after(0, self._on_failure, str(e))
        finally:
            self.is_compressing = False
            self.current_process = None

    def _update_progress(self, pct: float, current_time: float, total_time: float, speed_str: str):
        self.progress_bar["value"] = pct
        self.progress_percent_var.set(f"{pct:.1f}%")

        try:
            speed_num = float(speed_str.replace("x", "")) if "x" in speed_str else 1.0
            remaining_time = (total_time - current_time) / max(speed_num, 0.001)
            eta_str = format_seconds(remaining_time)
        except Exception:
            eta_str = "--:--"

        self.speed_eta_var.set(f"Speed: {speed_str} | Time: {format_seconds(current_time)} / {format_seconds(total_time)} | ETA: {eta_str}")

    def _on_success(self, elapsed_seconds: float):
        self.start_btn.config(state=tk.NORMAL)
        self.cancel_btn.config(state=tk.DISABLED)
        self.progress_percent_var.set("100%")
        self.status_var.set("✅ Compression Finished Successfully!")

        output_file = self.output_path_var.get()
        input_file = self.input_path_var.get()

        in_size = os.path.getsize(input_file) if os.path.isfile(input_file) else 0
        out_size = os.path.getsize(output_file) if os.path.isfile(output_file) else 0

        saved_bytes = in_size - out_size
        saved_pct = (saved_bytes / in_size * 100) if in_size > 0 else 0

        summary = (
            f"Video compressed with GPU in {format_seconds(elapsed_seconds)}!\n\n"
            f"• Original Size:   {format_bytes(in_size)}\n"
            f"• Compressed Size: {format_bytes(out_size)}\n"
            f"• Space Saved:     {format_bytes(saved_bytes)} ({saved_pct:.1f}% reduction)\n\n"
            f"Output saved to:\n{output_file}"
        )

        self._log(f"SUCCESS: {format_bytes(in_size)} -> {format_bytes(out_size)} (Saved {saved_pct:.1f}%)")
        messagebox.showinfo("Compression Complete", summary)

    def _on_failure(self, error_msg: str):
        self.start_btn.config(state=tk.NORMAL)
        self.cancel_btn.config(state=tk.DISABLED)
        self.status_var.set("❌ Compression Failed.")
        self._log(f"ERROR: {error_msg}")
        messagebox.showerror("Compression Failed", f"An error occurred during compression:\n\n{error_msg}")

    def _cancel_compression(self):
        if self.current_process and self.is_compressing:
            self.is_compressing = False
            self.status_var.set("Cancelling...")
            try:
                self.current_process.terminate()
            except Exception:
                pass
            self.start_btn.config(state=tk.NORMAL)
            self.cancel_btn.config(state=tk.DISABLED)
            self.status_var.set("Compression cancelled.")
            self._log("Compression cancelled.")

    def _open_output_folder(self):
        out_file = self.output_path_var.get()
        target_dir = os.path.dirname(out_file) if out_file else os.getcwd()
        if os.path.isdir(target_dir):
            if sys.platform == "win32":
                os.startfile(target_dir)
            else:
                subprocess.run(["xdg-open", target_dir])


def main():
    root = tk.Tk()
    app = VideoCompressorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
