#!/usr/bin/env python3
"""
watermark_remover_fixed.py

Crops videos by removing a margin (configurable) and writes browser-friendly MP4 outputs.
Preferred path: uses ffmpeg if available (recommended). Falls back to OpenCV writer otherwise.

Usage:
    python watermark_remover_fixed.py
"""

import os
import shutil
import subprocess
import sys

try:
    import cv2
except Exception as e:
    cv2 = None
    print("Warning: OpenCV not available. ffmpeg-only mode will be used if ffmpeg is installed.")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_DIR = os.path.join(BASE_DIR, "videos")         
ALT_INPUT_DIR = os.path.join(BASE_DIR, "videos2")   
OUTPUT_DIR = os.path.join(BASE_DIR, "videos_cut")    
PROCESSED_DIR = os.path.join(BASE_DIR, "videos2") 

CROP_TOP = 0
CROP_BOTTOM = 36
CROP_LEFT = 16/9 * CROP_TOP
CROP_RIGHT = 16/9 * CROP_BOTTOM

FFMPEG_V_CODEC = "libx264"
FFMPEG_PRESET = "fast"
FFMPEG_CRF = "22"
FFMPEG_AUDIO_BITRATE = "128k"

if not os.path.exists(INPUT_DIR) or not os.listdir(INPUT_DIR):
    if os.path.exists(ALT_INPUT_DIR) and os.listdir(ALT_INPUT_DIR):
        INPUT_DIR = ALT_INPUT_DIR
        PROCESSED_DIR = os.path.join(BASE_DIR, "videos")
    else:
        pass

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

ffmpeg_cmd = shutil.which("ffmpeg")

def run_ffmpeg_crop(input_path, output_path, x, y, w, h):
    """Run ffmpeg crop and re-encode to H.264/AAC with safe options."""
    vf = f"crop={w}:{h}:{x}:{y}"
    cmd = [
        ffmpeg_cmd, "-y", "-i", input_path,
        "-vf", vf,
        "-c:v", FFMPEG_V_CODEC, "-preset", FFMPEG_PRESET, "-crf", FFMPEG_CRF,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", FFMPEG_AUDIO_BITRATE,
        "-movflags", "+faststart",
        output_path
    ]
    print("Running ffmpeg:", " ".join(cmd))
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode == 0 and os.path.exists(output_path):
            print(f"ffmpeg success -> {output_path}")
            return True
        else:
            print(f"ffmpeg failed (code {proc.returncode}). stderr:\n{proc.stderr}")
            return False
    except Exception as e:
        print(f"ffmpeg execution error: {e}")
        return False

def opencv_crop_fallback(input_path, output_path, x, y, w, h, fps_fallback=25.0):
    """Crop using OpenCV and write with a tested codec. Returns True on success."""
    if cv2 is None:
        print("OpenCV not available; cannot use OpenCV fallback.")
        return False

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"OpenCV could not open {input_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS)
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if not fps or fps <= 0 or fps != fps:
        print(f"Invalid FPS detected ({fps}); using fallback {fps_fallback} fps")
        fps = fps_fallback

    tgt_w = int(w)
    tgt_h = int(h)
    if tgt_w <= 0 or tgt_h <= 0:
        print("Invalid target dimensions for OpenCV writer.")
        cap.release()
        return False
    if tgt_w % 2 == 1:
        tgt_w -= 1
    if tgt_h % 2 == 1:
        tgt_h -= 1

    codecs = ["mp4v", "avc1", "XVID"]
    writer = None
    for c in codecs:
        fourcc = cv2.VideoWriter_fourcc(*c)
        writer = cv2.VideoWriter(output_path, fourcc, float(fps), (tgt_w, tgt_h))
        if writer.isOpened():
            print(f"OpenCV writer opened with codec '{c}'")
            break
        else:
            try:
                writer.release()
            except Exception:
                pass
            writer = None

    if writer is None:
        print("OpenCV: failed to open any VideoWriter codec.")
        cap.release()
        return False

    print(f"OpenCV processing {os.path.basename(input_path)} -> {tgt_w}x{tgt_h} @ {fps}fps")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        crop = frame[y:y + tgt_h, x:x + tgt_w]
        if crop.shape[1] != tgt_w or crop.shape[0] != tgt_h:
            try:
                crop = cv2.resize(crop, (tgt_w, tgt_h))
            except Exception as e:
                print(f"Resize failed: {e}")
                break
        writer.write(crop)

    cap.release()
    writer.release()
    return os.path.exists(output_path)

def process_file(video_file):
    input_path = os.path.join(INPUT_DIR, video_file)
    base_name, _ = os.path.splitext(video_file)
    output_name = f"{base_name}_cut.mp4"
    output_path = os.path.join(OUTPUT_DIR, output_name)
    processed_original = os.path.join(PROCESSED_DIR, video_file)
    src_w = src_h = None
    src_fps = None
    if cv2 is not None:
        cap = cv2.VideoCapture(input_path)
        if cap.isOpened():
            src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            src_fps = cap.get(cv2.CAP_PROP_FPS)
            cap.release()
    if (src_w is None or src_h is None) and ffmpeg_cmd:
        try:
            probe = subprocess.run([ffmpeg_cmd, "-v", "error", "-select_streams", "v:0",
                                    "-show_entries", "stream=width,height,r_frame_rate", "-of",
                                    "default=noprint_wrappers=1:nokey=1", input_path],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            lines = probe.stdout.strip().splitlines()
            if len(lines) >= 3:
                src_w = int(lines[0])
                src_h = int(lines[1])
                try:
                    num, den = lines[2].split('/')
                    src_fps = float(num) / float(den)
                except Exception:
                    try:
                        src_fps = float(lines[2])
                    except Exception:
                        src_fps = None
        except Exception:
            pass

    if src_w is None or src_h is None:
        print(f"Could not determine source resolution for {video_file}; skipping.")
        return

    x = int(CROP_LEFT)
    y = int(CROP_TOP)
    w = int(src_w - CROP_LEFT - CROP_RIGHT)
    h = int(src_h - CROP_TOP - CROP_BOTTOM)

    if w <= 0 or h <= 0:
        print(f"Invalid crop resulting size for {video_file} (w={w}, h={h}). Skipping.")
        return

    if w % 2 == 1:
        w -= 1
    if h % 2 == 1:
        h -= 1

    print(f"Processing '{video_file}': src={src_w}x{src_h}, crop -> x={x},y={y},w={w},h={h}")

    success = False
    if ffmpeg_cmd:
        success = run_ffmpeg_crop(input_path, output_path, x, y, w, h)
    if not success:
        print("FFmpeg not used or failed; attempting OpenCV fallback.")
        success = opencv_crop_fallback(input_path, output_path, x, y, w, h, fps_fallback=(src_fps or 25.0))

    if success:
        print(f"Saved cropped video to: {output_path}")
        try:
            shutil.move(input_path, processed_original)
            print(f"Moved original to: {processed_original}")
        except Exception as e:
            print(f"Warning: could not move original file: {e}")
    else:
        print(f"Failed to produce output for {video_file}")

def main():
    files = [f for f in os.listdir(INPUT_DIR) if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]
    if not files:
        print("No video files found in input folder:", INPUT_DIR)
        return
    for f in files:
        process_file(f)
    print("Processing complete.")

if __name__ == "__main__":
    main()