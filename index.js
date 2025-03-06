require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const ngrok = require('ngrok');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Your Twilio WhatsApp sandbox number
const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Path to yt-dlp executable (same folder as this script)
const ytDlpExecutable = path.join(__dirname, 'tools/yt-dlp.exe');

// Path to ffmpeg executable
const ffmpegLocation = path.join(__dirname, 'tools/ffmpeg/bin');

app.post('/webhook', async (req, res) => {
  const incomingMessage = req.body.Body;
  const from = req.body.From;

  if (isYouTubeLink(incomingMessage)) {
    const videoUrl = incomingMessage;
    const outputFilename = 'audio.mp3';
    const outputPath = path.join(__dirname, outputFilename);

    try {
      // Delete existing file if it exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      // Download MP3 using yt-dlp executable
      await downloadAudio(videoUrl, outputPath);

      // Construct the public URL using your ngrok URL (make sure it's globally accessible)
      const publicUrl = process.env.NGROK_URL; // Set this variable after ngrok connects

      // Send the MP3 file to the user via Twilio
      client.messages
        .create({
          from: twilioWhatsAppNumber,
          to: from,
          mediaUrl: [`${publicUrl}/${outputFilename}`],
        })
        .then(message => console.log(message.sid))
        .catch(err => console.error(err));
    } catch (error) {
      console.error(error);
      client.messages
        .create({
          from: twilioWhatsAppNumber,
          to: from,
          body: 'Sorry, there was an error processing your request.',
        })
        .then(message => console.log(message.sid))
        .catch(err => console.error(err));
    }
  } else {
    client.messages
      .create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Please send a valid YouTube link.',
      })
      .then(message => console.log(message.sid))
      .catch(err => console.error(err));
  }

  res.status(200).send('OK');
});

// Function to check if the message contains a YouTube link
function isYouTubeLink(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Function to download audio using yt-dlp
async function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const command = `"${ytDlpExecutable}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegLocation}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        // You may want to only reject if there's a fatal error
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  // Start ngrok and set the public URL as an environment variable for later use
  const url = await ngrok.connect(PORT);
  process.env.NGROK_URL = url;
  console.log('Your ngrok URL is:', url);
});
