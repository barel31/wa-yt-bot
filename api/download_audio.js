const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg');
console.log("Using bundled ffmpeg at:", ffmpegPath);

if (!fs.existsSync(ffmpegPath)) {
  console.error("ffmpeg binary not found at", ffmpegPath);
}

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Downloads and converts a YouTube video to an MP3 file.
 * @param {string} videoUrl - The URL of the YouTube video.
 * @param {string} outputPath - Absolute path where the MP3 file will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when done.
 */
function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const stream = ytdl(videoUrl, { quality: 'highestaudio' });
    
    ffmpeg(stream)
      .audioBitrate(128)
      .format('mp3')
      .on('error', (err) => {
         console.error('Error during audio processing:', err);
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
