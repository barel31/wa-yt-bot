const express = require('express');
const twilio = require('twilio');
const { processDownload } = require('./download');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioWhatsAppNumber = 'whatsapp:+14155238886';

// Validates that the provided URL appears to be a YouTube link.
function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

app.post('/webhook', async (req, res) => {
  const message = req.body.Body;
  const from = req.body.From;

  if (!message) {
    console.error('No message received or Body is undefined.');
    return res.status(400).send('No message received');
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
    return res.status(200).send('Invalid link');
  }

  try {
    const videoUrl = message;
    const publicUrl = await processDownload(videoUrl);
    console.log('Public URL generated:', publicUrl);

    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      mediaUrl: [publicUrl],
    });

    res.status(200).send('Message sent');
  } catch (error) {
    console.error('Error processing request:', error);
    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Sorry, there was an error processing your request.',
    });
    res.status(500).send('Error');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
