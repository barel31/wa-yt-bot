require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const { processDownload, extractVideoId } = require('./download');

const app = express();
const port = process.env.PORT || 3000;

// Ping endpoint to keep the instance awake.
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Initialize AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Compute MD5 hash of your RapidAPI username for x-run header.
const rapidapiUsername = process.env.RAPIDAPI_USERNAME;
const xRunHeader = rapidapiUsername
  ? crypto.createHash('md5').update(rapidapiUsername).digest('hex')
  : '';

const activeDownloads = {};

// For webhook mode, we use the webhook URL (ensure it's set to HTTPS on an allowed port)
const webhookUrl = (process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL) + '/webhook';

// Initialize Telegram bot without polling.
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
bot.setWebHook(webhookUrl)
  .then(() => console.log('Webhook set successfully:', webhookUrl))
  .catch(err => console.error('Error setting webhook:', err));

// Express endpoint to receive Telegram webhook updates.
app.use(express.json());
app.post('/webhook', (req, res) => {
  console.log('Update received:', req.body);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (activeDownloads[chatId]) {
    bot.sendMessage(chatId, 'יש הורדה פעילה. אנא המתן לסיום ההורדה הנוכחית.');
    return;
  }

  if (!text || !(text.includes('youtube.com') || text.includes('youtu.be'))) {
    bot.sendMessage(chatId, 'נא לשלוח קישור YouTube תקין.');
    return;
  }

  const videoId = extractVideoId(text);
  if (!videoId) {
    return bot.sendMessage(chatId, 'לא ניתן לחלץ את מזהה הווידאו. אנא נסה קישור אחר.');
  }

  const callbackData = JSON.stringify({ action: 'download', id: videoId });
  const cancelData = JSON.stringify({ action: 'cancel' });
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'הורד MP3', callback_data: callbackData },
        { text: 'בטל', callback_data: cancelData }
      ]
    ]
  };

  bot.sendMessage(chatId, 'איך תרצה להוריד את הווידאו? (כרגע זמין רק MP3)', { reply_markup: inlineKeyboard });
});

bot.on('callback_query', async (callbackQuery) => {
  let parsed;
  try {
    parsed = JSON.parse(callbackQuery.data);
  } catch (e) {
    console.error('שגיאה בפיענוח נתוני החזרה:', e);
    return bot.answerCallbackQuery(callbackQuery.id, { text: 'בחירה לא תקינה' });
  }

  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const action = parsed.action;

  // Remove inline keyboard to prevent spam.
  try {
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
  } catch (error) {
    console.error('שגיאה בעת הסרת הלחצנים:', error.message);
  }

  activeDownloads[chatId] = true;

  if (action === 'cancel') {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'בוטל' });
    bot.sendMessage(chatId, 'ההורדה בוטלה.');
    activeDownloads[chatId] = false;
    return;
  }

  if (action === 'download' && parsed.id) {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'מעבד הורדה...' });
    const videoUrl = `https://youtu.be/${parsed.id}`;

    let progressMsg;
    try {
      progressMsg = await bot.sendMessage(chatId, 'מעבד הורדה...');
    } catch (error) {
      console.error('שגיאה בשליחת הודעת סטטוס התחלתית:', error);
    }

    const updateStatus = async (newStatus) => {
      try {
        await bot.editMessageText(newStatus, {
          chat_id: chatId,
          message_id: progressMsg.message_id
        });
      } catch (error) {
        if (error && error.message && error.message.includes('message is not modified')) {
          // Ignore if unchanged.
        } else {
          console.error('שגיאה בעדכון הודעת סטטוס:', error);
        }
      }
    };

    try {
      const result = await processDownload(videoUrl, updateStatus);
      await updateStatus('ההורדה הושלמה. מכין את קובץ האודיו שלך...');

      const sanitizeFileName = (name) => name.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, '_');
      const sanitizedTitle = sanitizeFileName(result.title) || `audio_${Date.now()}`;
      const localFilePath = path.join(__dirname, `${sanitizedTitle}.mp3`);

      async function downloadFile(url, localFilePath, updateStatus) {
        const attemptDownload = async () => {
          console.log("Attempting file download from URL:", url);
          const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                            'Chrome/115.0.0.0 Safari/537.36',
              'x-run': xRunHeader
            },
            validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
          });
          console.log(`Response status: ${response.status} ${response.statusText}`);
          return response;
        };

        let response = await attemptDownload();
        if (response.status === 404) {
          await updateStatus('מצטער, לא נמצא הקובץ (404). מנסה שנית...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          response = await attemptDownload();
        }
        return response;
      }
      
      const response = await downloadFile(result.link, localFilePath, updateStatus);
      if (response.status === 404) {
        console.error('File not found (404) on download after retry.');
        await updateStatus('מצטער, לא נמצא הקובץ (שגיאה 404).');
        bot.sendMessage(chatId, 'מצטער, לא נמצא הקובץ (שגיאה 404).');
        activeDownloads[chatId] = false;
        return;
      }
      
      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await updateStatus('מעלה את הקובץ ל-S3, אנא המתן...');
      const fileStream = fs.createReadStream(localFilePath);
      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${sanitizedTitle}.mp3`,
        Body: fileStream,
        ContentType: 'audio/mpeg'
      };
      await s3.upload(s3Params).promise();

      const s3Url = s3.getSignedUrl('getObject', {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${sanitizedTitle}.mp3`,
        Expires: 3600
      });

      await updateStatus('מעלה את הקובץ ל-Telegram, אנא המתן...');
      await bot.sendAudio(chatId, s3Url, {
        caption: `הנה קובץ האודיו שלך: ${result.title}`,
        filename: `${sanitizedTitle}.mp3`,
        contentType: 'audio/mpeg'
      });
      
      fs.unlink(localFilePath, (err) => {
        if (err) console.error('שגיאה במחיקת הקובץ הזמני:', err);
      });
    } catch (error) {
      console.error('שגיאה בעיבוד ההורדה:', error.message);
      try {
        await updateStatus(`שגיאה: ${error.message}`);
      } catch (e) {
        bot.sendMessage(chatId, `שגיאה: ${error.message}`);
      }
    }
  }
  activeDownloads[chatId] = false;
});

// Start the Express server.
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
