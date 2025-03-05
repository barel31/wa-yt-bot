const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const ytDlpExecutable = '/opt/bin/yt-dlp'; // Path to yt-dlp in Vercel
const ffmpegLocation = '/opt/bin/ffmpeg'; // Path to ffmpeg

const TMP_PATH = '/tmp'; // Vercel's temporary storage location

async function downloadAudio(videoUrl) {
  return new Promise((resolve, reject) => {
    const outputFilename = 'audio.mp3';
    const outputPath = path.join(TMP_PATH, outputFilename);

    const command = `"${ytDlpExecutable}" ${videoUrl} --extract-audio --audio-format mp3 --output "${outputPath}" --ffmpeg-location "${ffmpegLocation}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return reject(stderr);
      }
      console.log(`stdout: ${stdout}`);

      // Return the public URL of the file
      const audioUrl = `https://${process.env.VERCEL_URL}/api/serveAudio?filename=${outputFilename}`;
      resolve(audioUrl);
    });
  });
}

module.exports = { downloadAudio };
