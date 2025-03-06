const play = require('play-dl');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = path.join(__dirname, 'ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

async function downloadAudio(videoUrl, outputPath) {
  try {
    const cookiePath = path.join(__dirname, 'cookies_converted.txt');
    const cookieString = fs.readFileSync(cookiePath, 'utf-8').trim();

    await play.setToken({
      youtube: { cookie: cookieString }
    });

    const stream = await play.stream(videoUrl, {
      useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });

    return new Promise((resolve, reject) => {
      ffmpeg(stream.stream)
        .audioBitrate(128)
        .format('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => resolve(outputPath))
        .save(outputPath);
    });

  } catch (error) {
    console.error('Error in downloadAudio:', error);
    throw error;
  }
}

module.exports = { downloadAudio };
