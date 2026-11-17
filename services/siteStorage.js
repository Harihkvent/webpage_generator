/**
 * siteStorage.js
 * Persistent project database & site manager with ownership & authorization support
 * Supports MongoDB Atlas with automatic fallback to local disk and /tmp for serverless
 */
const fs = require('fs');
const path = require('path');
const { connectDB, isDbConnected } = require('./db');
const Project = require('../models/Project');

// Bundled seed database location
const BUNDLED_DATA_FILE = path.join(__dirname, '..', 'data', 'projects.json');

// If running in Vercel serverless, use /tmp which is writable
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'projects.json')
  : BUNDLED_DATA_FILE;

// In-memory cache fallback
let memoryProjects = null;
let migratedProjects = false;

// Ensure local file data folder and file exists
function ensureStorage() {
  try {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      if (fs.existsSync(BUNDLED_DATA_FILE)) {
        const initial = fs.readFileSync(BUNDLED_DATA_FILE, 'utf-8');
        fs.writeFileSync(DATA_FILE, initial, 'utf-8');
      } else {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
      }
    }
  } catch (err) {
    console.warn('Storage warning (using in-memory fallback):', err.message);
    if (!memoryProjects) memoryProjects = [];
  }
}

// Read from fallback JSON file
function getFileProjects() {
  ensureStorage();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading projects.json:', err.message);
  }
  return memoryProjects || [];
}

// Save to fallback JSON file
function saveFileProjects(projects) {
  ensureStorage();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write to disk, saving to memory:', err.message);
    memoryProjects = projects;
  }
}

// Migrate initial seed projects to MongoDB Atlas if database is empty
async function syncFromLocalIfEmpty() {
  if (migratedProjects) return;
  try {
    if (isDbConnected()) {
      const count = await Project.countDocuments();
      if (count === 0) {
        const fileProjects = getFileProjects();
        if (fileProjects.length > 0) {
          console.log(`[MongoDB] Migrating ${fileProjects.length} existing projects from JSON to MongoDB Atlas...`);
          await Project.insertMany(fileProjects, { ordered: false });
          console.log('[MongoDB] Migration of projects complete!');
        }
      }
      migratedProjects = true;
    }
  } catch (err) {
    console.warn('[MongoDB] Sync projects warning:', err.message);
  }
}

// Convert Hex to RGB and calculate contrast text color (White or Dark)
function getContrastColor(hexColor) {
  let hex = (hexColor || '#3B82F6').replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#FFFFFF';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // YIQ luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0F172A' : '#FFFFFF';
}

// Generate subtle color variations
function adjustBrightness(hexColor, percent) {
  let hex = (hexColor || '#3B82F6').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return hexColor;

  const num = parseInt(hex, 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Generate an elegant SVG monogram if no logo image uploaded
function generateMonogramSvg(companyName, brandColor) {
  const initials = (companyName || 'CO')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CO';

  const contrast = getContrastColor(brandColor);
  const color1 = brandColor || '#3B82F6';
  const color2 = adjustBrightness(color1, -25);

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
    '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="' + color1 + '"/>' +
    '<stop offset="100%" stop-color="' + color2 + '"/>' +
    '</linearGradient></defs>' +
    '<rect width="120" height="120" rx="28" fill="url(#g)"/>' +
    '<text x="60" y="73" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-weight="800" font-size="44" fill="' + contrast + '" text-anchor="middle">' + initials + '</text>' +
    '</svg>';

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// Generate a clean author avatar monogram
function generateAuthorAvatarSvg(authorName, brandColor) {
  const initials = (authorName || 'ED')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ED';

  const contrast = getContrastColor(brandColor);
  const color = brandColor || '#3B82F6';
  const fillColor = adjustBrightness(color, -10);

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
    '<circle cx="40" cy="40" r="38" fill="' + fillColor + '" stroke="' + color + '" stroke-width="2"/>' +
    '<text x="40" y="49" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-weight="700" font-size="26" fill="' + contrast + '" text-anchor="middle">' + initials + '</text>' +
    '</svg>';

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// Read all projects
async function getAllProjects(includeDeleted = false) {
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const query = includeDeleted ? {} : { isDeleted: { $ne: true } };
      const docs = await Project.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return docs.map(doc => {
        const { _id, __v, ...proj } = doc;
        return proj;
      });
    } catch (err) {
      console.warn('[MongoDB] getAllProjects fallback to file:', err.message);
    }
  }

  const fileProjects = getFileProjects();
  if (includeDeleted) return fileProjects;
  return fileProjects.filter(p => !p.isDeleted);
}

// Get single project
async function getProjectById(id, includeDeleted = true) {
  if (!id) return null;
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const query = includeDeleted ? { id } : { id, isDeleted: { $ne: true } };
      const doc = await Project.findOne(query).lean();
      if (doc) {
        const { _id, __v, ...proj } = doc;
        return proj;
      }
      return null;
    } catch (err) {
      console.warn('[MongoDB] getProjectById fallback to file:', err.message);
    }
  }

  const projects = getFileProjects();
  const found = projects.find(p => p.id === id);
  if (!found) return null;
  if (!includeDeleted && found.isDeleted) return null;
  return found;
}

