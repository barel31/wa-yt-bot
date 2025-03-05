const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises; // for async file operations
const fsSync = require('fs'); // for creating file stream when needed

const TMP_PATH = '/tmp'; // Vercel's temporary storage location

// Update paths to use ../bin directory relative to the current file
const ytDlpExecutable = path.join(__dirname, '..', 'bin', 'yt-dlp-linux');
const ffmpegLocation = path.join(__dirname, '..', 'bin', 'ffmpeg-linux');

// Simple YouTube link validation
function isYouTubeLink(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

async function downloadAudio(videoUrl) {
  if (!isYouTubeLink(videoUrl)) {
    throw new Error('Invalid YouTube URL');
  }

  const outputFilename = 'audio.mp3';
  const outputPath = path.join(TMP_PATH, outputFilename);

  // Remove any pre-existing file to avoid conflicts
  try {
    await fs.access(outputPath);
    console.log(`File ${outputPath} exists. Deleting...`);
    await fs.unlink(outputPath);
    console.log('Old file deleted.');
  } catch (err) {
    console.log('No existing file found, continuing.');
  }

  console.log(`Starting download for URL: ${videoUrl}`);
  
  return new Promise((resolve, reject) => {
    // Build argument list for execFile
    const args = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--output', outputPath,
      '--ffmpeg-location', ffmpegLocation
    ];
    
    console.log('Executing command:', ytDlpExecutable, args.join(' '));
    
    execFile(ytDlpExecutable, args, (error, stdout, stderr) => {
      console.log('execFile callback invoked');
      if (error) {
        console.error('execFile error:', error);
        return reject(error);
      }
      if (stderr && stderr.trim().length > 0) {
        console.error('yt-dlp stderr:', stderr);
        // Optionally, decide whether to reject on stderr output.
      }
      console.log('yt-dlp stdout:', stdout);
      // Return the public URL for serveAudio endpoint.
      const audioUrl = `https://${process.env.VERCEL_URL}/api/serveAudio?filename=${outputFilename}`;
      console.log('Resolved audio URL:', audioUrl);
      resolve(audioUrl);
    });
  });
}

module.exports = { downloadAudio };
