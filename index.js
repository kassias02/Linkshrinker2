const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/favicon.ico', (req, res) => res.status(204).end()); // Before static
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI); // No deprecated options
  console.log('Connected to MongoDB');
}
connectToDatabase().catch(err => console.error('MongoDB error:', err));

const Url = require('./models/Url');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/shorten', async (req, res) => {
  await connectToDatabase();
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const urlDoc = new Url({ originalUrl: url, shortCode: shortid.generate() });
  await urlDoc.save();
  const shortUrl = `${req.protocol}://${req.get('host')}/${urlDoc.shortCode}`;
  res.json({ originalUrl: url, shortUrl });
});

app.get('/:code', async (req, res) => {
  await connectToDatabase();
  const url = await Url.findOne({ shortCode: req.params.code });
  if (!url) return res.status(404).sendFile(path.join(__dirname, 'views', 'error.html'));
  url.clicks += 1;
  await url.save();
  res.redirect(url.originalUrl);
});

app.get('/debug/urls', async (req, res) => {
  await connectToDatabase();
  const urls = await Url.find();
  res.json(urls);
});

module.exports = app;