// Get projects belonging to a specific user
async function getProjectsByOwner(ownerId, status = 'active') {
  if (!ownerId) return [];
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const query = { ownerId };
      if (status === 'active') query.isDeleted = { $ne: true };
      if (status === 'deleted') query.isDeleted = true;

      const docs = await Project.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return docs.map(doc => {
        const { _id, __v, ...proj } = doc;
        return proj;
      });
    } catch (err) {
      console.warn('[MongoDB] getProjectsByOwner fallback to file:', err.message);
    }
  }

  const projects = getFileProjects();
  return projects.filter(p => {
    if (p.ownerId !== ownerId) return false;
    if (status === 'active') return !p.isDeleted;
    if (status === 'deleted') return p.isDeleted === true;
    return true;
  });
}

// Sanitize SVG inputs
function toBase64SvgDataUri(val) {
  if (typeof val === 'string' && (val.startsWith('data:image/svg+xml;utf8,') || (val.startsWith('data:image/svg+xml') && val.includes('<svg')))) {
    const rawSvg = val.replace(/^data:image\/svg\+xml(;utf8)?,?/, '');
    return 'data:image/svg+xml;base64,' + Buffer.from(rawSvg, 'utf8').toString('base64');
  }
  return val;
}

function sanitizeProjectData(project) {
  if (!project) return project;
  if (project.logoUrl) project.logoUrl = toBase64SvgDataUri(project.logoUrl);
  if (project.author && project.author.avatar) {
    project.author.avatar = toBase64SvgDataUri(project.author.avatar);
  }
  if (Array.isArray(project.articles)) {
    project.articles.forEach(a => {
      if (a.author && a.author.avatar) {
        a.author.avatar = toBase64SvgDataUri(a.author.avatar);
      }
    });
  }
  return project;
}

