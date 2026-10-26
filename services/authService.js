/**
 * authService.js
 * Lightweight, secure authentication and authorization service
 * Uses Node.js native crypto for zero-dependency PBKDF2 hashing
 * Compatible with local disk and Vercel serverless (/tmp)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUNDLED_USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const USERS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'users.json')
  : BUNDLED_USERS_FILE;

// In-memory sessions store: token -> { userId, expiresAt }
const activeSessions = new Map();

// In-memory fallback for users if disk write fails
let memoryUsers = null;

function ensureStorage() {
  try {
    const dataDir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      if (fs.existsSync(BUNDLED_USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, fs.readFileSync(BUNDLED_USERS_FILE, 'utf8'), 'utf8');
      } else {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.warn('[Auth] Storage warning, using memory fallback:', err.message);
    if (!memoryUsers) memoryUsers = [];
  }
}

function getAllUsers() {
  ensureStorage();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Auth] Error reading users.json:', err.message);
  }
  return memoryUsers || [];
}

function saveUsers(users) {
  ensureStorage();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Auth] Could not write users to disk, storing in memory:', err.message);
    memoryUsers = users;
  }
}

// Hash password with salt using PBKDF2
function hashPassword(password, salt = null) {
  const currentSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, currentSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: currentSalt };
}

// Verify password
function verifyPassword(password, hash, salt) {
  const { hash: computedHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}

// Register new user
function registerUser({ name, email, password }) {
  if (!email || !password || !name) {
    throw new Error('Name, email, and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getAllUsers();

  if (users.some(u => u.email === cleanEmail)) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'usr_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
    name: name.trim(),
    email: cleanEmail,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  // Auto-generate session token
  const token = createSession(newUser.id);

  return {
    token,
    user: sanitizeUser(newUser)
  };
}

// Authenticate user
function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getAllUsers();
  const user = users.find(u => u.email === cleanEmail);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    throw new Error('Invalid email or password');
  }

  const token = createSession(user.id);

  return {
    token,
    user: sanitizeUser(user)
  };
}

// Create new session token (valid for 30 days)
function createSession(userId) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  activeSessions.set(token, { userId, expiresAt });
  return token;
}

// Look up user by session token
function getUserByToken(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  const users = getAllUsers();
  const user = users.find(u => u.id === session.userId);
  return user ? sanitizeUser(user) : null;
}

// Invalidate session
function logoutUser(token) {
  if (token) {
    activeSessions.delete(token);
  }
  return true;
}

// Sanitize user object (omit password hash & salt)
function sanitizeUser(user) {
  const { passwordHash, salt, ...safeUser } = user;
  return safeUser;
}

// Seed default demo creator if empty
function seedDemoUserIfEmpty() {
  const users = getAllUsers();
  if (users.length === 0) {
    const { hash, salt } = hashPassword('Demo1234!');
    const demoUser = {
      id: 'usr_demo_creator',
      name: 'Demo Creator',
      email: 'demo@webpagegenerator.com',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };
    users.push(demoUser);
    saveUsers(users);
    console.log('[Auth] Seeded demo creator user (demo@webpagegenerator.com)');
  }
}

module.exports = {
  registerUser,
  loginUser,
  createSession,
  getUserByToken,
  logoutUser,
  seedDemoUserIfEmpty
};
