const axios = require('axios');

/**
 * Extracts the YouTube video ID from a given URL.
 * Supports youtu.be, youtube.com, and YouTube Shorts (e.g., /shorts/VIDEO_ID).
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
 * Sleeps for the given number of milliseconds.
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
 * Polls the RapidAPI endpoint until a valid link is available.
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
      
      await updateCallback(`ממיר...\n${createProgressBar(progressValue)}\nסטטוס: ${lastStatus}`);
      
      if (pollResponse.data.status === 'fail') {
        throw new Error(pollResponse.data.msg);
      }
      
      if (pollResponse.data.link && pollResponse.data.link !== '') {
        return { link: pollResponse.data.link, title: pollResponse.data.title };
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
 * Downloads audio from a YouTube URL via RapidAPI.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {Function} updateCallback - Callback for status updates.
 * @returns {Promise<{ link: string, title: string }>}
 */
async function processDownload(videoUrl, updateCallback) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('קישור YouTube לא תקין');
  }

  const options = {
    method: 'GET',
    url: 'https://youtube-mp36.p.rapidapi.com/dl',
    params: { id: videoId },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': process.env.RAPIDAPI_HOST || 'youtube-mp36.p.rapidapi.com',
    },
  };

  try {
    const response = await axios.request(options);
    if (response.data.status === 'fail') {
      await updateCallback(`ממיר...\n${createProgressBar(response.data.progress || 0)}\nסטטוס: ${response.data.msg}`);
      throw new Error(response.data.msg);
    }
    
    if (response.data.link && response.data.link !== '') {
      return { link: response.data.link, title: response.data.title };
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
};
