# YouTube Downloader 🎥⬇️

A web application for downloading YouTube videos and audio. Users can enter a YouTube URL (including Shorts) and choose to download the content as MP3 (audio) or MP4 (video) in various resolutions. The app features a responsive UI built with React (TypeScript) and a backend API built with Express. Files are uploaded to AWS S3 and a pre‑signed URL is provided for download.

---

## Features

- **Multi-format Downloads:**  
  - Download as MP3 (audio) or MP4 (video)  
  - Choose video resolution for MP4 downloads (if available)
- **Responsive Web UI:**  
  - Built with React (TypeScript) with a modern, responsive design  
  - Displays a progress bar during conversion and allows cancellation of downloads
- **Backend API:**  
  - Express-based API for submitting download jobs, tracking progress, and canceling jobs  
  - Integrates with AWS S3 for file storage and pre‑signed URL generation
- **RapidAPI Integration:**  
  - Uses RapidAPI endpoints for processing YouTube conversions
- **Optional Redis Caching:**  
  - Can be enabled in production to cache conversion results (disabled in local development)
- **Webhooks & REST API:**  
  - The backend exposes REST endpoints for job submission and status tracking

---

## Prerequisites

- Node.js (v14 or later)
- AWS account with an S3 bucket
- RapidAPI account with access to the relevant YouTube conversion API(s)
- (Optional) Redis server for production caching
- A modern web browser

---

## Environment Variables

Create a `.env` file in the backend root with the following variables:

```
PORT=3000
WEBHOOK_URL=https://your-app-domain.com/webhook
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=youtube-mp36.p.rapidapi.com         # For MP3 downloads
RAPIDAPI_HOST_MP4=youtube-video-fast-downloader-24-7.p.rapidapi.com   # For MP4 downloads
DEFAULT_VIDEO_QUALITY_ID=137                      # Default quality id if none chosen
DEFAULT_VIDEO_QUALITY_RESOLUTION=720p

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_s3_bucket_name

# (Optional) Redis configuration (for production)
REDIS_URL=redis://your_redis_server:6379

# Frontend (if needed)
VITE_API_URL=https://your-backend-domain.com/api
```
*Note: Adjust the values as needed for your environment.*

# Setup & Installation
## Backend
Clone the repository:

`git clone https://github.com/yourusername/your-repo.git`

`cd your-repo`

Install dependencies:

`npm install`

Run the backend server:

`npm run start`

The server will listen on the port specified in your .env file (default is 3000).

## Frontend (React with TypeScript)

Navigate to the frontend directory:

`cd frontend`

Install dependencies:

`npm install`

Configure the API proxy:
In your vite.config.ts file, add a proxy so that API calls are forwarded to your backend:

```
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```
Run the React app:

`npm run dev`

Open your browser at http://localhost:5173.

## Usage

Submit a YouTube URL:

Enter a valid YouTube (or Shorts) URL into the input field.

Select Download Format:

Choose either MP3 (audio) or MP4 (video) from the dropdown.

Start Download:

Click the "התחל הורדה" button to begin the download process.

Monitor Progress:
A progress bar will display conversion progress. You can cancel the download at any time by clicking the "בטל הורדה" button.

Download File:
Once complete, the file is uploaded to AWS S3 and a pre‑signed URL is provided for direct download.

For MP4 downloads, a responsive video element is displayed.

For MP3 downloads, an audio player is provided along with a download link.

## Troubleshooting

- **API Errors (404, 403):**
  - Verify your RapidAPI credentials and S3 configuration. Ensure that your environment variables are set correctly.

- **Progress Bar Issues:**
  - Check that your backend is updating progress regularly. Look at server logs for details.

- **CORS Issues:**
  
  - If testing locally, ensure your proxy is configured so that the frontend can reach the backend without CORS errors.

- **Instance Sleep on Free Tiers:**
  - On free hosting tiers (e.g., Render), set up a periodic ping (using a service like UptimeRobot) to keep your instance awake.

- **Redis Caching:**
  - In development, Redis is disabled. For production, ensure you set the appropriate environment variables and that your Redis server is accessible.

## License

This project is licensed under the MIT License.

## Acknowledgments

[RapidAPI](https://rapidapi.com/) for providing YouTube conversion APIs.

[AWS S3](https://aws.amazon.com/s3/) for file storage.

[Vite](https://vite.dev/) and React for the frontend tooling.