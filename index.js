const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid');
const nunjucks = require('nunjucks');
const QRCode = require('qrcode');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, 'public')));
nunjucks.configure(path.join(__dirname, 'views'), { autoescape: true, express: app });
app.set('view engine', 'njk');

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}
connectToDatabase().catch(err => console.error('MongoDB error:', err));

const Url = require('./models/Url');

app.get('/', (req, res) => {
  res.render('index', { showForm: true });
});

app.post('/shorten', async (req, res) => {
  await connectToDatabase();
  const { url, alias } = req.body;
  if (!url) return res.render('index', { showForm: true, error: 'URL required' });

  let shortCode = alias || shortid.generate();
  if (alias) {
    const existing = await Url.findOne({ shortCode: alias });
    if (existing) return res.render('index', { showForm: true, error: 'Alias already in use' });
  }

  const urlDoc = new Url({ originalUrl: url, shortCode });
  await urlDoc.save();
  const shortUrl = `https://linkshrinker2.vercel.app/${urlDoc.shortCode}`;
  const qrCode = await QRCode.toDataURL(shortUrl);
  res.render('index', { showForm: false, shortUrl, qrCode });
});

app.get('/:code', async (req, res) => {
  await connectToDatabase();
  const url = await Url.findOne({ shortCode: req.params.code });
  if (!url) return res.sendFile(path.join(__dirname, 'views', 'error.html'));
  url.clicks += 1;
  await url.save();
  res.redirect(url.originalUrl);
});

app.get('/stats', async (req, res) => {
  await connectToDatabase();
  const urls = await Url.find().sort({ clicks: -1 });
  const totalLinks = await Url.countDocuments();
  res.render('stats', { urls, totalLinks });
});

app.get('/debug/urls', async (req, res) => {
  await connectToDatabase();
  const urls = await Url.find();
  res.json(urls);
});

module.exports = app;