// Save or update project
async function saveProject(project) {
  project = sanitizeProjectData(project);
  await connectDB();

  project.updatedAt = new Date().toISOString();
  if (!project.createdAt) {
    project.createdAt = project.updatedAt;
  }

  // Preserve permanent demo sites
  if (project.id === 'site-apex-cloud-systems-seed' || project.isPermanent) {
    project.isPermanent = true;
    project.expiresAt = null;
  } else if (!project.expiresAt) {
    // Non-permanent campaign: expires after 24 hours (TTL)
    project.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  project.isDeleted = Boolean(project.isDeleted);

  if (isDbConnected()) {
    try {
      await Project.findOneAndUpdate(
        { id: project.id },
        { $set: project },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      // Backup to local file storage
      const fileProjects = getFileProjects();
      const existingIdx = fileProjects.findIndex(p => p.id === project.id);
      if (existingIdx >= 0) {
        fileProjects[existingIdx] = project;
      } else {
        fileProjects.unshift(project);
      }
      saveFileProjects(fileProjects);
      return project;
    } catch (err) {
      console.warn('[MongoDB] saveProject error (saving to local file):', err.message);
    }
  }

  // Fallback to local file storage
  const fileProjects = getFileProjects();
  const existingIdx = fileProjects.findIndex(p => p.id === project.id);
  if (existingIdx >= 0) {
    fileProjects[existingIdx] = {
      ...fileProjects[existingIdx],
      ...project,
      updatedAt: new Date().toISOString()
    };
  } else {
    fileProjects.unshift(project);
  }
  saveFileProjects(fileProjects);
  return project;
}

// Soft-Delete project with owner authorization check
async function deleteProject(id, requestingUserId = null) {
  await connectDB();

  const project = await getProjectById(id, true);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.isPermanent) {
    return { success: false, error: 'Permanent demo campaigns cannot be deleted.' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId && project.ownerId !== 'usr_demo_creator') {
    return { success: false, error: 'Unauthorized: You can only delete your own hosted sites.' };
  }

  project.isDeleted = true;
  project.deletedAt = new Date().toISOString();
  await saveProject(project);

  return { success: true, message: 'Hosted site moved to trash. You can undelete it within 24 hours.' };
}

// Undelete / Restore soft-deleted project
async function undeleteProject(id, requestingUserId = null) {
  await connectDB();

  const project = await getProjectById(id, true);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId && project.ownerId !== 'usr_demo_creator') {
    return { success: false, error: 'Unauthorized: You can only restore your own hosted sites.' };
  }

  if (!project.isDeleted) {
    return { success: false, error: 'This site is not deleted.' };
  }

  project.isDeleted = false;
  project.deletedAt = null;

  // Extend expiration for restored campaign (another 24h)
  if (!project.isPermanent) {
    project.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  await saveProject(project);

  return { success: true, message: 'Hosted site restored successfully.', project };
}

// Background cleaner: permanently purges expired campaigns (TTL 24h) and trash older than 24h
async function cleanupExpiredProjects() {
  try {
    const now = new Date();
    await connectDB();

    if (isDbConnected()) {
      // 1. Delete TTL-expired non-permanent projects
      const expiredResult = await Project.deleteMany({
        isPermanent: { $ne: true },
        expiresAt: { $lt: now.toISOString(), $ne: null }
      });

      // 2. Delete projects in trash for > 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const trashResult = await Project.deleteMany({
        isDeleted: true,
        deletedAt: { $lt: oneDayAgo }
      });

      if (expiredResult.deletedCount > 0 || trashResult.deletedCount > 0) {
        console.log(`[Storage Cleanup] Purged ${expiredResult.deletedCount} expired and ${trashResult.deletedCount} trash projects.`);
      }
    }

    // Sync file fallback
    let fileProjects = getFileProjects();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filtered = fileProjects.filter(p => {
      if (p.isPermanent || p.id === 'site-apex-cloud-systems-seed') return true;
      if (p.expiresAt && new Date(p.expiresAt) < now) return false;
      if (p.isDeleted && p.deletedAt && p.deletedAt < oneDayAgo) return false;
      return true;
    });

    if (filtered.length !== fileProjects.length) {
      saveFileProjects(filtered);
    }
  } catch (err) {
    console.warn('[Storage Cleanup] Notice:', err.message);
  }
}

// Update project branding & metadata
async function updateProject(id, updates = {}, requestingUserId = null) {
  const project = await getProjectById(id);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId && project.ownerId !== 'usr_demo_creator') {
    return { success: false, error: 'Unauthorized: You can only update your own hosted sites.' };
  }

  if (updates.companyName && updates.companyName.trim()) {
    project.companyName = updates.companyName.trim();
  }

  if (updates.brandColor && updates.brandColor.trim()) {
    project.brandColor = updates.brandColor.trim();
  }

  if (updates.logoUrl !== undefined) {
    project.logoUrl = updates.logoUrl.trim() || generateMonogramSvg(project.companyName, project.brandColor);
  }

  // Update author profile
  if (updates.authorName || updates.authorRole || updates.authorBio || updates.authorAvatar) {
    project.author = {
      name: updates.authorName ? updates.authorName.trim() : (project.author?.name || `${project.companyName} Team`),
      role: updates.authorRole ? updates.authorRole.trim() : (project.author?.role || 'Contributor'),
      bio: updates.authorBio ? updates.authorBio.trim() : (project.author?.bio || ''),
      avatar: updates.authorAvatar ? updates.authorAvatar.trim() : (project.author?.avatar || generateAuthorAvatarSvg(project.author?.name, project.brandColor))
    };
  }

  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return { success: true, project };
}

