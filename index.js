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

// When a message is received, validate and offer download options.
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Validate that the incoming message is a YouTube URL.
  if (!text || !(text.includes('youtube.com') || text.includes('youtu.be'))) {
    bot.sendMessage(chatId, 'Please send a valid YouTube link.');
    return;
  }

  // Extract video ID and create a short callback data payload.
  const videoId = extractVideoId(text);
  if (!videoId) {
    return bot.sendMessage(chatId, 'Could not extract video ID. Please try another link.');
  }
  const callbackData = JSON.stringify({ action: 'download', id: videoId });
  const cancelData = JSON.stringify({ action: 'cancel' });

  // Send an inline keyboard to ask the user how they want to download.
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'Download MP3', callback_data: callbackData },
        { text: 'Cancel', callback_data: cancelData }
      ]
    ]
  };

  bot.sendMessage(chatId, 'How would you like to download the video? (Currently only MP3 is available)', {
    reply_markup: inlineKeyboard
  });
});

// Handle callback queries from inline buttons.
bot.on('callback_query', async (callbackQuery) => {
  let parsed;
  try {
    parsed = JSON.parse(callbackQuery.data);
  } catch (e) {
    console.error("Error parsing callback data:", e);
    return bot.answerCallbackQuery(callbackQuery.id, { text: "Invalid selection" });
  }

  const chatId = callbackQuery.message.chat.id;
  const action = parsed.action;

  if (action === 'cancel') {
    bot.answerCallbackQuery(callbackQuery.id, { text: "Cancelled" });
    bot.sendMessage(chatId, "Download cancelled.");
    return;
  }

  if (action === 'download' && parsed.id) {
    bot.answerCallbackQuery(callbackQuery.id, { text: "Processing download..." });

    // Reconstruct a YouTube URL from the video ID.
    const videoUrl = `https://youtu.be/${parsed.id}`;

    // Send an initial status message and capture its message_id for editing.
    let statusMsg;
    try {
      statusMsg = await bot.sendMessage(chatId, 'Processing your request...');
    } catch (error) {
      console.error('Error sending initial status message:', error);
    }

    // Define a callback to update the status message.
    const updateStatus = async (newStatus) => {
      try {
        await bot.editMessageText(newStatus, { chat_id: chatId, message_id: statusMsg.message_id });
      } catch (error) {
        console.error('Error updating status message:', error);
      }
    };

    try {
      // Process the download. The result includes both the mp3 URL and the YouTube title.
      const result = await processDownload(videoUrl, updateStatus);

      // Update status before starting the file preparation.
      await updateStatus('Download complete. Preparing your audio file...');

      // Sanitize the title using a Unicode-aware regex.
      const sanitizeFileName = (name) => {
        // Allow any Unicode letters (\p{L}) or numbers (\p{N}), dashes, underscores, and spaces.
        return name.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, '_');
      };
      const sanitizedTitle = sanitizeFileName(result.title) || `audio_${Date.now()}`;
      const localFilePath = path.join(__dirname, `${sanitizedTitle}.mp3`);

      // Download the file locally.
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

      // Update status before uploading.
      await updateStatus('Uploading your file to Telegram, please wait...');

      // Send the audio file with the preserved file name.
      await bot.sendAudio(chatId, localFilePath, { caption: `Here is your audio file: ${result.title}` });

      // Optionally, update the status message to indicate completion.
      await updateStatus('File sent successfully.');

      // Clean up the temporary file.
      fs.unlink(localFilePath, (err) => {
        if (err) {
          console.error('Error deleting temporary file:', err);
        }
      });
    } catch (error) {
      console.error('Error processing download:', error);
      await updateStatus('Sorry, there was an error processing your request.');
    }
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
