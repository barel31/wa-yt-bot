import os
import yt_dlp
from flask import Flask, request, abort
from twilio.rest import Client

app = Flask(__name__)

# Environment variables
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')
# For a public URL: set this to the URL of your storage (e.g., an S3 bucket) where you can serve the audio file
PUBLIC_URL_BASE = os.environ.get('PUBLIC_URL_BASE')  # e.g., "https://your-bucket.s3.amazonaws.com"

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

def is_youtube_link(url: str) -> bool:
    return 'youtube.com' in url or 'youtu.be' in url

@app.route("/webhook", methods=["POST"])
def webhook():
    # Twilio sends data as x-www-form-urlencoded
    form_data = request.form
    message = form_data.get('Body')
    from_number = form_data.get('From')

    if not message or not from_number:
        abort(400, "Missing 'Body' or 'From' parameter.")

    print("Received message:", message)
    print("From:", from_number)

    if not is_youtube_link(message):
        try:
            client.messages.create(
                from_=TWILIO_WHATSAPP_NUMBER,
                to=from_number,
                body="Please send a valid YouTube link."
            )
            return "Invalid link", 200
        except Exception as e:
            print("Twilio error:", e)
            abort(500, "Error sending message.")

    # Process the YouTube link
    video_url = message
    output_path = "/tmp/audio.mp3"  # Save the audio temporarily

    # Configure yt-dlp options
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output_path,
        'quiet': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print("Downloading audio from:", video_url)
            ydl.download([video_url])
        print("Downloaded audio to:", output_path)
    except Exception as e:
        print("Error downloading audio:", e)
        abort(500, "Error processing video.")

    # In a production scenario, you would upload the file from /tmp to cloud storage and get a public URL.
    # For demonstration, we'll assume you have already set a PUBLIC_URL_BASE environment variable.
    if not PUBLIC_URL_BASE:
        # If no public URL is configured, just send a text response.
        public_url = "Audio downloaded successfully, but no public URL is set."
    else:
        # Assume the file name remains the same.
        public_url = f"{PUBLIC_URL_BASE}/audio.mp3"

    try:
        client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            to=from_number,
            media_url=[public_url] if public_url.startswith("http") else None,
            body="" if public_url.startswith("http") else public_url,
        )
        return "Message sent", 200
    except Exception as e:
        print("Error sending Twilio message:", e)
        abort(500, "Error sending message.")

if __name__ == "__main__":
    app.run(debug=True)
