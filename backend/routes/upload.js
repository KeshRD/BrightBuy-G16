// routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const assetsDir = path.join(__dirname, '../Assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, assetsDir),
  filename: (req, file, cb) => {
    // Get the user-typed name and sanitize it
    const raw = (req.body?.desired_name || file.originalname.replace(/\.[^.]+$/, ''))
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-') // replace spaces and special chars with a dash
      .replace(/^-+|-+$/g, '')       // remove leading/trailing dashes
      .slice(0, 80) || 'image';

    // Get the original file extension
    const ext = path.extname(file.originalname) || '.jpg';

    // --- THIS IS THE FIX ---
    // Combine the sanitized name and the extension, without the timestamp
    cb(null, `${raw}${ext}`);
  },
});

const upload = multer({ storage });

// POST /api/admin/upload (fields: image (file), desired_name (text))
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ success: true, imageUrl: `/Assets/${req.file.filename}` });
});

module.exports = router;