/**
 * Project.js
 * Mongoose Schema for Hosted Multi-Page Brand Campaigns
 * Supports soft-delete (with undelete/restore) and non-permanent lifecycle (TTL expiration)
 */

const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    brandColor: { type: String, default: '#6366F1' },
    logoUrl: { type: String, default: '' },
    topics: { type: [String], default: [] },
    articles: { type: Array, default: [] },
    author: { type: Object, default: {} },
    ownerId: { type: String, index: true, default: null },
    ownerName: { type: String, default: '' },
    ownerEmail: { type: String, default: '' },
    isPermanent: { type: Boolean, default: false },
    expiresAt: { type: String, default: null, index: true }, // Non-permanent expiration
    isDeleted: { type: Boolean, default: false, index: true }, // Soft-delete for undelete
    deletedAt: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() }
  },
  {
    timestamps: true,
    minimize: false,
    strict: false
  }
);

module.exports = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
