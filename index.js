const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Set trust proxy for rate limiter to work correctly behind Vercel
app.set('trust proxy', 1);

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all requests
app.use(limiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Define URL schema
const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, required: true, default: shortid.generate },
  createdAt: { type: Date, default: Date.now },
  clicks: { type: Number, default: 0 }
});

// Create URL model
const Url = mongoose.model('Url', urlSchema);

// Connect to MongoDB - Make sure MONGODB_URI is set in Vercel environment variables
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Shorten URL endpoint
app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Create a new shortened URL
    const urlDoc = new Url({
      originalUrl: url
    });
    
    await urlDoc.save();
    
    const shortUrl = `${req.protocol}://${req.get('host')}/${urlDoc.shortCode}`;
    
    res.json({ 
      originalUrl: url,
      shortUrl: shortUrl,
      shortCode: urlDoc.shortCode
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect to original URL
app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const url = await Url.findOne({ shortCode: code });
    
    if (!url) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    // Increment click count
    url.clicks += 1;
    await url.save();
    
    res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stats endpoint
app.get('/api/stats/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const url = await Url.findOne({ shortCode: code });
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Legacy server for backward compatibility
const legacyApp = express();
const legacyPort = process.env.LEGACY_PORT || 3001;

legacyApp.set('trust proxy', 1);
legacyApp.use(express.json());
legacyApp.use(express.static(path.join(__dirname, 'public')));

legacyApp.listen(legacyPort, () => {
  console.log(`Legacy server listening on port ${legacyPort}`);
});