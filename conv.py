import subprocess

input_file = "input.mkv"
output_file = "output.mp4"

cmd = [
    "ffmpeg",
    "-i", input_file,
    "-c:v", "libx264",
    "-c:a", "aac",
    output_file
]

subprocess.run(cmd)