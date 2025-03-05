import yt_dlp
import sys

def download_audio(url, output_path):
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output_path,
        'quiet': False,
        'ffmpeg_location': '/var/task/bin/ffmpeg-linux',  # Ensure this path matches your Vercel directory
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        print(f"Error downloading audio: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python download_audio.py <YouTube URL> <output_path>")
        sys.exit(1)
    
    url = sys.argv[1]
    output_path = sys.argv[2]
    download_audio(url, output_path)
