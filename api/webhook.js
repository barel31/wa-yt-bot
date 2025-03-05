const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Adjust the paths for your Vercel environment or use environment variables for absolute paths.
const ytDlpExecutable = '/opt/bin/yt-dlp';  // Path to yt-dlp
const ffmpegLocation = '/opt/bin/ffmpeg';   // Path to ffmpeg

module.exports = async (req, res) => {
  console.log('Webhook function was triggered');
  
  const incomingMessage = req.body.Body;
  const from = req.body.From;

  // Log incoming message and sender information
  console.log('Incoming message:', incomingMessage);
  console.log('From:', from);

  if (isYouTubeLink(incomingMessage)) {
    const videoUrl = incomingMessage;
    const outputFilename = 'audio.mp3';
    const tempDir = '/tmp'; // Temporary directory for Vercel (use /tmp on serverless environments)
    const outputPath = path.join(tempDir, outputFilename);

    // Log video URL and output path
    console.log('Video URL:', videoUrl);
    console.log('Output path:', outputPath);

    try {
      // Check if file exists and delete if necessary
      if (fs.existsSync(outputPath)) {
        console.log('Deleting existing file:', outputPath);
        fs.unlinkSync(outputPath);
      }

      // Download the audio
      await downloadAudio(videoUrl, outputPath);

      // Construct the public URL (Vercel-specific URL structure)
      const publicUrl = `https://${process.env.VERCEL_URL}/tmp/${outputFilename}`;

      // Log the public URL
      console.log('Public URL:', publicUrl);

      // Send the audio file back to the user
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        mediaUrl: [publicUrl],
      });

      res.status(200).send('Message sent');
    } catch (error) {
      // Log the error and send error response to user
      console.error('Error during processing:', error);
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Sorry, there was an error processing your request.',
      });

      res.status(500).send('Error');
    }
  } else {
    // If the link is not a YouTube link, send a response asking for a valid link
    console.log('Invalid link received:', incomingMessage);
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
function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    // Build the command to download the video and extract audio
    const command = `"${ytDlpExecutable}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegLocation}"`;

    console.log('Executing command:', command); // Log the command

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
