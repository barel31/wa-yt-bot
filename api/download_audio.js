const ytdl = require('ytdl-core');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');
const fs = require('fs');
const path = require('path');

// Create an ffmpeg instance with logging enabled.
const ffmpeg = createFFmpeg({ log: true });

/**
 * Downloads and converts a YouTube video to an MP3 file using ffmpeg.wasm.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {string} outputPath - The local filesystem path where the MP3 will be saved.
 * @returns {Promise<string>} - Resolves with the outputPath when done.
 */
async function downloadAudio(videoUrl, outputPath) {
  // Load ffmpeg.wasm if not already loaded.
  if (!ffmpeg.isLoaded()) {
    console.log('Loading ffmpeg.wasm...');
    await ffmpeg.load();
    console.log('ffmpeg.wasm loaded.');
  }
  
  console.log(`Downloading audio stream from: ${videoUrl}`);
  // Download the audio stream into memory.
  const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });
  const audioBuffer = Buffer.concat(chunks);
  console.log(`Downloaded ${audioBuffer.length} bytes.`);

  // Write the downloaded audio into ffmpeg's virtual filesystem.
  ffmpeg.FS('writeFile', 'input.m4a', new Uint8Array(audioBuffer));

  // Run ffmpeg to convert the audio to MP3.
  console.log('Converting to MP3...');
  await ffmpeg.run('-i', 'input.m4a', '-b:a', '128k', 'output.mp3');

  // Read the converted MP3 file from ffmpeg's filesystem.
  const data = ffmpeg.FS('readFile', 'output.mp3');

  // Write the MP3 file to the local /tmp folder.
  await fs.promises.writeFile(outputPath, Buffer.from(data));
  console.log('Audio conversion complete:', outputPath);

  // Clean up the virtual files.
  ffmpeg.FS('unlink', 'input.m4a');
  ffmpeg.FS('unlink', 'output.mp3');

  return outputPath;
}

module.exports = { downloadAudio };
