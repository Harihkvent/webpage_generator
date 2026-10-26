/**
 * siteStorage.js
 * Persistent project database & site manager with ownership & authorization support
 * Compatible with local disk and Vercel Serverless environment (/tmp)
 */
const fs = require('fs');
const path = require('path');

// Bundled seed database location
const BUNDLED_DATA_FILE = path.join(__dirname, '..', 'data', 'projects.json');

// If running in Vercel serverless, use /tmp which is writable
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'projects.json')
  : BUNDLED_DATA_FILE;

// In-memory cache fallback
let memoryProjects = null;

// Ensure data folder and file exists
function ensureStorage() {
  try {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      if (fs.existsSync(BUNDLED_DATA_FILE)) {
        // Copy bundled initial data
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
function getAllProjects() {
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

// Get single project
function getProjectById(id) {
  const projects = getAllProjects();
  return projects.find(p => p.id === id) || null;
}

// Get projects belonging to a specific user
function getProjectsByOwner(ownerId) {
  const projects = getAllProjects();
  if (!ownerId) return [];
  return projects.filter(p => p.ownerId === ownerId);
}

// Save or update project

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

function saveProject(project) {
  project = sanitizeProjectData(project);
  ensureStorage();
  const projects = getAllProjects();
  const existingIdx = projects.findIndex(p => p.id === project.id);

  if (existingIdx >= 0) {
    projects[existingIdx] = {
      ...projects[existingIdx],
      ...project,
      updatedAt: new Date().toISOString()
    };
  } else {
    projects.unshift({
      ...project,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write to disk, saving to memory:', err.message);
    memoryProjects = projects;
  }

  return project;
}

// Delete project with owner authorization check
function deleteProject(id, requestingUserId = null) {
  ensureStorage();
  let projects = getAllProjects();
  const project = projects.find(p => p.id === id);

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  // Authorization check: if project has an owner, only the owner can delete it
  if (project.ownerId && requestingUserId && project.ownerId !== requestingUserId) {
    return { success: false, error: 'Unauthorized: You can only delete your own hosted sites.' };
  }

  projects = projects.filter(p => p.id !== id);

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    memoryProjects = projects;
  }

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
