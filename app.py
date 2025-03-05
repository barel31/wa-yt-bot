from flask import Flask, request, jsonify
import os
import subprocess
import tempfile

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        # Get the URL from the request
        data = request.get_json()
        video_url = data.get("url")

        if not video_url:
            return jsonify({"error": "No URL provided"}), 400

        # Temporary file path
        temp_audio_path = tempfile.mktemp(suffix='.mp3')

        # Run yt-dlp to extract audio
        yt_dlp_command = [
            "yt-dlp", video_url, 
            "--extract-audio", 
            "--audio-format", "mp3", 
            "--output", temp_audio_path
        ]

        # Run the command to download and convert the audio
        subprocess.run(yt_dlp_command, check=True)

        return jsonify({"status": "success", "message": "Audio downloaded successfully", "audio_path": temp_audio_path}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
