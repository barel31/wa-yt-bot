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
 * Waits for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Polls the RapidAPI endpoint until a valid link is available.
 * @param {string} videoId - The YouTube video ID.
 * @param {object} options - Axios request options.
 * @param {number} maxAttempts - Maximum number of polling attempts.
 * @param {number} delayMs - Delay between attempts in milliseconds.
 * @returns {Promise<string>} - The mp3 download link.
 */
async function pollForLink(videoId, options, maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Polling attempt ${attempt}...`);
    await sleep(delayMs);
    try {
      const pollResponse = await axios.request(options);
      console.log('Polling response:', JSON.stringify(pollResponse.data));
      if (pollResponse.data.link && pollResponse.data.link !== "") {
        return pollResponse.data.link;
      }
    } catch (pollError) {
      console.error('Error polling RapidAPI:', pollError);
    }
  }
  throw new Error("Link not generated after maximum polling attempts");
}

/**
 * Downloads audio from a YouTube URL via RapidAPI and returns the mp3 link.
 * @param {string} videoUrl - The YouTube video URL.
 * @returns {Promise<string>} - The mp3 URL from RapidAPI.
 */
async function processDownload(videoUrl) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Define the options for the RapidAPI request.
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

    // If a valid link is immediately available, return it.
    if (response.data.link && response.data.link !== "") {
      return response.data.link;
    }
    
    // If the status is "processing", start polling.
    if (response.data.status === 'processing') {
      return await pollForLink(videoId, options);
    }
    
    // Handle any unexpected response formats.
    throw new Error(`Unexpected response from RapidAPI: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('RapidAPI error:', error);
    throw error;
  }
}

module.exports = { processDownload };
