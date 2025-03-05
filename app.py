import os
import subprocess
import tempfile
from flask import Flask, request, jsonify
from twilio.twiml.messaging_response import MessagingResponse

app = Flask(__name__)

# Path to your yt-dlp and ffmpeg binaries in Vercel's filesystem
YTDLP_BIN = '/var/task/bin/yt-dlp'  # Path in Vercel
FFMPEG_BIN = '/var/task/bin/ffmpeg'  # Path in Vercel

@app.route('/webhook', methods=['POST'])
def webhook():
    # Extract the video URL from the incoming WhatsApp message
    message_body = request.form['Body']
    
    try:
        video_url = message_body.strip()

        # Download audio using yt-dlp
        output_file = tempfile.mktemp(suffix='.mp3')
        download_audio(video_url, output_file)

        # Send the audio file back
        return send_audio_file(output_file)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def download_audio(video_url, output_file):
    # Run yt-dlp to download the audio
    command = [
        YTDLP_BIN,
        video_url,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--output', output_file,
        '--ffmpeg-location', FFMPEG_BIN
    ]

    process = subprocess.run(command, capture_output=True, text=True)

    if process.returncode != 0:
        raise Exception(f"Error downloading audio: {process.stderr}")
    
    print("Audio downloaded successfully!")

def send_audio_file(file_path):
    # This would be used to send the file back via Twilio API
    response = MessagingResponse()
    response.message().media(file_path)  # This will send the audio as a media file in WhatsApp

    return str(response)

if __name__ == '__main__':
    app.run(debug=True)
