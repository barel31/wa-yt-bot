const twilio = require('twilio');
const path = require('path');
const qs = require('querystring');
const { processDownload } = require('./download'); // Import the Node.js download function

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Simple YouTube link validation
function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

const handler = async (req, res) => {
  let incomingData = '';
  let parsedData = null;

  req.on('data', chunk => {
    incomingData += chunk;
  });

  req.on('end', async () => {
    try {
      parsedData = qs.parse(incomingData);
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
      // Download the audio and convert to MP3 using the Node.js solution
      const publicUrl = await processDownload(videoUrl);
      console.log('Public URL generated:', publicUrl);

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
        to: (parsedData && parsedData.From) || '',
        body: 'Sorry, there was an error processing your request.',
      });
      res.status(500).send('Error');
    }
  });
};

module.exports = handler;
