require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { processDownload } = require('./download');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = twilio(accountSid, authToken);

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
    try {
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Please send a valid YouTube link.',
      });
    } catch (err) {
      console.error("Error sending invalid link message:", err);
    }
    return res.status(200).send('Invalid link');
  }

  // Immediately respond to the webhook to avoid timeout.
  res.status(200).send('Processing your request...');

  try {
    const s3Url = await processDownload(message);
    if (!s3Url) throw new Error("S3 URL is undefined");

    // Send a text message along with the media.
    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Here is your audio file. If it doesnt play automatically, click the link: ' + s3Url,
      mediaUrl: [s3Url],
    });
    console.log("WhatsApp message sent successfully with media:", s3Url);
  } catch (error) {
    console.error('Error processing request:', error);
    try {
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Sorry, there was an error processing your request.',
      });
    } catch (err) {
      console.error("Error sending error message:", err);
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
