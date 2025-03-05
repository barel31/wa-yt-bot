const twilio = require('twilio');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs'); // used for creating a stream later
const qs = require('querystring');
const AWS = require('aws-sdk');

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// AWS S3 setup
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Determine if running on Vercel (Linux) or locally (Windows)
const isVercel = !!process.env.VERCEL_URL;
let ytDlpPath, ffmpegPath;

if (isVercel) {
  ytDlpPath = path.join(__dirname, '..', 'bin', 'yt-dlp_linux');
  ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg-linux');
} else {
  ytDlpPath = path.join(__dirname, '..', 'bin', 'yt-dlp-win.exe');
  ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg-win.exe');
}

console.log("Using yt-dlp binary:", ytDlpPath);
console.log("Using ffmpeg binary:", ffmpegPath);

/*
  For local development, you might want to use ngrok to expose your local server for testing webhooks.
  In production (Vercel), your endpoint is already public so you don't need ngrok.
  
  To use ngrok locally, install it with `npm install ngrok` and uncomment the code below.

if (!isVercel) {
  const ngrok = require('ngrok');
  (async () => {
    // Replace 3000 with your local port if needed
    const url = await ngrok.connect(3000);
    console.log('Ngrok tunnel established at:', url);
  })();
}
*/

const handler = async (req, res) => {
  try {
    let incomingData = '';
    req.on('data', chunk => {
      incomingData += chunk;
    });

    req.on('end', async () => {
      try {
        const parsedData = qs.parse(incomingData);
        const message = parsedData.Body;
        const from = parsedData.From;

        if (!message) {
          console.error('No message received or Body is undefined.');
          res.status(400).send('No message received');
          return;
        }

        console.log('Incoming message:', message);
        console.log('From:', from);

        if (!isYouTubeLink(message)) {
          console.log('Invalid link received:', message);
          await client.messages.create({
            from: twilioWhatsAppNumber,
            to: from,
            body: 'Please send a valid YouTube link.',
          });
          res.status(200).send('Invalid link');
          return;
        }

        const videoUrl = message;
        const outputFilename = 'audio.mp3';
        const tempDir = '/tmp';
        const outputPath = path.join(tempDir, outputFilename);

        // Remove existing file if it exists
        try {
          await fs.access(outputPath);
          await fs.unlink(outputPath);
        } catch (err) {
          // File doesn't exist; no action needed.
        }

        // Download audio using a Python script
        await downloadAudioWithPython(videoUrl, outputPath);

        // Upload to S3
        const publicUrl = await uploadToS3(outputPath, outputFilename);

        // Send audio file via WhatsApp
        await client.messages.create({
          from: twilioWhatsAppNumber,
          to: from,
          mediaUrl: [publicUrl],
        });

        res.status(200).send('Message sent');
      } catch (innerError) {
        console.error('Error processing request:', innerError);
        await client.messages.create({
          from: twilioWhatsAppNumber,
          to: parsedData.From || '',
          body: 'Sorry, there was an error processing your request.',
        });
        res.status(500).send('Error');
      }
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).send('Internal Server Error');
  }
};

function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function downloadAudioWithPython(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'download_audio.py');
    // Use execFile for safer child process execution
    execFile('python3', [scriptPath, videoUrl, outputPath], (error, stdout, stderr) => {
      if (error) {
        console.error('Python execution error:', error);
        return reject(error);
      }
      if (stderr) {
        console.error('Python stderr:', stderr);
        // Depending on your script, you might choose to ignore non-critical stderr output.
        return reject(new Error(stderr));
      }
      console.log('Python stdout:', stdout);
      resolve(stdout);
    });
  });
}

function uploadToS3(filePath, filename) {
  return new Promise((resolve, reject) => {
    const fileStream = fsSync.createReadStream(filePath);
    const params = {
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: fileStream,
      ContentType: 'audio/mp3',
      ACL: 'public-read', // Make file publicly accessible
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error('Error uploading to S3:', err);
        return reject(err);
      }
      console.log('Upload successful:', data.Location);
      resolve(data.Location);
    });
  });
}

module.exports = handler;
