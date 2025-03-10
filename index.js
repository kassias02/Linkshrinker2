const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const geoip = require('geoip-lite');
const nunjucks = require('nunjucks');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Templating engine
nunjucks.configure('views', { autoescape: true, express: app });

// Database connection
mongoose.connect('mongodb+srv://takewadit:Latifa06&@linkshrinker.4niam.mongodb.net/?retryWrites=true&w=majority&appName=LinkShrinker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Models
const Url = require('./models/Url');
const Click = require('./models/Click');

// Routes
app.get('/', (req, res) => {
  res.render('index.html');
});

app.post('/shorten', [
  body('url').isURL().withMessage('Invalid URL')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let { url } = req.body;
  if (!url.startsWith('http')) {
    url = `http://${url}`;
  }

  const shortCode = shortid.generate();
  const newUrl = new Url({ originalUrl: url, shortCode });
  await newUrl.save();

  res.json({ shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}` });
});

app.get('/:shortCode', async (req, res) => {
  const url = await Url.findOne({ shortCode: req.params.shortCode });
  if (!url) return res.status(404).send('URL not found');

  // Log click
  const ip = req.ip;
  const location = geoip.lookup(ip)?.country || 'Unknown';
  const click = new Click({
    shortCode: req.params.shortCode,
    userAgent: req.get('User-Agent'),
    ip,
    location
  });
  await click.save();

  res.redirect(url.originalUrl);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});