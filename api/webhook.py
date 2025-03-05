import yt_dlp
import os
from twilio.rest import Client

# Function to download audio from YouTube
def download_audio(video_url):
    ydl_opts = {
        'format': 'bestaudio/best',
        'extractaudio': True,  # download only audio
        'audioquality': 1,  # best quality
        'outtmpl': '/tmp/audio.mp3',  # output file path (Vercel allows /tmp)
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])
    
    return '/tmp/audio.mp3'

# Example Twilio integration (you should replace with your Twilio details)
def send_message(audio_path, to_phone_number):
    # Your Twilio credentials
    account_sid = 'your_account_sid'
    auth_token = 'your_auth_token'

    client = Client(account_sid, auth_token)

    # Send the audio file (you'll need to store it somewhere accessible or send it as an attachment)
    message = client.messages.create(
        body="Here is your audio file!",
        from_='+your_twilio_number',
        to=to_phone_number,
        media_url=f'http://example.com{audio_path}',  # You'll need to upload the file somewhere
    )

    return message.sid

# Sample webhook handler
def handler(request):
    video_url = request.json.get('video_url')
    phone_number = request.json.get('phone_number')

    # Download audio from the YouTube video
    audio_path = download_audio(video_url)

    # Send audio file via Twilio (ensure the file is accessible)
    send_message(audio_path, phone_number)

    return {"status": "success"}
