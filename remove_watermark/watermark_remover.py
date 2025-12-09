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
CROP_BOTTOM = 50
CROP_LEFT = 16/9 * CROP_TOP
CROP_RIGHT = 16/9 * CROP_BOTTOM

FFMPEG_V_CODEC = "libx264"
FFMPEG_PRESET = "fast"
FFMPEG_CRF = "22"
FFMPEG_AUDIO_BITRATE = "128k"

# New option: remove audio from output files. Set to True to strip audio.
REMOVE_AUDIO = True

if not os.path.exists(INPUT_DIR) or not os.listdir(INPUT_DIR):
    if os.path.exists(ALT_INPUT_DIR) and os.listdir(ALT_INPUT_DIR):
        INPUT_DIR = ALT_INPUT_DIR
        PROCESSED_DIR = os.path.join(BASE_DIR, "videos")
    else:
        pass

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

ffmpeg_cmd = shutil.which("ffmpeg")
# Prefer ffprobe for probing metadata (more reliable for width/height/fps).
ffprobe_cmd = shutil.which("ffprobe")

def run_ffmpeg_crop(input_path, output_path, x, y, w, h, max_duration=None):
    """Run ffmpeg crop and re-encode to H.264/AAC (or strip audio) with safe options.
       If max_duration is provided, limit output duration with -t.
    """
    if not ffmpeg_cmd:
        print("ffmpeg not found; cannot run ffmpeg crop.")
        return False

    # Ensure crop parameters are ints
    x = int(x)
    y = int(y)
    w = int(w)
    h = int(h)

    vf = f"crop={w}:{h}:{x}:{y},format=yuv420p"
    cmd = [
        ffmpeg_cmd, "-y", "-i", input_path,
        "-vf", vf,
        "-c:v", FFMPEG_V_CODEC, "-preset", FFMPEG_PRESET, "-crf", FFMPEG_CRF,
        "-pix_fmt", "yuv420p",
    ]

    if REMOVE_AUDIO:
        # Strip audio
        cmd += ["-an"]
    else:
        # Re-encode audio to AAC
        cmd += ["-c:a", "aac", "-b:a", FFMPEG_AUDIO_BITRATE]

    # If requested, limit duration
    if max_duration is not None:
        try:
            max_d = float(max_duration)
            if max_d > 0:
                cmd += ["-t", str(max_d)]
        except Exception:
            pass

    # faststart for web playback
    cmd += ["-movflags", "+faststart", output_path]

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


def opencv_crop_fallback(input_path, output_path, x, y, w, h, fps_fallback=25.0, max_duration=None):
    """Crop using OpenCV and write with a tested codec. Returns True on success.
       If max_duration is provided, only write frames up to that duration.
    """
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

    # Calculate how many frames to write if trimming
    frames_to_write = None
    if max_duration is not None:
        try:
            md = float(max_duration)
            if md > 0:
                frames_to_write = int(round(fps * md))
        except Exception:
            frames_to_write = None

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
    frames_written = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frames_to_write is not None and frames_written >= frames_to_write:
            break
        crop = frame[y:y + tgt_h, x:x + tgt_w]
        if crop.shape[1] != tgt_w or crop.shape[0] != tgt_h:
            try:
                crop = cv2.resize(crop, (tgt_w, tgt_h))
            except Exception as e:
                print(f"Resize failed: {e}")
                break
        writer.write(crop)
        frames_written += 1

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
    src_duration = None
    if cv2 is not None:
        cap = cv2.VideoCapture(input_path)
        if cap.isOpened():
            src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            src_fps = cap.get(cv2.CAP_PROP_FPS)
            # Try to compute duration from frame count and fps
            try:
                frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
                if frame_count and src_fps and src_fps > 0:
                    src_duration = float(frame_count) / float(src_fps)
            except Exception:
                src_duration = None
            cap.release()
    if (src_w is None or src_h is None) and (ffprobe_cmd or ffmpeg_cmd):
        # Prefer ffprobe for reliable metadata extraction
        probe_cmd = None
        if ffprobe_cmd:
            probe_cmd = [ffprobe_cmd, "-v", "error", "-select_streams", "v:0",
                         "-show_entries", "stream=width,height,r_frame_rate", "-of",
                         "default=noprint_wrappers=1:nokey=1", input_path]
        elif ffmpeg_cmd:
            # Fallback: use ffmpeg to print stream info (less reliable)
            probe_cmd = [ffmpeg_cmd, "-v", "error", "-i", input_path, "-hide_banner", "-map", "0:v:0", "-show_entries", "stream=width,height,r_frame_rate", "-print_format", "default=nokey=1:noprint_wrappers=1"]

        if probe_cmd:
            try:
                probe = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                lines = probe.stdout.strip().splitlines()
                if len(lines) >= 2:
                    # Expect width, height, and optionally r_frame_rate
                    try:
                        src_w = int(lines[0])
                        src_h = int(lines[1])
                    except Exception:
                        src_w = src_h = None
                    if len(lines) >= 3:
                        try:
                            if '/' in lines[2]:
                                num, den = lines[2].split('/')
                                src_fps = float(num) / float(den)
                            else:
                                src_fps = float(lines[2])
                        except Exception:
                            src_fps = None
            except Exception:
                pass

    # Try to get duration via ffprobe if not already known
    if src_duration is None and ffprobe_cmd:
        try:
            p = subprocess.run([ffprobe_cmd, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            out = p.stdout.strip()
            if out:
                try:
                    src_duration = float(out)
                except Exception:
                    src_duration = None
        except Exception:
            src_duration = None

    if src_w is None or src_h is None:
        print(f"Could not determine source resolution for {video_file}; skipping.")
        return

    x = int(CROP_LEFT)
    y = int(CROP_TOP)
    w = int(round(src_w - CROP_LEFT - CROP_RIGHT))
    h = int(round(src_h - CROP_TOP - CROP_BOTTOM))

    if w <= 0 or h <= 0:
        print(f"Invalid crop resulting size for {video_file} (w={w}, h={h}). Skipping.")
        return

    if w % 2 == 1:
        w -= 1
    if h % 2 == 1:
        h -= 1

    # Decide if we should trim to 5 seconds
    max_duration = None
    if src_duration is not None and src_duration > 5.0:
        max_duration = 5.0
        print(f"Source duration {src_duration:.2f}s > 5s — will trim output to {max_duration}s")

    print(f"Processing '{video_file}': src={src_w}x{src_h}, crop -> x={x},y={y},w={w},h={h}")

    success = False
    if ffmpeg_cmd:
        success = run_ffmpeg_crop(input_path, output_path, x, y, w, h, max_duration=max_duration)
    if not success:
        print("FFmpeg not used or failed; attempting OpenCV fallback.")
        success = opencv_crop_fallback(input_path, output_path, x, y, w, h, fps_fallback=(src_fps or 25.0), max_duration=max_duration)

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