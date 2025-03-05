const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises; // for async file operations
const TMP_PATH = '/tmp'; // Vercel's temporary storage location

const ytDlpExecutable = '/opt/bin/yt-dlp'; // Path to yt-dlp in Vercel
const ffmpegLocation = '/opt/bin/ffmpeg'; // Path to ffmpeg

// Simple validation to check if the URL looks like a YouTube link
function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

async function downloadAudio(videoUrl) {
  if (!isYouTubeLink(videoUrl)) {
    throw new Error('Invalid YouTube URL');
  }

  const outputFilename = 'audio.mp3';
  const outputPath = path.join(TMP_PATH, outputFilename);

  // Remove existing file if it exists
  try {
    await fs.access(outputPath);
    await fs.unlink(outputPath);
  } catch (err) {
    // File does not exist; no need to remove
  }

  return new Promise((resolve, reject) => {
    // Build arguments array for execFile
    const args = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--output', outputPath,
      '--ffmpeg-location', ffmpegLocation
    ];

    execFile(ytDlpExecutable, args, (error, stdout, stderr) => {
      if (error) {
        console.error('execFile error:', error);
        return reject(error);
      }
      // Note: Some libraries may output non-critical info to stderr.
      if (stderr) {
        console.error('yt-dlp stderr:', stderr);
        // Optionally, decide whether to reject on stderr output.
      }
      console.log('yt-dlp stdout:', stdout);
      // Return the public URL for serveAudio endpoint.
      const audioUrl = `https://${process.env.VERCEL_URL}/api/serveAudio?filename=${outputFilename}`;
      resolve(audioUrl);
    });
  });
}

module.exports = { downloadAudio };
