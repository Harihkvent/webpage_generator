/**
 * jobManager.js
 * In-memory Job Queue & Server-Sent Events (SSE) Manager
 * Tracks background generation tasks and streams real-time progress to clients
 */

const crypto = require('crypto');

// Map of jobId -> Job state
const jobs = new Map();

// Auto-cleanup jobs older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo && (!job.listeners || job.listeners.length === 0)) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

/**
 * Create a new tracking job
 */
function createJob(type, meta = {}) {
  const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const job = {
    id,
    type,
    status: 'pending', // pending, in_progress, completed, failed
    progress: 0,
    currentStep: 0,
    totalSteps: meta.totalSteps || 10,
    message: meta.initialMessage || 'Preparing generation task...',
    meta,
    result: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    listeners: []
  };

  jobs.set(id, job);
  return job;
}

/**
 * Get job by ID
 */
function getJob(id) {
  return jobs.get(id) || null;
}

/**
 * Broadcast update to all connected SSE clients
 */
function broadcastJobUpdate(job) {
  if (!job || !job.listeners) return;
  const payload = JSON.stringify({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    message: job.message,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.error
  });

  const deadListeners = [];
  job.listeners.forEach((res, idx) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      deadListeners.push(idx);
    }
  });

  // Remove dead listeners
  if (deadListeners.length > 0) {
    job.listeners = job.listeners.filter((_, idx) => !deadListeners.includes(idx));
  }
}

/**
 * Update job progress
 */
function updateJob(id, updates = {}) {
  const job = jobs.get(id);
  if (!job) return null;

  if (updates.status) job.status = updates.status;
  if (typeof updates.progress === 'number') job.progress = updates.progress;
  if (typeof updates.currentStep === 'number') job.currentStep = updates.currentStep;
  if (typeof updates.totalSteps === 'number') job.totalSteps = updates.totalSteps;
  if (updates.message) job.message = updates.message;
  if (updates.result !== undefined) job.result = updates.result;
  if (updates.error !== undefined) job.error = updates.error;

  job.updatedAt = Date.now();
  broadcastJobUpdate(job);
  return job;
}

/**
 * Complete a job
 */
function completeJob(id, result) {
  const job = jobs.get(id);
  if (!job) return null;

  job.status = 'completed';
  job.progress = 100;
  job.currentStep = job.totalSteps;
  job.message = 'Generation completed successfully!';
  job.result = result;
  job.updatedAt = Date.now();

  broadcastJobUpdate(job);

  // Close all open SSE streams after brief delay
  setTimeout(() => {
    if (job.listeners) {
      job.listeners.forEach(res => {
        try {
          res.end();
        } catch (_) {}
      });
      job.listeners = [];
    }
  }, 1500);

  return job;
}

/**
 * Fail a job
 */
function failJob(id, errorMessage) {
  const job = jobs.get(id);
  if (!job) return null;

  job.status = 'failed';
  job.message = `Generation failed: ${errorMessage}`;
  job.error = errorMessage;
  job.updatedAt = Date.now();

  broadcastJobUpdate(job);

  setTimeout(() => {
    if (job.listeners) {
      job.listeners.forEach(res => {
        try {
          res.end();
        } catch (_) {}
      });
      job.listeners = [];
    }
  }, 1500);

  return job;
}

/**
 * Subscribe an Express response to SSE updates for a job
 */
function subscribeToJob(id, req, res) {
  const job = jobs.get(id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial comment to keep-alive
  res.write(': sse connected\n\n');

  // Send current state
  const payload = JSON.stringify({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    message: job.message,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.error
  });
  res.write(`data: ${payload}\n\n`);

  if (job.status === 'completed' || job.status === 'failed') {
    res.end();
    return;
  }

  job.listeners.push(res);

  // Remove listener on client disconnect
  req.on('close', () => {
    if (job.listeners) {
      job.listeners = job.listeners.filter(r => r !== res);
    }
  });
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  completeJob,
  failJob,
  subscribeToJob
};

