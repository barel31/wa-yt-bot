const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).send('Missing filename query parameter');
  }

  const filePath = path.join('/tmp', filename);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
};
