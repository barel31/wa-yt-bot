const axios = require('axios');

/**
 * Extracts the YouTube video ID from a given URL.
 * Supports both "youtu.be" short URLs and standard "youtube.com" URLs.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} - The video ID or null if not found.
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a simple text-based progress bar for a given percentage.
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
 * Calls updateCallback with a text-based progress bar.
 * @param {string} videoId - The YouTube video ID.
 * @param {object} options - Axios request options.
 * @param {Function} updateCallback - Callback to update status.
 * @param {number} maxAttempts - Maximum polling attempts.
 * @param {number} delayMs - Delay between attempts in ms.
 * @returns {Promise<{ link: string, title: string }>} - The mp3 link and title.
 */
async function pollForLink(videoId, options, updateCallback, maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);
    try {
      const pollResponse = await axios.request(options);
      const progressValue = pollResponse.data.progress || 0;
      const bar = createProgressBar(progressValue);
      await updateCallback(`ממיר...\n${bar}`);

      if (pollResponse.data.link && pollResponse.data.link !== '') {
        return { link: pollResponse.data.link, title: pollResponse.data.title };
      }
    } catch (pollError) {
      console.error('שגיאה בעדכון סטטוס מ-RapidAPI:', pollError);
      await updateCallback(`שגיאה בעדכון סטטוס: ${pollError.message}`);
    }
  }
  throw new Error('לא נוצר קישור לאחר מספר ניסיונות מקסימלי');
}

/**
 * Downloads audio from a YouTube URL via RapidAPI and returns the mp3 link and title.
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
    if (response.data.link && response.data.link !== '') {
      return { link: response.data.link, title: response.data.title };
    }
    if (response.data.status === 'processing') {
      return await pollForLink(videoId, options, updateCallback);
    }
    throw new Error(`תגובה לא צפויה מ-RapidAPI: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('שגיאה ב-RapidAPI:', error);
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
