const path = require('path');
const fs = require('fs').promises; // asynchronous file operations
const fsSync = require('fs'); // for synchronous file checks
const { downloadAudio } = require('./download_audio');

const TMP_PATH = '/tmp'; // Vercel's temporary storage location

async function processDownload(videoUrl) {
  const outputFilename = 'audio.mp3';
  const outputPath = path.join(TMP_PATH, outputFilename);

  // Remove existing file if it exists
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

  // Construct the public URL for the serveAudio endpoint.
  const audioUrl = `https://${process.env.VERCEL_URL}/api/serveAudio?filename=${outputFilename}`;
  return audioUrl;
}

module.exports = { processDownload };
