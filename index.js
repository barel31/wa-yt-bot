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

    // Send a progress message which will be updated.
    let progressMsg;
    try {
      progressMsg = await bot.sendMessage(chatId, 'מעבד הורדה...');
    } catch (error) {
      console.error('שגיאה בשליחת הודעת סטטוס התחלתית:', error);
    }

    // Function to update the progress message by editing it.
    const updateStatus = async (newStatus) => {
      try {
        await bot.editMessageText(newStatus, {
          chat_id: chatId,
          message_id: progressMsg.message_id
        });
      } catch (error) {
        if (error && error.message && error.message.includes('message is not modified')) {
          // Ignore if content hasn't changed.
        } else {
          console.error('שגיאה בעדכון הודעת סטטוס:', error);
        }
      }
    };

    try {
      const result = await processDownload(videoUrl, updateStatus);
      await updateStatus('ההורדה הושלמה. מכין את קובץ האודיו שלך...');

      const sanitizeFileName = (name) => {
        return name.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, '_');
      };
      const sanitizedTitle = sanitizeFileName(result.title) || `audio_${Date.now()}`;
      const localFilePath = path.join(__dirname, `${sanitizedTitle}.mp3`);

      const response = await axios({
        url: result.link,
        method: 'GET',
        responseType: 'stream',
        validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
      });
      
      if (response.status === 404) {
        console.error('File not found (404) on download.');
        await updateStatus('מצטער, לא נמצא הקובץ (שגיאה 404).');
        bot.sendMessage(chatId, 'מצטער, לא נמצא הקובץ (שגיאה 404).');
        return;
      }
      
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
      
      fs.unlink(localFilePath, (err) => {
        if (err) console.error('שגיאה במחיקת הקובץ הזמני:', err);
      });
    } catch (error) {
      console.error('שגיאה בעיבוד ההורדה:', error.message);
      // If updateStatus fails to show the error, send a new message.
      try {
        await updateStatus(`שגיאה: ${error.message}`);
      } catch (e) {
        bot.sendMessage(chatId, `שגיאה: ${error.message}`);
      }
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
