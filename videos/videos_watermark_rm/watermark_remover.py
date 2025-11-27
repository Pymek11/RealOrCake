import cv2
import os
import shutil

input_folder = "videos/videos_watermark_rm/videos"
cropped_output_folder = "videos/videos_watermark_rm/videos_cut"
processed_originals_folder = "videos/videos_watermark_rm/videos2"

if not os.listdir(input_folder):
    input_folder = "videos/videos_watermark_rm/videos2"
    processed_originals_folder = "videos/videos_watermark_rm/videos"

crop_left = 0
crop_right = 100
crop_bottom = 70

video_files = [f for f in os.listdir(input_folder) if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]

if not video_files:
    print(f"No video files found in the '{input_folder}' directory.")
else:
    for video_file in video_files:
        input_path = os.path.join(input_folder, video_file)

        base_name = os.path.splitext(video_file)[0]
        output_filename = f"{base_name}_cut.mp4"
        cropped_video_path = os.path.join(cropped_output_folder, output_filename)

        processed_original_path = os.path.join(processed_originals_folder, video_file)

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            print(f"ERROR: Cannot open video file: {input_path}")
            continue

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        new_width = width - crop_left - crop_right
        new_height = height - crop_bottom

        if new_width <= 0 or new_height <= 0:
            print(f"ERROR: Crop dimensions are larger than the video size for {video_file}. Skipping.")
            cap.release()
            continue

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(cropped_video_path, fourcc, fps, (new_width, new_height))

        print(f"Processing '{video_file}'...")
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            cropped = frame[0:new_height, crop_left:width - crop_right]
            out.write(cropped)

        cap.release()
        out.release()

        print(f"Saved cropped video to '{cropped_video_path}'")

        try:
            shutil.move(input_path, processed_original_path)
            print(f"Moved original file to '{processed_original_path}'\n")
        except Exception as e:
            print(f"ERROR: Could not move original file '{input_path}': {e}\n")

print("All videos processed successfully!")
