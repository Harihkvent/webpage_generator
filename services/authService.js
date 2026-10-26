/**
 * authService.js
 * Secure authentication and authorization service
 * Supports MongoDB Atlas (User & Session collections) with fallback to local disk and in-memory
 * Uses Node.js native crypto for PBKDF2 hashing
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connectDB, isDbConnected } = require('./db');
const User = require('../models/User');
const Session = require('../models/Session');

const BUNDLED_USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const USERS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'users.json')
  : BUNDLED_USERS_FILE;

// In-memory sessions store fallback: token -> { userId, expiresAt }
const activeSessions = new Map();

// In-memory fallback for users if disk write fails
let memoryUsers = null;
let migratedUsers = false;

// Ensure local fallback file exists
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

function getFileUsers() {
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

function saveFileUsers(users) {
  ensureStorage();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Auth] Could not write users to disk, storing in memory:', err.message);
    memoryUsers = users;
  }
}

// Migrate initial users to MongoDB Atlas if database is empty
async function syncUsersFromLocalIfEmpty() {
  if (migratedUsers) return;
  try {
    if (isDbConnected()) {
      const count = await User.countDocuments();
      if (count === 0) {
        const fileUsers = getFileUsers();
        if (fileUsers.length > 0) {
          console.log(`[MongoDB] Migrating ${fileUsers.length} existing users from JSON to MongoDB Atlas...`);
          await User.insertMany(fileUsers, { ordered: false });
          console.log('[MongoDB] Migration of users complete!');
        }
      }
      migratedUsers = true;
    }
  } catch (err) {
    console.warn('[MongoDB] Sync users warning:', err.message);
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

// Sanitize user object (omit password hash & salt)
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, _id, __v, ...safeUser } = user;
  return safeUser;
}

// Create new session token (valid for 30 days)
async function createSession(userId) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (isDbConnected()) {
    try {
      await Session.create({ token, userId, expiresAt });
    } catch (err) {
      console.warn('[MongoDB] createSession fallback to memory:', err.message);
    }
  }

  activeSessions.set(token, { userId, expiresAt: expiresAt.getTime() });
  return token;
}

// Register new user
async function registerUser({ name, email, password }) {
  if (!email || !password || !name) {
    throw new Error('Name, email, and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  await connectDB();
  await syncUsersFromLocalIfEmpty();

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'usr_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
    name: name.trim(),
    email: cleanEmail,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  if (isDbConnected()) {
    try {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        throw new Error('An account with this email already exists. Please log in.');
      }

      await User.create(newUser);
      const token = await createSession(newUser.id);
      return {
        token,
        user: sanitizeUser(newUser)
      };
    } catch (err) {
      if (err.message && err.message.includes('already exists')) throw err;
      console.warn('[MongoDB] registerUser error, falling back to file:', err.message);
    }
  }

  // Fallback to file storage
  const users = getFileUsers();
  if (users.some(u => u.email === cleanEmail)) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  users.push(newUser);
  saveFileUsers(users);

  const token = await createSession(newUser.id);
  return {
    token,
    user: sanitizeUser(newUser)
  };
}

// Authenticate user
async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();
  await connectDB();
  await syncUsersFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const userDoc = await User.findOne({ email: cleanEmail }).lean();
      if (!userDoc || !verifyPassword(password, userDoc.passwordHash, userDoc.salt)) {
        throw new Error('Invalid email or password');
      }

      const token = await createSession(userDoc.id);
      return {
        token,
        user: sanitizeUser(userDoc)
      };
    } catch (err) {
      if (err.message === 'Invalid email or password') throw err;
      console.warn('[MongoDB] loginUser error, falling back to file:', err.message);
    }
  }

  // Fallback to file storage
  const users = getFileUsers();
  const user = users.find(u => u.email === cleanEmail);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    throw new Error('Invalid email or password');
  }

  const token = await createSession(user.id);
  return {
    token,
    user: sanitizeUser(user)
  };
}

// Look up user by session token
async function getUserByToken(token) {
  if (!token) return null;
  await connectDB();

  if (isDbConnected()) {
    try {
      const session = await Session.findOne({ token }).lean();
      if (session) {
        if (new Date() > new Date(session.expiresAt)) {
          await Session.deleteOne({ token });
          return null;
        }
        const user = await User.findOne({ id: session.userId }).lean();
        return user ? sanitizeUser(user) : null;
      }
    } catch (err) {
      console.warn('[MongoDB] getUserByToken error, falling back to memory:', err.message);
    }
  }

  // Fallback to in-memory session store
  const memSession = activeSessions.get(token);
  if (!memSession) return null;

  if (Date.now() > memSession.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  const users = getFileUsers();
  const user = users.find(u => u.id === memSession.userId);
  return user ? sanitizeUser(user) : null;
}

// Invalidate session
async function logoutUser(token) {
  if (token) {
    activeSessions.delete(token);
    if (isDbConnected()) {
      try {
        await Session.deleteOne({ token });
      } catch (err) {
        console.warn('[MongoDB] logoutUser error:', err.message);
      }
    }
  }
  return true;
}

// Seed default demo creator if empty
async function seedDemoUserIfEmpty() {
  await connectDB();
  await syncUsersFromLocalIfEmpty();

  if (isDbConnected()) {
    try {
      const count = await User.countDocuments();
      if (count === 0) {
        const { hash, salt } = hashPassword('Demo1234!');
        const demoUser = {
          id: 'usr_demo_creator',
          name: 'Demo Creator',
          email: 'demo@webpagegenerator.com',
          passwordHash: hash,
          salt,
          createdAt: new Date().toISOString()
        };
        await User.create(demoUser);
        console.log('[MongoDB] Seeded demo creator user in MongoDB Atlas');
      }
      return;
    } catch (err) {
      console.warn('[MongoDB] seedDemoUserIfEmpty error:', err.message);
    }
  }

  const users = getFileUsers();
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
    saveFileUsers(users);
    console.log('[Auth] Seeded demo creator user (demo@webpagegenerator.com)');
  }
}

module.exports = {
  registerUser,
  loginUser,
  createSession,
  getUserByToken,
  logoutUser,
  seedDemoUserIfEmpty,
  sanitizeUser
};
