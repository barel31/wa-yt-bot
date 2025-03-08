# YouTube to MP3/MP4 Converter Bot for Telegram

A Telegram bot that converts YouTube videos (including Shorts) into audio (MP3) or video (MP4) files. The bot uses RapidAPI for conversions, uploads the converted file to an AWS S3 bucket, and sends a pre-signed URL back to the user via Telegram.

> **Note:** This project uses webhook mode and S3 integration. Ensure your Render (or hosting) instance is configured with the required environment variables.

## Features

- **Supports YouTube & Shorts:**  
  Extracts video IDs from regular YouTube links as well as YouTube Shorts.
- **Multiple Formats:**  
  Choose between MP3 (audio) and MP4 (video) conversions via inline buttons.
- **Webhook Integration:**  
  Uses Telegram webhooks to receive updates (recommended for deployments on Render).
- **Active Download Prevention:**  
  Tracks active downloads per chat to prevent simultaneous requests.
- **Rate Limiting & Caching:**  
  Implements simple in‑memory rate limiting and caches conversion results to speed up repeat requests.
- **S3 Integration:**  
  Downloads the file locally, uploads it to an AWS S3 bucket, and sends a pre-signed URL to Telegram.
- **RapidAPI Whitelisting:**  
  Adds a custom header (`x-run`) based on the MD5 hash of your RapidAPI username to help avoid 404 errors.
- **Progress Updates & Retry Mechanism:**  
  Provides progress updates (with message trimming to avoid Telegram limits) and retries file downloads on 404 errors.
- **Ping Endpoint:**  
  Includes a `/ping` endpoint to help keep the instance awake (useful on free tiers).

## Setup Instructions

### Prerequisites

- Node.js (v14 or later)
- An AWS account with an S3 bucket
- A RapidAPI account with access to the YouTube conversion API
- A Telegram bot token (from [BotFather](https://t.me/BotFather))
- A Render account (or another hosting provider)

### Environment Variables

Create a `.env` file in your project root and set the following variables:

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
WEBHOOK_URL=https://your-app.onrender.com
RAPIDAPI_KEY=your_rapidapi_key RAPIDAPI_HOST=youtube-mp36.p.rapidapi.com
RAPIDAPI_HOST_MP4=youtube-mp4.p.rapidapi.com RAPIDAPI_USERNAME=your_rapidapi_username
AWS_ACCESS_KEY_ID=your_aws_access_key_id AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region S3_BUCKET_NAME=your_s3_bucket_name RENDER_EXTERNAL_URL=https://your-app.onrender.com


### Installation

Clone the repository:

```git clone https://github.com/yourusername/your-repo.git cd your-repo```


Install dependencies:

```npm install```


### Deployment on Render

- Set your environment variables in Render’s dashboard.
- This project uses webhook mode; Render automatically provides HTTPS (usually on port 443).
- Render sets the environment variable `RENDER_EXTERNAL_URL`, which the bot uses to automatically build the webhook URL.
- Deploy the code to Render. The bot will set its webhook automatically.

### Running Locally (Webhook Mode)

For local testing with webhooks, use a tunneling service such as [ngrok](https://ngrok.com/):

1. Start your bot locally:

```npm start```


2. Expose your local port (e.g., 3000) using ngrok:

```ngrok http 3000```


3. Update your `.env` file with the HTTPS URL provided by ngrok:

```WEBHOOK_URL=https://<your-ngrok-id>.ngrok.io```


4. Restart your bot so it sets the new webhook.

### Usage

1. Send a YouTube video URL (or a Shorts URL) to your Telegram bot.
2. The bot will respond with inline buttons for format selection (e.g., "הורד MP3" and "הורד MP4").
3. Tap your desired option to start the conversion.
4. The bot sends progress updates while processing.
5. Once conversion is complete, the file is uploaded to S3 and a pre-signed URL is sent to you via Telegram.

### Troubleshooting

- **404 Errors:**  
If the bot returns "מצטער, לא נמצא הקובץ (שגיאה 404)", verify that your RapidAPI account and S3 integration are correctly configured. Also, check that your RapidAPI username is set (to enable the `x-run` header), as described in the RapidAPI whitelisting documentation.

- **Instance Sleep:**  
On free tiers, instances may sleep after 15 minutes of inactivity. Use an external monitor (such as UptimeRobot) to hit the `/ping` endpoint periodically.

- **Message Too Long:**  
The bot automatically trims progress messages to avoid exceeding Telegram's 4096-character limit.

## License

This project is licensed under the MIT License.