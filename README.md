# YouTube to MP3 Converter Bot for Telegram

A Telegram bot that converts YouTube videos (including Shorts) to MP3 audio files. The bot uses the RapidAPI "YouTube MP3" API to process conversions, uploads the file to an AWS S3 bucket, and sends a pre-signed URL back to the user via Telegram.

> **Note:** This project uses webhooks and S3 integration. Ensure your Render (or hosting) instance is configured with the required environment variables.

## Features

- **Supports YouTube & Shorts:**  
  Extracts video IDs from regular YouTube links and YouTube Shorts.
- **Webhook Integration:**  
  Uses Telegram webhooks to receive updates (recommended for deployments on Render).
- **Active Download Prevention:**  
  Tracks active downloads per chat to prevent multiple simultaneous requests.
- **S3 Integration:**  
  Downloads the file locally, uploads it to an AWS S3 bucket, and sends a pre-signed URL to Telegram.
- **RapidAPI Whitelisting:**  
  Adds a custom header (x-run) based on the MD5 hash of your RapidAPI username to help avoid 404 errors.
- **Progress Updates & Retry Mechanism:**  
  Provides progress updates and retries the file download once if a 404 error is encountered.

## Setup Instructions

### Prerequisites

- Node.js (v14 or later)
- An AWS account with an S3 bucket
- A RapidAPI account with access to the "YouTube MP3" API
- A Telegram bot token (from [BotFather](https://t.me/BotFather))
- A Render account (or another hosting provider)

### Environment Variables

Create a `.env` file in your project root and set the following variables:

TELEGRAM_BOT_TOKEN=your_telegram_bot_token  
WEBHOOK_URL=https://your-app.onrender.com  
RAPIDAPI_KEY=your_rapidapi_key  
RAPIDAPI_HOST=youtube-mp36.p.rapidapi.com  
RAPIDAPI_USERNAME=your_rapidapi_username  
AWS_ACCESS_KEY_ID=your_aws_access_key_id  
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key  
AWS_REGION=your_aws_region  
S3_BUCKET_NAME=your_s3_bucket_name  
RENDER_EXTERNAL_URL=https://your-app.onrender.com  

### Installation

Clone the repository:

git clone https://github.com/yourusername/your-repo.git  
cd your-repo  

Install dependencies:

npm install  

### Deployment on Render

- Set your environment variables in Render’s dashboard.
- The project uses webhook mode. Render automatically provides HTTPS (usually on port 443).
- Render sets the environment variable `RENDER_EXTERNAL_URL`, which the bot uses to automatically build the webhook URL.
- Deploy the code to Render. The bot will set its webhook automatically.

### Running Locally (Webhook Mode)

For local testing with webhooks, use a tunneling service such as ngrok:

1. Start your bot locally:

   npm start

2. Expose your local port (e.g., 3000) using ngrok:

   ngrok http 3000

3. Update your `.env` file with the HTTPS URL provided by ngrok:

   WEBHOOK_URL=https://<your-ngrok-id>.ngrok.io

4. Restart your bot so it sets the new webhook.

### Usage

1. Send a YouTube video URL (or a Shorts URL) to your Telegram bot.
2. The bot responds with inline buttons. Tap **"הורד MP3"** to start the conversion.
3. The bot sends progress updates while processing.
4. Once the conversion is complete, the file is uploaded to S3 and a pre-signed URL is sent to you as an audio file.

### Troubleshooting

- **404 Errors:**  
  If the bot returns "מצטער, לא נמצא הקובץ (שגיאה 404)", check that your RapidAPI account and S3 integration are correctly configured. Also, verify that Render's IP is allowed if needed (using the x-run header as described in the RapidAPI tutorial).

- **Instance Sleep:**  
  On free tiers, instances may sleep after 15 minutes of inactivity. Set up a periodic ping (e.g., a `/ping` endpoint with an external monitor like UptimeRobot) to keep the instance awake.

## License

This project is licensed under the MIT License.