// Update a specific article in a project (WYSIWYG / Content Editor)
async function updateArticle(projectId, articleSlug, articleUpdates = {}, requestingUserId = null) {
  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId && project.ownerId !== 'usr_demo_creator') {
    return { success: false, error: 'Unauthorized: You can only edit articles on your own hosted sites.' };
  }

  if (!Array.isArray(project.articles)) {
    return { success: false, error: 'No articles found in this campaign' };
  }

  const articleIndex = project.articles.findIndex(a => a.slug === articleSlug);
  if (articleIndex === -1) {
    return { success: false, error: 'Article not found' };
  }

  const existing = project.articles[articleIndex];

  // Merge updates
  const updatedArticle = {
    ...existing,
    title: articleUpdates.title ? articleUpdates.title.trim() : existing.title,
    summary: articleUpdates.summary !== undefined ? articleUpdates.summary.trim() : existing.summary,
    keyTakeaways: Array.isArray(articleUpdates.keyTakeaways) ? articleUpdates.keyTakeaways : existing.keyTakeaways,
    sections: Array.isArray(articleUpdates.sections) ? articleUpdates.sections : existing.sections,
    faqs: Array.isArray(articleUpdates.faqs) ? articleUpdates.faqs : existing.faqs,
    readingTime: articleUpdates.readingTime || existing.readingTime,
    updatedAt: new Date().toISOString()
  };

  // Recalculate word count dynamically
  let allText = `${updatedArticle.title} ${updatedArticle.summary} ` +
    (updatedArticle.keyTakeaways || []).join(' ') + ' ' +
    (updatedArticle.sections || []).map(s => `${s.h2 || ''} ${(s.subsections || []).map(sub => `${sub.h3 || ''} ${(sub.paragraphs || []).join(' ')}`).join(' ')}`).join(' ') + ' ' +
    (updatedArticle.faqs || []).map(f => `${f.q || ''} ${f.a || ''}`).join(' ');

  const clean = allText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  updatedArticle.wordCount = clean ? clean.split(/\s+/).length : existing.wordCount;

  project.articles[articleIndex] = updatedArticle;
  project.updatedAt = new Date().toISOString();

  await saveProject(project);
  return { success: true, article: updatedArticle, project };
}

// Replace/Regenerate an article in a project
async function replaceArticleInProject(projectId, articleSlug, newArticle, requestingUserId = null) {
  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId && project.ownerId !== 'usr_demo_creator') {
    return { success: false, error: 'Unauthorized: You can only regenerate articles on your own hosted sites.' };
  }

  const articleIndex = (project.articles || []).findIndex(a => a.slug === articleSlug);
  if (articleIndex === -1) {
    return { success: false, error: 'Article not found' };
  }

  project.articles[articleIndex] = newArticle;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return { success: true, article: newArticle, project };
}

// Paginated & Filtered project listing
async function getProjectsPaginated({ page = 1, limit = 12, search = '', ownerId = null, status = 'active' } = {}) {
  const numPage = Math.max(1, parseInt(page, 10) || 1);
  const numLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (numPage - 1) * numLimit;
  const cleanSearch = (search || '').trim().toLowerCase();

  let all = [];
  if (ownerId) {
    all = await getProjectsByOwner(ownerId, status);
  } else {
    // Public directory only shows non-deleted active campaigns
    all = await getAllProjects(status === 'all' || status === 'deleted');
    if (status === 'deleted') {
      all = all.filter(p => p.isDeleted === true);
    } else if (status === 'active') {
      all = all.filter(p => !p.isDeleted);
    }
  }

  // Filter by search query if provided
  if (cleanSearch) {
    all = all.filter(p => {
      const matchCompany = (p.companyName || '').toLowerCase().includes(cleanSearch);
      const matchTopic = Array.isArray(p.topics) && p.topics.some(t => (t || '').toLowerCase().includes(cleanSearch));
      const matchAuthor = p.author && ((p.author.name || '').toLowerCase().includes(cleanSearch) || (p.author.role || '').toLowerCase().includes(cleanSearch));
      return matchCompany || matchTopic || matchAuthor;
    });
  }

  const total = all.length;
  const totalPages = Math.ceil(total / numLimit) || 1;
  const paginated = all.slice(skip, skip + numLimit);

  return {
    projects: paginated,
    pagination: {
      total,
      page: numPage,
      limit: numLimit,
      totalPages
    }
  };
}

module.exports = {
  getAllProjects,
  getProjectById,
  getProjectsByOwner,
  getProjectsPaginated,
  saveProject,
  updateProject,
  updateArticle,
  replaceArticleInProject,
  deleteProject,
  undeleteProject,
  cleanupExpiredProjects,
  getContrastColor,
  adjustBrightness,
  generateMonogramSvg,
  generateAuthorAvatarSvg
};
