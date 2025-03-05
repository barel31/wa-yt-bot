const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');  // Automatically provides the correct binary path
const path = require('path');

// Set ffmpeg path using ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Downloads a YouTube video's audio and converts it to MP3.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {string} outputPath - The absolute path where the MP3 file will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when the process is complete.
 */
function downloadAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    // Download the best available audio stream
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
