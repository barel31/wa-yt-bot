const twilio = require('twilio');
const { downloadAudio } = require('./download');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Twilio sandbox number

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const incomingMessage = req.body.Body;
  const from = req.body.From;

  if (isYouTubeLink(incomingMessage)) {
    try {
      const audioUrl = await downloadAudio(incomingMessage);
      
      // Send the MP3 file via Twilio
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        mediaUrl: [audioUrl],
      });

      return res.status(200).send('Message sent');
    } catch (error) {
      console.error(error);
      await client.messages.create({
        from: twilioWhatsAppNumber,
        to: from,
        body: 'Sorry, there was an error processing your request.',
      });

      return res.status(500).send('Error');
    }
  } else {
    await client.messages.create({
      from: twilioWhatsAppNumber,
      to: from,
      body: 'Please send a valid YouTube link.',
    });

    return res.status(200).send('Invalid link');
  }
};

// Function to check if the message contains a YouTube link
function isYouTubeLink(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}
