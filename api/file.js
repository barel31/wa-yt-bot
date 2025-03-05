const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  const { name } = req.query;
  const filePath = path.join('/tmp', name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  fs.createReadStream(filePath).pipe(res);
};
