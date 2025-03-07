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
    console.error('Error extracting video ID:', error);
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
 * Polls the RapidAPI endpoint until a valid link is available.
 * Calls updateCallback with status messages on each attempt.
 * @param {string} videoId - The YouTube video ID.
 * @param {object} options - Axios request options.
 * @param {Function} updateCallback - Callback to update status (optional).
 * @param {number} maxAttempts - Maximum polling attempts.
 * @param {number} delayMs - Delay between attempts in ms.
 * @returns {Promise<{link: string, title: string}>} - The mp3 download link and title.
 */
async function pollForLink(videoId, options, updateCallback, maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt}...`);
    if (updateCallback) {
      try {
        await updateCallback(`Attempt ${attempt}: Checking download status...`);
      } catch (e) {
        console.error("Error in update callback:", e);
      }
    }
    await sleep(delayMs);
    try {
      const pollResponse = await axios.request(options);
      console.log('Polling response:', JSON.stringify(pollResponse.data));
      if (updateCallback) {
        await updateCallback(`Status: ${pollResponse.data.msg}. Progress: ${pollResponse.data.progress || 0}%`);
      }
      if (pollResponse.data.link && pollResponse.data.link !== "") {
        return { link: pollResponse.data.link, title: pollResponse.data.title };
      }
    } catch (pollError) {
      console.error('Error polling RapidAPI:', pollError);
      if (updateCallback) {
        await updateCallback(`Error polling for status: ${pollError.message}`);
      }
    }
  }
  throw new Error("Link not generated after maximum polling attempts");
}

/**
 * Downloads audio from a YouTube URL via RapidAPI and returns the mp3 link and video title.
 * Accepts an updateCallback to inform about the download status.
 * @param {string} videoUrl - The YouTube video URL.
 * @param {Function} updateCallback - Callback for status updates (optional).
 * @returns {Promise<{link: string, title: string}>} - The mp3 URL and video title.
 */
async function processDownload(videoUrl, updateCallback) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
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
    console.log('RapidAPI response:', JSON.stringify(response.data));
    if (response.data.link && response.data.link !== "") {
      return { link: response.data.link, title: response.data.title };
    }
    if (response.data.status === 'processing') {
      return await pollForLink(videoId, options, updateCallback);
    }
    throw new Error(`Unexpected response from RapidAPI: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('RapidAPI error:', error);
    if (updateCallback) {
      await updateCallback(`Error: ${error.message}`);
    }
    throw error;
  }
}

module.exports = { processDownload, extractVideoId };
