const mongoose = require('mongoose');

const ClickSchema = new mongoose.Schema({
  shortCode: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  userAgent: { type: String },
  ip: { type: String },
  location: { type: String }
});

module.exports = mongoose.model('Click', ClickSchema);