// download.js
const axios = require('axios');
const redis = require('redis');

// Initialize Redis client using the official redis package.
let redisClient = null;
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  console.log('[Redis] Attempting to connect using URL:', redisUrl);
  redisClient = redis.createClient({ url: redisUrl });
  redisClient.on('error', (err) => {
    console.error('[Redis] Error event:', err.message);
    redisClient.quit();
    redisClient = null;
  });
  redisClient.connect()
    .then(() => console.log('[Redis] Connected successfully.'))
    .catch((err) => {
      console.error('[Redis] Connection error:', err.message);
      redisClient = null;
    });
} else {
  console.warn('[Redis] Caching disabled: no valid REDIS_URL provided.');
  console.log(redisUrl);
  
}

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
        console.log('[extractVideoId] Detected Shorts URL, video ID:', parts[shortsIndex + 1]);
        return parts[shortsIndex + 1];
      }
    }
    if (urlObj.hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1);
      console.log('[extractVideoId] Detected youtu.be URL, video ID:', id);
      return id;
    }
    if (urlObj.hostname.includes('youtube.com')) {
      const id = urlObj.searchParams.get('v');
      console.log('[extractVideoId] Detected youtube.com URL, video ID:', id);
      return id;
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
  console.log(`[sleep] Sleeping for ${ms} ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a simple text-based progress bar.
 * Example: 40% -> [████░░░░░░] 40%
 * @param {number} progress - A number between 0 and 100.
 * @returns {string}
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
 * @param {number} [maxAttempts=20] - Maximum polling attempts.
 * @param {number} [delayMs=5000] - Delay between attempts in ms.
 * @returns {Promise<{ link: string, title: string }>}
 */
async function pollForLink(videoId, options, updateCallback, maxAttempts = 20, delayMs = 5000) {
  let lastStatus = '';
  let queueCount = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Poll] Attempt ${attempt} for videoId: ${videoId}`);
    await sleep(delayMs);
    try {
      const pollResponse = await axios.request(options);
      const progressValue = pollResponse.data.progress || 0;
      lastStatus = pollResponse.data.msg || '';
      const status = (pollResponse.data.status || "").toLowerCase();
      console.log(`[Poll] Response: status=${status}, progress=${progressValue}, msg=${lastStatus}`);
      
      if (lastStatus.toLowerCase().includes("in queue")) {
        queueCount++;
      } else {
        queueCount = 0;
      }

      const shortStatus = lastStatus.length > 100 ? lastStatus.substring(0, 100) + '...' : lastStatus;
      await updateCallback(`ממיר...\n${createProgressBar(progressValue)}\nסטטוס: ${shortStatus}`);

      if (status === 'fail') {
        throw new Error(pollResponse.data.msg);
      }

      if (pollResponse.data.link && pollResponse.data.link !== '') {
        console.log(`[Poll] Successful conversion: ${pollResponse.data.link}`);
        return { link: pollResponse.data.link, title: pollResponse.data.title };
      }

      if (queueCount >= 5) {
        throw new Error("Conversion stuck in queue");
      }
    } catch (pollError) {
      console.error('[Poll] Error polling RapidAPI:', pollError.message);
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
  console.log('[processDownload] Received videoUrl:', videoUrl, 'format:', format);
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('קישור YouTube לא תקין');
  }

  const cacheKey = `download:${videoId}:${format}`;
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('[processDownload] Cache hit for key:', cacheKey);
        return JSON.parse(cached);
      } else {
        console.log('[processDownload] No cache for key:', cacheKey);
      }
    } catch (err) {
      console.error('[processDownload] Redis get error:', err.message);
    }
  } else {
    console.log('[processDownload] Redis client not available, skipping cache.');
  }

  // Choose endpoint and host based on format.
  const endpoint =
    format === 'mp4'
      ? 'https://youtube-video-fast-downloader-24-7.p.rapidapi.com/dl'
      : 'https://youtube-mp36.p.rapidapi.com/dl';
  const host =
    format === 'mp4'
      ? process.env.RAPIDAPI_HOST_MP4 || 'youtube-video-fast-downloader-24-7.p.rapidapi.com'
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

  console.log('[processDownload] Making RapidAPI request with options:', options);

  try {
    const response = await axios.request(options);
    const status = (response.data.status || "").toLowerCase();
    console.log('[processDownload] RapidAPI response:', response.data);

    if (status === 'fail') {
      await updateCallback(`ממיר...\n${createProgressBar(response.data.progress || 0)}\nסטטוס: ${response.data.msg}`);
      throw new Error(response.data.msg);
    }

    if (status === 'ok' && response.data.link && response.data.link !== "") {
      const result = { link: response.data.link, title: response.data.title };
      console.log('[processDownload] Successful conversion result:', result);
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 });
          console.log('[processDownload] Cached result under key:', cacheKey);
        } catch (err) {
          console.error('[processDownload] Redis set error:', err.message);
        }
      }
      return result;
    }

    if (status === 'processing') {
      console.log('[processDownload] Conversion is processing, starting polling.');
      return await pollForLink(videoId, options, updateCallback);
    }

    throw new Error(`תגובה לא צפויה מ-RapidAPI: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('[processDownload] RapidAPI error:', error.message);
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
