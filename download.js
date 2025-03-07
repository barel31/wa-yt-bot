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
    // If the URL is the youtu.be short link format:
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    // If the URL is from youtube.com, look for the "v" query parameter:
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
 * Downloads audio from a YouTube URL via RapidAPI and returns the mp3 link.
 * @param {string} videoUrl - The YouTube video URL.
 * @returns {Promise<string>} - The mp3 URL from RapidAPI.
 */
async function processDownload(videoUrl) {
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
    if (response.data && response.data.link) {
      console.log('RapidAPI response:', response.data);
      return response.data.link;
    } else {
      throw new Error('Invalid response from RapidAPI');
    }
  } catch (error) {
    console.error('RapidAPI error:', error);
    throw error;
  }
}

module.exports = { processDownload };
