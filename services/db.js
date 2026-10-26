/**
 * db.js
 * MongoDB Atlas connection manager with serverless connection pooling
 * Compatible with local Express server and Vercel Serverless Functions
 */

const mongoose = require('mongoose');

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

/**
 * Connect to MongoDB Atlas or return cached connection
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: process.env.MONGODB_DB || 'webpage_generator',
      serverSelectionTimeoutMS: 4000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log(`[MongoDB] Connected successfully to database: "${mongooseInstance.connection.name}"`);
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      console.warn('[MongoDB] Connection notice: Unable to connect to MongoDB Atlas cluster.');
      console.warn('           Tip: In MongoDB Atlas -> Network Access, ensure 0.0.0.0/0 (or your current IP) is added.');
      console.warn('           Falling back to local data storage.');
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    return null;
  }
}

/**
 * Check if MongoDB connection is currently active
 */
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isDbConnected
};
