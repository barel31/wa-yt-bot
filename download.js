const { downloadAudio } = require('./download_audio');

/**
 * Downloads audio from a YouTube URL, uploads it to S3, and returns the public URL.
 * @param {string} videoUrl - The YouTube video URL.
 * @returns {Promise<string>} - The public S3 URL.
 */
async function processDownload(videoUrl) {
  console.log(`Starting audio download for URL: ${videoUrl}`);
  const s3Url = await downloadAudio(videoUrl);
  console.log('Audio download and upload complete. S3 URL:', s3Url);
  return s3Url;
}

module.exports = { processDownload };
