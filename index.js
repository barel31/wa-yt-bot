require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const { processDownload, extractVideoId, createProgressBar, sleep } = require('./download');

// --- Redis Setup ---
const redis = require('redis');
// --- Redis Setup ---
let redisClient;
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode – Redis caching is disabled.');
  // Create a dummy Redis client with no-op functions.
  redisClient = {
    get: async () => null,
    setEx: async () => {},
  };
} else {
  const redis = require('redis');
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
  });
  if (process.env.REDIS_PASSWORD) {
    // The redis package v4 supports including the password in the URL,
    // so this is optional if using REDIS_URL.
  }
  redisClient.on('error', err => console.error('Redis error:', err));
  redisClient.connect().catch(console.error);
}


// Express app and port.
const app = express();
const port = process.env.PORT || 3000;

// Use JSON body parser.
app.use(bodyParser.json());

// Ping endpoint to keep the instance awake.
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Initialize AWS S3.
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Compute MD5 hash of your RapidAPI username for the x-run header.
const rapidapiUsername = process.env.RAPIDAPI_USERNAME;
const xRunHeader = rapidapiUsername
  ? crypto.createHash('md5').update(rapidapiUsername).digest('hex')
  : '';

// --- Simple in-memory rate limiter ---
const rateLimitCache = {}; // { chatId: { count, lastRequest } }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(chatId) {
  const now = Date.now();
  if (!rateLimitCache[chatId]) {
    rateLimitCache[chatId] = { count: 1, lastRequest: now };
    return false;
  }
  const diff = now - rateLimitCache[chatId].lastRequest;
  if (diff > RATE_LIMIT_WINDOW) {
    rateLimitCache[chatId] = { count: 1, lastRequest: now };
    return false;
  } else {
    rateLimitCache[chatId].count++;
    return rateLimitCache[chatId].count > MAX_REQUESTS_PER_WINDOW;
  }
}

// Active downloads tracker.
const activeDownloads = {};

// Webhook setup.
const webhookBase = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
const webhookUrl = webhookBase.endsWith('/webhook') ? webhookBase : `${webhookBase}/webhook`;

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
bot.setWebHook(webhookUrl)
  .then(() => console.log('Webhook set successfully:', webhookUrl))
  .catch(err => console.error('Error setting webhook:', err));

// Express endpoint for Telegram webhook updates.
app.post('/webhook', (req, res) => {
  console.log('Update received:', req.body && req.body.update_id);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Helper function to trim message text to Telegram's limit.
const MAX_MESSAGE_LENGTH = 4096;
function trimMessage(text) {
  return text.length > MAX_MESSAGE_LENGTH
    ? text.substring(0, MAX_MESSAGE_LENGTH - 3) + '...'
    : text;
}

// --- Message Handler ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (isRateLimited(chatId)) {
    bot.sendMessage(chatId, 'יותר מדי בקשות, אנא המתן רגע.');
    return;
  }

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

  // Create inline keyboard with format options.
  const mp3CallbackData = JSON.stringify({ action: 'download', id: videoId, format: 'mp3' });
  const mp4CallbackData = JSON.stringify({ action: 'download', id: videoId, format: 'mp4' });
  const cancelData = JSON.stringify({ action: 'cancel' });
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'הורד MP3', callback_data: mp3CallbackData },
        { text: 'הורד MP4', callback_data: mp4CallbackData },
        { text: 'בטל', callback_data: cancelData }
      ]
    ]
  };

  bot.sendMessage(chatId, 'איך תרצה להוריד את הווידאו? (בחר פורמט)', { reply_markup: inlineKeyboard });
});

// --- Callback Query Handler ---
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
  const format = parsed.format || 'mp3';

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

    // Use Redis cache to check for existing conversion.
    const cacheKey = `${parsed.id}-${format}`;
    let cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      const cached = JSON.parse(cachedData);
      bot.sendMessage(chatId, `הקובץ נמצא במטמון: ${cached.title}`);
      if (format === 'mp4') {
        await bot.sendVideo(chatId, cached.s3Url, { caption: `הנה קובץ הווידאו שלך: ${cached.title}` });
      } else {
        await bot.sendAudio(chatId, cached.s3Url, { caption: `הנה קובץ האודיו שלך: ${cached.title}` });
      }
      activeDownloads[chatId] = false;
      return;
    }

    let progressMsg;
    try {
      progressMsg = await bot.sendMessage(chatId, 'מעבד הורדה...');
    } catch (error) {
      console.error('שגיאה בשליחת הודעת סטטוס התחלתית:', error);
    }

    const updateStatus = async (newStatus) => {
      try {
        await bot.editMessageText(trimMessage(newStatus), {
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
      const result = await processDownload(videoUrl, updateStatus, format);
      await updateStatus('ההורדה הושלמה. מכין את הקובץ...');

      const sanitizeFileName = (name) => name.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, '_');
      const sanitizedTitle = sanitizeFileName(result.title) || `file_${Date.now()}`;
      const fileExtension = format === 'mp4' ? '.mp4' : '.mp3';
      const localFilePath = path.join(__dirname, `${sanitizedTitle}${fileExtension}`);

      async function downloadFile(url, localFilePath, updateStatus) {
        const attemptDownload = async () => {
          const headers = {
            'User-Agent': `${process.env.RAPIDAPI_USERNAME} Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36`,
            'x-run': xRunHeader,
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
            'Accept': '*/*'
          };
          console.log("Attempting file download with headers:", headers);
          const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers,
            validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
          });
          console.log(`Response status: ${response.status} ${response.statusText}`);
          return response;
        };
        
        

        let response = await attemptDownload();
        if (response.status === 404) {
          await updateStatus('מצטער, לא נמצא הקובץ (404). מנסה שנית...');
          await sleep(3000);
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
        Key: `${sanitizedTitle}${fileExtension}`,
        Body: fileStream,
        ContentType: format === 'mp4' ? 'video/mp4' : 'audio/mpeg'
      };
      await s3.upload(s3Params).promise();

      const s3Url = s3.getSignedUrl('getObject', {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${sanitizedTitle}${fileExtension}`,
        Expires: 3600
      });

      await updateStatus('מעלה את הקובץ ל-Telegram, אנא המתן...');
      if (format === 'mp4') {
        await bot.sendVideo(chatId, s3Url, {
          caption: `הנה קובץ הווידאו שלך: ${result.title}`,
          filename: `${sanitizedTitle}${fileExtension}`,
          contentType: 'video/mp4'
        });
      } else {
        await bot.sendAudio(chatId, s3Url, {
          caption: `הנה קובץ האודיו שלך: ${result.title}`,
          filename: `${sanitizedTitle}${fileExtension}`,
          contentType: 'audio/mpeg'
        });
      }
      
      // Store conversion result in Redis for 24 hours.
      await redisClient.setEx(cacheKey, 86400, JSON.stringify({ s3Url, title: result.title }));
      
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
