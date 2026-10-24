/**
 * siteStorage.js
 * Persistent project database & site manager
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DATA_FILE = path.join(__dirname, '..', 'data', 'projects.json');

// Ensure data folder and file exists
function ensureStorage() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
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

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${encodeURIComponent(brandColor)}"/><stop offset="100%" stop-color="${encodeURIComponent(adjustBrightness(brandColor, -25))}"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(%23g)"/><text x="60" y="73" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-weight="800" font-size="44" fill="${contrast}" text-anchor="middle">${initials}</text></svg>`;
}

// Read all projects
function getAllProjects() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading projects.json:', err);
    return [];
  }
}

// Get single project
function getProjectById(id) {
  const projects = getAllProjects();
  return projects.find(p => p.id === id) || null;
}

// Save or update project
function saveProject(project) {
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

  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  return project;
}

// Delete project
function deleteProject(id) {
  ensureStorage();
  let projects = getAllProjects();
  projects = projects.filter(p => p.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  return true;
}

module.exports = {
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject,
  getContrastColor,
  adjustBrightness,
  generateMonogramSvg
};
