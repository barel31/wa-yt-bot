from flask import Flask, request, jsonify
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client
import yt_dlp
import os
import shutil
import tempfile

app = Flask(__name__)

# Your Twilio account SID and Auth token
account_sid = 'your_account_sid'
auth_token = 'your_auth_token'
client = Client(account_sid, auth_token)

# Temporary directory for downloaded MP3 files
TEMP_DIR = tempfile.mkdtemp()

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.json
    video_url = data.get('url')

    if not video_url:
        return jsonify({"message": "No URL provided"}), 400

    try:
        # Download audio from YouTube
        audio_path = download_audio(video_url)

        # Send the MP3 file via WhatsApp
        send_whatsapp_audio(audio_path)

        return jsonify({"message": "Audio sent successfully", "audio_path": audio_path}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

def download_audio(url):
    try:
        # Use yt-dlp to download audio from the URL
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(TEMP_DIR, 'audio.mp3'),
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        return os.path.join(TEMP_DIR, 'audio.mp3')
    except Exception as e:
        raise Exception(f"Error downloading audio: {str(e)}")

def send_whatsapp_audio(audio_path):
    # Send the audio file via WhatsApp using Twilio API
    media_url = upload_to_twilio(audio_path)

    message = client.messages.create(
        body="Here is the audio from the video you requested.",
        from_='whatsapp:+14155238886',  # Replace with your Twilio WhatsApp number
        to='whatsapp:+1234567890',  # Replace with recipient's WhatsApp number
        media_url=[media_url]
    )
    print(f"Message sent: {message.sid}")

def upload_to_twilio(audio_path):
    # Upload the audio file to Twilio and get the media URL
    media = client.media.create(
        file=open(audio_path, 'rb'),
    )
    return media.uri

if __name__ == '__main__':
    app.run(debug=True)
