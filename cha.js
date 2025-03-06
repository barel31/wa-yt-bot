const fs = require('fs');

const cookiesJSON = JSON.parse(fs.readFileSync('./cookies.txt', 'utf-8'));

// Convert cookies JSON to cookie string format
const cookieString = cookiesJSON.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

// Save to new file
fs.writeFileSync('./cookies_converted.txt', cookieString);

console.log('Cookie string generated:', cookieString);
