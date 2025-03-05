const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  console.log('serveAudio endpoint invoked');
  const { filename } = req.query;

  if (!filename) {
    console.error('Missing filename query parameter');
    return res.status(400).send('Missing filename query parameter');
  }

  const filePath = path.join('/tmp', filename);
  console.log('Looking for file at:', filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath);
      return res.status(404).send('File not found');
    }
    console.log('File found. Sending file...');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.sendFile(filePath);
  });
};
  