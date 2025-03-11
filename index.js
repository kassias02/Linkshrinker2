const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
const app = express();

// Set trust proxy for Vercel
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve public/ assets (e.g., css, utils)
app.use(express.static(path.join(__dirname, 'views')));  // Serve views/ assets if needed

// URL Schema (move to models/Url.js if separate)
const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, required: true, default: shortid.generate },
  createdAt: { type: Date, default: Date.now },
  clicks: { type: Number, default: 0 }
});
const Url = mongoose.model('Url', urlSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html')); // Root-level views/
});

app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const urlDoc = new Url({ originalUrl: url });
    await urlDoc.save();
    const shortUrl = `${req.protocol}://${req.get('host')}/${urlDoc.shortCode}`;
    res.json({ originalUrl: url, shortUrl, shortCode: urlDoc.shortCode });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).sendFile(path.join(__dirname, 'views', 'error.html')); // Root-level views/
    }
    url.clicks += 1;
    await url.save();
    res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/stats/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const url = await Url.findOne({ shortCode: code });
    if (!url) return res.status(404).json({ error: 'URL not found' });
    res.json({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      clicks: url.clicks
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/stats/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'stats.html')); // Root-level views/
});

// Export for Vercel
module.exports = app;