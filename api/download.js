const path = require('path');
const fs = require('fs').promises;
const { downloadAudio } = require('./download_audio');

const TMP_PATH = '/tmp'; // Vercel's temporary storage location

/**
 * Processes the download of the audio from a YouTube URL and returns a public URL.
 * @param {string} videoUrl - The YouTube video URL.
 * @returns {Promise<string>} - The public URL for the converted MP3.
 */
async function processDownload(videoUrl) {
  const outputFilename = 'audio.mp3';
  const outputPath = path.join(TMP_PATH, outputFilename);

  // Remove any existing file to avoid conflicts.
  try {
    await fs.access(outputPath);
    console.log(`File ${outputPath} exists. Deleting...`);
    await fs.unlink(outputPath);
    console.log('Old file deleted.');
  } catch (err) {
    console.log('No existing file found, proceeding.');
  }

  console.log(`Starting audio download for URL: ${videoUrl}`);
  await downloadAudio(videoUrl, outputPath);
  console.log('Audio download complete.');

  // Construct the public URL to access the audio file via serveAudio endpoint.
  const audioUrl = `https://${process.env.VERCEL_URL}/api/serveAudio?filename=${outputFilename}`;
  return audioUrl;
}

module.exports = { processDownload };
