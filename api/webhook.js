const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const qs = require('querystring'); // Required to parse URL-encoded form data
const ytDlpExecutable = require('yt-dlp'); // This is the module imported from npm
const ffmpegLocation = require('ffmpeg-static'); // This provides the ffmpeg path

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886';
const ytDlpExecutable = '/opt/bin/yt-dlp'; // Path to yt-dlp
const ffmpegLocation = '/opt/bin/ffmpeg'; // Path to ffmpeg

module.exports = async (req, res) => {
  try {
    let incomingMessage = '';

    req.on('data', chunk => {
      incomingMessage += chunk;
    });

    req.on('end', async () => {
      // Log the raw incoming data for debugging
      console.log('Raw incoming data:', incomingMessage);

      // Now parse the data using querystring (for x-www-form-urlencoded)
      const parsedData = qs.parse(incomingMessage);
      console.log('Parsed data:', parsedData); // Log parsed data to see if Body exists

      const message = parsedData.Body; // This is the actual text sent by Twilio
      const from = parsedData.From; // The sender's phone number

      if (!message) {
        console.log('No message received or Body is undefined.');
        res.status(400).send('No message received');
        return;
      }

      // Log incoming message and sender information
      console.log('Incoming message:', message);
      console.log('From:', from);

      if (isYouTubeLink(message)) {
        const videoUrl = message;
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

// Function to check if the message contains a YouTube link
function isYouTubeLink(url) {
  console.log('Checking if URL is a YouTube link:', url);
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

// Function to download audio using yt-dlp
function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    // Use the module paths for yt-dlp and ffmpeg
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
