const twilio = require('twilio');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const qs = require('querystring'); // Required to parse URL-encoded form data

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886';

const downloadBinary = (url, destinationPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destinationPath);

    https.get(url, (response) => {
      // Check if the response is not an HTML error page
      if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
        reject(new Error('Expected a binary file, but received an HTML page.'));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};


// Function to download yt-dlp and ffmpeg to /tmp at runtime
const downloadBinaries = async () => {
  const ytDlpPath = '/tmp/yt-dlp';
  const ffmpegPath = '/tmp/ffmpeg';

  const ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/2025.02.19/yt-dlp_linux';
  const ffmpegUrl = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz'; 

  await downloadBinary(ytDlpUrl, ytDlpPath);
  await downloadBinary(ffmpegUrl, ffmpegPath);

  // Make sure to set executable permissions for the binaries
  fs.chmodSync(ytDlpPath, '755');
  fs.chmodSync(ffmpegPath, '755');

  console.log('Binaries downloaded and permissions set');
};

// Main function for handling the webhook
module.exports = async (req, res) => {
  try {
    await downloadBinaries(); // Download binaries when the webhook is triggered

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
    const ytDlpPath = '/tmp/yt-dlp';  // Updated path for runtime download
    const ffmpegPath = '/tmp/ffmpeg'; // Updated path for runtime download

    const command = `"${ytDlpPath}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegPath}"`;

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
