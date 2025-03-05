const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');

console.log("Using ffmpeg binary at:", ffmpegPath);
if (!fs.existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found at", ffmpegPath);
}
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Downloads and converts a YouTube video to an MP3 file using a native ffmpeg binary.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {string} outputPath - The local filesystem path where the MP3 will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when done.
 */
async function downloadAudio(videoUrl, outputPath) {
  console.log(`Downloading audio stream from: ${videoUrl}`);
  
  // Use filter: 'audioonly' and add a custom User-Agent to try to avoid a 410 error.
  const audioStream = ytdl(videoUrl, {
    quality: 'highestaudio',
    filter: 'audioonly',
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }
  });
  
  return new Promise((resolve, reject) => {
    ffmpeg(audioStream)
      .audioBitrate(128)
      .format('mp3')
      .on('error', (err, stdout, stderr) => {
        console.error('Error during audio processing:', err);
        console.error('ffmpeg stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('Audio conversion complete:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = { downloadAudio };
