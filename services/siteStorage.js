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
async function getAllProjects() {
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const docs = await Project.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return docs.map(doc => {
        const { _id, __v, ...proj } = doc;
        return proj;
      });
    } catch (err) {
      console.warn('[MongoDB] getAllProjects fallback to file:', err.message);
    }
  }

  return getFileProjects();
}

// Get single project
async function getProjectById(id) {
  if (!id) return null;
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const doc = await Project.findOne({ id }).lean();
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
  return projects.find(p => p.id === id) || null;
}

// Get projects belonging to a specific user
async function getProjectsByOwner(ownerId) {
  if (!ownerId) return [];
  await connectDB();
  await syncFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const docs = await Project.find({ ownerId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return docs.map(doc => {
        const { _id, __v, ...proj } = doc;
        return proj;
      });
    } catch (err) {
      console.warn('[MongoDB] getProjectsByOwner fallback to file:', err.message);
    }
  }

  const projects = getFileProjects();
  return projects.filter(p => p.ownerId === ownerId);
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

  if (isDbConnected()) {
    try {
      await Project.findOneAndUpdate(
        { id: project.id },
        { $set: project },
        { upsert: true, new: true, setDefaultsOnInsert: true }
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

// Delete project with owner authorization check
async function deleteProject(id, requestingUserId = null) {
  await connectDB();

  if (isDbConnected()) {
    try {
      const project = await Project.findOne({ id });
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId) {
        return { success: false, error: 'Unauthorized: You can only delete your own hosted sites.' };
      }

      await Project.deleteOne({ id });

      // Keep local file in sync
      const fileProjects = getFileProjects().filter(p => p.id !== id);
      saveFileProjects(fileProjects);

      return { success: true };
    } catch (err) {
      console.warn('[MongoDB] deleteProject error (falling back to file):', err.message);
    }
  }

  // Fallback to local file storage
  let fileProjects = getFileProjects();
  const project = fileProjects.find(p => p.id === id);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId) {
    return { success: false, error: 'Unauthorized: You can only delete your own hosted sites.' };
  }

  fileProjects = fileProjects.filter(p => p.id !== id);
  saveFileProjects(fileProjects);
  return { success: true };
}

module.exports = {
  getAllProjects,
  getProjectById,
  getProjectsByOwner,
  saveProject,
  deleteProject,
  getContrastColor,
  adjustBrightness,
  generateMonogramSvg,
  generateAuthorAvatarSvg
};
