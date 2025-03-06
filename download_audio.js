const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');

// Configure AWS S3 using environment variables.
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function downloadAudio(videoUrl) {
  const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp');
  const ffmpegPath = path.join(__dirname, 'bin', 'ffmpeg');
  const cookiePath = path.join(__dirname, 'cookies_converted.txt');

  // Generate a unique file name using the current timestamp.
  const uniqueFileName = `audio-${Date.now()}.mp3`;
  const outputPath = `/tmp/${uniqueFileName}`;

  return new Promise((resolve, reject) => {
    const args = [
      videoUrl,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--ffmpeg-location', ffmpegPath,
      '--cookies', cookiePath,
      '-o', outputPath
    ];

    const ytDlpProcess = spawn(ytDlpPath, args);

    ytDlpProcess.stdout.on('data', (data) => {
      console.log(`yt-dlp: ${data}`);
    });

    ytDlpProcess.stderr.on('data', (data) => {
      console.error(`yt-dlp error: ${data}`);
    });

    ytDlpProcess.on('close', async (code) => {
      if (code === 0) {
        console.log('Download complete. Uploading file to S3...');
        try {
          const s3Url = await uploadToS3(outputPath, uniqueFileName);
          resolve(s3Url);
        } catch (uploadError) {
          reject(uploadError);
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    ytDlpProcess.on('error', (err) => {
      reject(err);
    });
  });
}

async function uploadToS3(filePath, fileName) {
  const fileStream = fs.createReadStream(filePath);
  const bucketName = process.env.S3_BUCKET_NAME;

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileStream,
    ContentType: 'audio/mpeg'
    // No ACL is set because your bucket blocks public ACLs.
  };

  try {
    // First, upload the file.
    await s3.upload(params).promise();
    // Then, generate a pre-signed URL valid for 1 hour.
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: fileName,
      Expires: 3600
    });
    console.log('Pre-signed URL:', signedUrl);
    return signedUrl;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

module.exports = { downloadAudio };
