require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { downloadAudio } = require('./download_audio');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Validates that the provided URL appears to be a YouTube link.
function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

app.post('/webhook', async (req, res) => {
  const message = req.body.Body;
  const from = req.body.From;

  if (!message || !from) {
    return res.status(400).send('Invalid request');
  }

  if (!isYouTubeLink(message)) {
    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Please send a valid YouTube link.',
    });
    return res.status(200).send('Invalid link');
  }

  res.status(200).send('Processing your request...');

  try {
    const publicUrl = await downloadAudio(message);

    await twilio(accountSid, authToken).messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      mediaUrl: [publicUrl],
    });
  } catch (error) {
    console.error('Error processing request:', error);
    await twilio(accountSid, authToken).messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Sorry, there was an error processing your request.',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
