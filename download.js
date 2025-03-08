const axios = require('axios');

/**
 * Extracts the YouTube video ID from a given URL.
 * Supports youtu.be, youtube.com, and YouTube Shorts (/shorts/VIDEO_ID).
 * @param {string} url - The YouTube URL.
 * @returns {string|null} - The video ID or null if not found.
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.includes('/shorts/')) {
      const parts = urlObj.pathname.split('/');
      const shortsIndex = parts.indexOf('shorts');
      if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
        return parts[shortsIndex + 1];
      }
    }
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    return null;
  } catch (error) {
    console.error('שגיאה בחילוץ מזהה הווידאו:', error);
    return null;
  }
}

/**
 * Sleeps for a given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a simple text-based progress bar.
 * Example: 40% -> [████░░░░░░] 40%
 */
function createProgressBar(progress) {
  const totalBars = 10;
  const filledBars = Math.round((progress / 100) * totalBars);
  const barStr = '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);
  return `[${barStr}] ${progress}%`;
}

/**
 * Polls the RapidAPI endpoint until a valid conversion link is available.
 * Updates status using updateCallback.
 * @param {string} videoId - The YouTube video ID.
 * @param {object} options - Axios request options.
 * @param {Function} updateCallback - Callback to update status.
 * @param {number} maxAttempts - Maximum polling attempts.
 * @param {number} delayMs - Delay between attempts in ms.
 * @returns {Promise<{ link: string, title: string }>}
 */
async function pollForLink(videoId, options, updateCallback, maxAttempts = 20, delayMs = 5000) {
  let lastStatus = '';
  let queueCount = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);
    try {
      const pollResponse = await axios.request(options);
      const progressValue = pollResponse.data.progress || 0;
      lastStatus = pollResponse.data.msg || '';
      
      if (lastStatus.toLowerCase().includes("in queue")) {
        queueCount++;
      } else {
        queueCount = 0;
      }
      
      // Use a shorter version of status text to avoid message-too-long errors.
      const shortStatus = lastStatus.length > 100 ? lastStatus.substring(0, 100) + '...' : lastStatus;
      await updateCallback(`ממיר...\n${createProgressBar(progressValue)}\nסטטוס: ${shortStatus}`);
      
      if (pollResponse.data.status === 'fail') {
        throw new Error(pollResponse.data.msg);
      }
      
      if (pollResponse.data.status === 'OK') {
        // In the polling response, check if the conversion is ready.
        const title = pollResponse.data.title;
        let link = "";
        // For mp3, choose an audio format from adaptiveFormats.
        if (options.url.includes('mp36')) {
          if (pollResponse.data.adaptiveFormats && Array.isArray(pollResponse.data.adaptiveFormats)) {
            const audioFormat = pollResponse.data.adaptiveFormats.find(f => f.mimeType && f.mimeType.includes("audio"));
            if (audioFormat && audioFormat.url) {
              link = audioFormat.url;
            }
          }
        } else {
          if (pollResponse.data.formats && Array.isArray(pollResponse.data.formats)) {
            const videoFormat = pollResponse.data.formats.find(f => f.mimeType && f.mimeType.includes("mp4"));
            if (videoFormat && videoFormat.url) {
              link = videoFormat.url;
            }
          }
        }
        if (link) return { link, title };
      }
      
      if (queueCount >= 5) {
        throw new Error("Conversion stuck in queue");
      }
    } catch (pollError) {
      console.error('Error polling RapidAPI:', pollError.message);
      await updateCallback(`שגיאה בעדכון סטטוס: ${pollError.message}`);
      throw pollError;
    }
  }
  throw new Error(`לא נוצר קישור לאחר ${maxAttempts} ניסיונות. סטטוס אחרון: ${lastStatus}`);
}

/**
 * Downloads audio/video from a YouTube URL via RapidAPI.
 * Accepts a "format" parameter ("mp3" or "mp4").
 * @param {string} videoUrl - The YouTube video URL.
 * @param {Function} updateCallback - Callback for status updates.
 * @param {string} [format='mp3'] - The desired format ("mp3" or "mp4").
 * @returns {Promise<{ link: string, title: string }>}
 */
async function processDownload(videoUrl, updateCallback, format = 'mp3') {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('קישור YouTube לא תקין');
  }

  const endpoint = format === 'mp4'
    ? 'https://youtube-mp4.p.rapidapi.com/dl'
    : 'https://youtube-mp36.p.rapidapi.com/dl';
  const host = format === 'mp4'
    ? process.env.RAPIDAPI_HOST_MP4 || 'youtube-mp4.p.rapidapi.com'
    : process.env.RAPIDAPI_HOST || 'youtube-mp36.p.rapidapi.com';

  const options = {
    method: 'GET',
    url: endpoint,
    params: { id: videoId },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': host,
    },
  };

  try {
    const response = await axios.request(options);
    if (response.data.status === 'fail') {
      await updateCallback(`ממיר...\n${createProgressBar(response.data.progress || 0)}\nסטטוס: ${response.data.msg}`);
      throw new Error(response.data.msg);
    }
    
    if (response.data.status === 'OK') {
      const title = response.data.title;
      let link = "";
      if (format === 'mp3') {
        if (response.data.adaptiveFormats && Array.isArray(response.data.adaptiveFormats)) {
          const audioFormat = response.data.adaptiveFormats.find(f => f.mimeType && f.mimeType.includes("audio"));
          if (audioFormat && audioFormat.url) {
            link = audioFormat.url;
          }
        }
      } else if (format === 'mp4') {
        if (response.data.formats && Array.isArray(response.data.formats)) {
          const videoFormat = response.data.formats.find(f => f.mimeType && f.mimeType.includes("mp4"));
          if (videoFormat && videoFormat.url) {
            link = videoFormat.url;
          }
        }
      }
      if (!link) throw new Error("לא נמצא קישור להמרה עבור הפורמט המבוקש");
      return { link, title };
    }
    
    if (response.data.status === 'processing') {
      return await pollForLink(videoId, options, updateCallback);
    }
    
    throw new Error(`תגובה לא צפויה מ-RapidAPI: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('RapidAPI error:', error.message);
    if (updateCallback) {
      await updateCallback(`שגיאה: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  processDownload,
  extractVideoId,
  createProgressBar,
  sleep,
};
