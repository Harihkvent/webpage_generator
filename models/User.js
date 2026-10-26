/**
 * User.js
 * Mongoose Schema for Webpage Generator Users
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    minimize: false
  }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
