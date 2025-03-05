const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Twilio credentials (use environment variables)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
 
const twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Your sandbox number

const ytDlpExecutable = '/opt/bin/yt-dlp'; // The path to yt-dlp in the Vercel environment
const ffmpegLocation = '/opt/bin/ffmpeg'; // The path to ffmpeg

module.exports = async (req, res) => {
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

      // Public URL for serving static files (Vercel automatically serves /public)
      const publicUrl = `https://${process.env.VERCEL_URL}/public/${outputFilename}`;

      // Send the MP3 file to the user via Twilio
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        mediaUrl: [publicUrl],
      });

      res.status(200).send('Message sent');
    } catch (error) {
      console.error(error);
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Sorry, there was an error processing your request.',
      });

      res.status(500).send('Error');
    }
  } else {
    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Please send a valid YouTube link.',
    });

    res.status(200).send('Invalid link');
  }
};

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
        reject(stderr);
        return;
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}
