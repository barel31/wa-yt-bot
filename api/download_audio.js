const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

console.log("Using ffmpeg-static binary at:", ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Downloads and converts a YouTube video to an MP3 file using a native ffmpeg binary.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {string} outputPath - The local filesystem path where the MP3 will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when done.
 */
async function downloadAudio(videoUrl, outputPath) {
  console.log(`Downloading audio stream from: ${videoUrl}`);
  const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
  
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
