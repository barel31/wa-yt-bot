const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const qs = require('querystring'); // To parse x-www-form-urlencoded data

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Determine if running on Vercel (Linux) or locally (Windows)
const isVercel = !!process.env.VERCEL_URL;
let ytDlpPath, ffmpegPath;

if (isVercel) {
  // Use Linux binaries when running on Vercel
  ytDlpPath = path.join(__dirname, '..', 'bin', 'yt-dlp_linux_aarch64');
  ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg-linux');
} else {
  // Use Windows binaries when developing locally
  ytDlpPath = path.join(__dirname, '..', 'bin', 'yt-dlp-win.exe');
  ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg-win.exe');
}

console.log("Using yt-dlp binary:", ytDlpPath);
console.log("Using ffmpeg binary:", ffmpegPath);

module.exports = async (req, res) => {
  try {
    let incomingData = '';
    req.on('data', chunk => {
      incomingData += chunk;
    });

    req.on('end', async () => {
      // Log the raw incoming data
      console.log('Raw incoming data:', incomingData);

      // Parse the incoming data (Twilio sends data as x-www-form-urlencoded)
      const parsedData = qs.parse(incomingData);
      console.log('Parsed data:', parsedData);

      const message = parsedData.Body; // Text sent by Twilio
      const from = parsedData.From;    // Sender's phone number

      if (!message) {
        console.log('No message received or Body is undefined.');
        res.status(400).send('No message received');
        return;
      }

      console.log('Incoming message:', message);
      console.log('From:', from);

      if (isYouTubeLink(message)) {
        const videoUrl = message;
        const outputFilename = 'audio.mp3';
        const tempDir = '/tmp'; // Use /tmp for temporary files in serverless environments
        const outputPath = path.join(tempDir, outputFilename);

        console.log('Video URL:', videoUrl);
        console.log('Output path:', outputPath);

        try {
          // Delete existing file if it exists
          if (fs.existsSync(outputPath)) {
            console.log('Deleting existing file:', outputPath);
            fs.unlinkSync(outputPath);
          }

          // Download the audio using yt-dlp
          await downloadAudio(videoUrl, outputPath);

          // Construct a public URL for the audio file.
          // Note: /tmp is not publicly accessible in Vercel by default.
          // In a production app, you might need to move the file to cloud storage.
          const publicUrl = `https://${process.env.VERCEL_URL}/tmp/${outputFilename}`;
          console.log('Public URL:', publicUrl);

          // Send the audio file back via Twilio WhatsApp
          await client.messages.create({
            from: twilioWhatsAppNumber,
            to: from,
            mediaUrl: [publicUrl],
          });

          res.status(200).send('Message sent');
        } catch (error) {
          console.error('Error during processing:', error);
          await client.messages.create({
            from: twilioWhatsAppNumber,
            to: from,
            body: 'Sorry, there was an error processing your request.',
          });
          res.status(500).send('Error');
        }
      } else {
        console.log('Invalid link received:', message);
        await client.messages.create({
          from: twilioWhatsAppNumber,
          to: from,
          body: 'Please send a valid YouTube link.',
        });
        res.status(200).send('Invalid link');
      }
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).send('Internal Server Error');
  }
};

function isYouTubeLink(url) {
  console.log('Checking if URL is a YouTube link:', url);
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `"${ytDlpPath}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegPath}"`;
    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return reject(stderr);
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}
