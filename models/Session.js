/**
 * Session.js
 * Mongoose Schema for User Auth Sessions with automatic TTL expiry
 */

const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: '30d' } }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Session || mongoose.model('Session', SessionSchema);
