const axios = require('axios');

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
    // Log the complete response data for debugging
    console.log('RapidAPI response:', JSON.stringify(response.data));
    
    if (response.data && response.data.link) {
      return response.data.link;
    } else {
      throw new Error(`Invalid response from RapidAPI: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('RapidAPI error:', error);
    throw error;
  }
}

module.exports = { processDownload };
