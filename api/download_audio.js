const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

let ffmpeg;      // Will hold the createFFmpeg function's instance.
let fetchFile;   // (Optional) if you need fetchFile.
let ffmpegLoaded = false;

/**
 * Dynamically load the @ffmpeg/ffmpeg module and initialize ffmpeg.
 */
async function loadFFmpegModule() {
  if (!ffmpegLoaded) {
    const ffmpegModule = await import('@ffmpeg/ffmpeg');
    ffmpeg = ffmpegModule.createFFmpeg({ log: true });
    fetchFile = ffmpegModule.fetchFile; // In case you need it.
    console.log('Loading ffmpeg.wasm...');
    await ffmpeg.load();
    ffmpegLoaded = true;
    console.log('ffmpeg.wasm loaded.');
  }
}

/**
 * Downloads and converts a YouTube video to an MP3 file using ffmpeg.wasm.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {string} outputPath - The local filesystem path where the MP3 will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when done.
 */
async function downloadAudio(videoUrl, outputPath) {
  await loadFFmpegModule();

  console.log(`Downloading audio stream from: ${videoUrl}`);
  const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });
  const audioBuffer = Buffer.concat(chunks);
  console.log(`Downloaded ${audioBuffer.length} bytes.`);

  // Write the downloaded audio into ffmpeg's virtual filesystem.
  ffmpeg.FS('writeFile', 'input.m4a', new Uint8Array(audioBuffer));

  console.log('Converting to MP3...');
  // Convert the audio to MP3 with a bitrate of 128 kbps.
  await ffmpeg.run('-i', 'input.m4a', '-b:a', '128k', 'output.mp3');

  // Read the converted MP3 file from the virtual filesystem.
  const data = ffmpeg.FS('readFile', 'output.mp3');

  // Write the MP3 file to the local /tmp folder.
  await fs.promises.writeFile(outputPath, Buffer.from(data));
  console.log('Audio conversion complete:', outputPath);

  // Clean up the virtual filesystem.
  ffmpeg.FS('unlink', 'input.m4a');
  ffmpeg.FS('unlink', 'output.mp3');

  return outputPath;
}

module.exports = { downloadAudio };
