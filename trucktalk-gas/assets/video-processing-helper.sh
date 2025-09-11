# Video Processing Helper Script

# This script helps you prepare videos for your README
# Run these commands in your terminal to process videos

# 1. Convert video to optimized MP4 (requires FFMPEG)
# ffmpeg -i input-video.mov -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k ./assets/demo-video.mp4

# 2. Create a GIF from video (first 30 seconds, optimized)
# ffmpeg -i input-video.mov -t 30 -vf "fps=10,scale=640:-1:flags=lanczos" ./assets/demo.gif

# 3. Extract thumbnail from video (at 5 second mark)
# ffmpeg -i input-video.mov -ss 00:00:05 -vframes 1 ./assets/thumbnail.png

# 4. Reduce file size if needed
# ffmpeg -i ./assets/demo-video.mp4 -crf 28 -preset slower ./assets/demo-video-compressed.mp4

echo "Video processing commands are ready!"
echo "Install FFMPEG first: https://ffmpeg.org/download.html"
echo ""
echo "Alternative tools:"
echo "- HandBrake (GUI): https://handbrake.fr/"
echo "- Online converters: CloudConvert, Online-Convert"
echo "- OBS Studio (recording): https://obsproject.com/"
echo ""
echo "Steps to add your video:"
echo "1. Record your demo (show TruckTalk Connect features)"
echo "2. Save/convert to MP4 format"
echo "3. Copy to the 'assets' folder"
echo "4. Update README.md with correct filename"
echo "5. Commit and push changes"
