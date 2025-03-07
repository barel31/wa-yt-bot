require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { processDownload, extractVideoId } = require('./download');

const app = express();
const port = process.env.PORT || 3000;

// Initialize the Telegram bot with polling.
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

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

  bot.sendMessage(
    chatId,
    'איך תרצה להוריד את הווידאו? (כרגע זמין רק MP3)',
    { reply_markup: inlineKeyboard }
  );
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
  const action = parsed.action;

  if (action === 'cancel') {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'בוטל' });
    bot.sendMessage(chatId, 'ההורדה בוטלה.');
    return;
  }

  if (action === 'download' && parsed.id) {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'מעבד הורדה...' });
    const videoUrl = `https://youtu.be/${parsed.id}`;

    // Instead of editing the same message, we send each update as a new message.
    const updateStatus = async (newStatus) => {
      try {
        await bot.sendMessage(chatId, newStatus);
      } catch (error) {
        console.error('שגיאה בשליחת הודעת סטטוס:', error);
      }
    };

    try {
      const result = await processDownload(videoUrl, updateStatus);
      await updateStatus('ההורדה הושלמה. מכין את קובץ האודיו שלך...');
      
      // Unicode-aware filename sanitization.
      const sanitizeFileName = (name) => {
        return name.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, '_');
      };
      const sanitizedTitle = sanitizeFileName(result.title) || `audio_${Date.now()}`;
      const localFilePath = path.join(__dirname, `${sanitizedTitle}.mp3`);

      const response = await axios({
        url: result.link,
        method: 'GET',
        responseType: 'stream'
      });
      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await updateStatus('מעלה את הקובץ ל-Telegram, אנא המתן...');
      await bot.sendAudio(chatId, localFilePath, {
        caption: `הנה קובץ האודיו שלך: ${result.title}`
      });
      
      // Note: No final "הקובץ נשלח בהצלחה" message.
      
      fs.unlink(localFilePath, (err) => {
        if (err) console.error('שגיאה במחיקת הקובץ הזמני:', err);
      });
    } catch (error) {
      console.error('שגיאה בעיבוד ההורדה:', error);
      await updateStatus('מצטער, אירעה שגיאה בעיבוד הבקשה שלך.');
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
