const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load Twilio credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Twilio sandbox number

// Paths to yt-dlp and ffmpeg in the Vercel environment
const ytDlpExecutable = '/opt/bin/yt-dlp';
const ffmpegLocation = '/opt/bin/ffmpeg';

// Define the filename and output directory
const outputFilename = 'audio.mp3';
const outputPath = path.join('/tmp', outputFilename); // Use /tmp for Vercel compatibility

module.exports = async (req, res) => {
  try {
    const { Body: incomingMessage, From: from } = req.body;

    if (!isYouTubeLink(incomingMessage)) {
      await sendWhatsAppMessage(from, 'Please send a valid YouTube link.');
      return res.status(400).send('Invalid link');
    }

    // Delete existing file if it exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Download the audio file
    await downloadAudio(incomingMessage, outputPath);

    // Generate the public URL
    const publicUrl = `https://${process.env.VERCEL_URL}/api/file?name=${outputFilename}`;

    // Send the MP3 file via Twilio
    await sendWhatsAppMedia(from, publicUrl);

    res.status(200).send('Message sent');
  } catch (error) {
    console.error('Error:', error);
    await sendWhatsAppMessage(req.body.From, 'Sorry, there was an error processing your request.');
    res.status(500).send('Error processing request');
  }
};

// Function to check if a message contains a YouTube link
const isYouTubeLink = (url) => url.includes('youtube.com') || url.includes('youtu.be');

// Function to send a WhatsApp message
const sendWhatsAppMessage = async (to, body) => {
  return client.messages.create({ from: twilioWhatsAppNumber, to, body });
};

// Function to send a WhatsApp message with media
const sendWhatsAppMedia = async (to, mediaUrl) => {
  return client.messages.create({ from: twilioWhatsAppNumber, to, mediaUrl: [mediaUrl] });
};

// Function to download audio using yt-dlp
const downloadAudio = async (videoUrl, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `"${ytDlpExecutable}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegLocation}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) return reject(`exec error: ${error}`);
      if (stderr) return reject(`stderr: ${stderr}`);
      console.log(`Download successful: ${stdout}`);
      resolve(stdout);
    });
  });
};
