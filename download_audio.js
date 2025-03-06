const { spawn } = require('child_process');
const path = require('path');

async function downloadAudio(videoUrl, outputPath) {
  // Adjust paths since binaries are now in the "bin" folder
  const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp');
  const ffmpegPath = path.join(__dirname, 'bin', 'ffmpeg');
  const cookiePath = path.join(__dirname, 'cookies_converted.txt');

  return new Promise((resolve, reject) => {
    const args = [
      videoUrl,
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '128K',
      '--ffmpeg-location',
      ffmpegPath,
      // '--cookies',
      // cookiePath,
      '-o',
      outputPath,
    ];

    const ytDlpProcess = spawn(ytDlpPath, args);

    ytDlpProcess.stdout.on('data', data => {
      console.log(`yt-dlp: ${data}`);
    });

    ytDlpProcess.stderr.on('data', data => {
      console.error(`yt-dlp error: ${data}`);
    });

    ytDlpProcess.on('close', code => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    ytDlpProcess.on('error', err => {
      reject(err);
    });
  });
}

module.exports = { downloadAudio };
