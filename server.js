/**
 * server.js
 * Express server for Webpage Generator
 * Hosts both the Studio Portal and all generated 10-page brand websites
 * Features:
 * - Enterprise Security: Helmet, Rate Limiting & Input Sanitization
 * - Zod Schema Validation on all mutation endpoints
 * - Asynchronous Background Generation with Server-Sent Events (SSE) streaming
 * - Interactive Content Management (Full CRUD on campaigns and articles)
 * - Single-article regeneration without wiping entire site
 * - Ownership & Authorization guardrails
 * - MongoDB Atlas integration with local file fallback
 * - Vercel Serverless Ready
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const archiver = require('archiver');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./services/db');

const {
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
  generateMonogramSvg,
  generateAuthorAvatarSvg
} = require('./services/siteStorage');

const {
  registerUser,
  loginUser,
  getUserByToken,
  logoutUser,
  seedDemoUserIfEmpty
} = require('./services/authService');

const {
  generateArticleWithOptionalLLM,
  slugify
} = require('./services/articleGenerator');

const {
  renderHubPage,
  renderArticlePage
} = require('./services/templateRenderer');

const {
  cleanHtml,
  cleanText,
  signupSchema,
  loginSchema,
  createProjectSchema,
  updateProjectSchema,
  updateArticleSchema,
  validateBody
} = require('./services/validators');

const {
  createJob,
  getJob,
  updateJob,
  completeJob,
  failJob,
  subscribeToJob
} = require('./services/jobManager');

const app = express();
const PORT = process.env.PORT || 5050;

// Initialize MongoDB connection pool
connectDB().catch(err => {
  console.warn('[MongoDB] Initial connection notice:', err.message);
});

// -----------------------------------------------------------------------------
// Security Middleware
// -----------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline SVGs, Google Fonts and Unsplash images
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Campaign generation limit reached for this hour. Please try again later.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/projects', generationLimiter);

// Static asset folders
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// -----------------------------------------------------------------------------
// Auth Extraction Middleware
// -----------------------------------------------------------------------------
async function extractUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      req.user = await getUserByToken(token);
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

app.use(extractUser);

// -----------------------------------------------------------------------------
// Auth Guard Middleware: Only logged-in users can create, edit, delete, or undelete
// -----------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Only logged-in users can create, edit, delete, or undelete campaigns. Please sign in or create an account.'
    });
  }
  next();
}

// -----------------------------------------------------------------------------
// Studio Dashboard Route
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// -----------------------------------------------------------------------------
// API Endpoints: Auth
// -----------------------------------------------------------------------------

// Sign up new user with Zod validation
app.post('/api/auth/signup', validateBody(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.validatedBody;
    const result = await registerUser({ name: cleanText(name), email: cleanText(email), password });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Log in existing user with Zod validation
app.post('/api/auth/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;
    const result = await loginUser(cleanText(email), password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Get currently logged in user
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// Log out user
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await logoutUser(authHeader.substring(7).trim());
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// API Endpoints: System Config
// -----------------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasMongoDB: Boolean(process.env.MONGODB_URI),
    isVercel: Boolean(process.env.VERCEL)
  });
});

// -----------------------------------------------------------------------------
// API Endpoints: Jobs & Real-Time SSE Progress
// -----------------------------------------------------------------------------

// SSE stream for real-time generation progress
app.get('/api/jobs/:jobId/stream', (req, res) => {
  subscribeToJob(req.params.jobId, req, res);
});

// Poll job status
app.get('/api/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    message: job.message,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.error
  });
});

// -----------------------------------------------------------------------------
// API Endpoints: Projects (Hosted Sites)
// -----------------------------------------------------------------------------

// List projects (supports pagination, search, status, ?mine=true filter, and attaches isOwner flag)
app.get('/api/projects', async (req, res, next) => {
  try {
    const onlyMine = req.query.mine === 'true';
    const currentUserId = req.user ? req.user.id : null;
    const search = req.query.search || '';
    const page = req.query.page;
    const limit = req.query.limit;
    const status = req.query.status || (req.query.trash === 'true' ? 'deleted' : 'active');

    // If neither page nor search is explicitly set and all=true requested, return plain array for legacy compatibility
    if (!page && !search && req.query.all === 'true') {
      let projects;
      if (onlyMine && currentUserId) {
        projects = await getProjectsByOwner(currentUserId, status);
      } else {
        projects = await getAllProjects(status === 'all' || status === 'deleted');
        if (status === 'deleted') projects = projects.filter(p => p.isDeleted);
        else if (status === 'active') projects = projects.filter(p => !p.isDeleted);
      }

      const projectsWithPerms = projects.map(p => ({
        ...p,
        isOwner: Boolean(currentUserId && p.ownerId === currentUserId)
      }));
      return res.json(projectsWithPerms);
    }

    const result = await getProjectsPaginated({
      page: page || 1,
      limit: limit || 12,
      search,
      ownerId: onlyMine ? currentUserId : null,
      status
    });

    const projectsWithPerms = result.projects.map(p => ({
      ...p,
      isOwner: Boolean(currentUserId && p.ownerId === currentUserId)
    }));

    // Attach pagination headers and return enriched structure
    res.json({
      projects: projectsWithPerms,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
});

// Get single project
app.get('/api/projects/:id', async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const currentUserId = req.user ? req.user.id : null;
    res.json({
      ...project,
      isOwner: Boolean(currentUserId && project.ownerId === currentUserId)
    });
  } catch (err) {
    next(err);
  }
});

// Create and generate 10 hosted pages for a new campaign (Only Logged-in Users Can Create)
app.post('/api/projects', requireAuth, validateBody(createProjectSchema), async (req, res, next) => {
  try {
    const {
      companyName,
      brandColor = '#6366F1',
      logoUrl = '',
      topics = [],
      llmProvider = 'builtin',
      apiKey = '',
      authorName = '',
      authorRole = '',
      authorBio = '',
      authorAvatar = ''
    } = req.validatedBody;

    const cleanTopics = topics.map(t => cleanText(t)).filter(Boolean).slice(0, 10);
    if (cleanTopics.length === 0) {
      return res.status(400).json({ error: 'At least 1 topic is required (up to 10).' });
    }

    const finalLogo = logoUrl && logoUrl.trim()
      ? logoUrl.trim()
      : generateMonogramSvg(companyName, brandColor);

    const effectiveAuthorName = authorName && authorName.trim()
      ? cleanText(authorName)
      : (req.user ? req.user.name : `${companyName.trim()} Editorial Team`);

    const effectiveAuthorRole = authorRole && authorRole.trim()
      ? cleanText(authorRole)
      : 'Research & Strategy Contributor';

    const effectiveAuthorAvatar = authorAvatar && authorAvatar.trim()
      ? authorAvatar.trim()
      : generateAuthorAvatarSvg(effectiveAuthorName, brandColor);

    const effectiveAuthorBio = authorBio && authorBio.trim()
      ? cleanText(authorBio)
      : `Authoritative intelligence and strategic insights published by ${companyName.trim()}.`;

    const authorProfile = {
      name: effectiveAuthorName,
      role: effectiveAuthorRole,
      avatar: effectiveAuthorAvatar,
      bio: effectiveAuthorBio
    };

    const projectId = `site-${slugify(companyName)}-${Date.now().toString(36)}`;
    const currentUserId = req.user.id;
    const currentUserName = req.user.name;
    const currentUserEmail = req.user.email;

    // Non-permanent campaign lifecycle: expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Check if synchronous execution is specifically requested
    const isSync = req.query.sync === 'true';

    if (isSync) {
      const generatedArticles = [];
      for (let i = 0; i < cleanTopics.length; i++) {
        const topic = cleanTopics[i];
        const article = await generateArticleWithOptionalLLM(
          topic,
          companyName,
          brandColor,
          i,
          { provider: llmProvider, apiKey },
          authorProfile
        );
        generatedArticles.push(article);
      }

      const newProject = {
        id: projectId,
        companyName: companyName.trim(),
        brandColor: brandColor.trim(),
        logoUrl: finalLogo,
        topics: cleanTopics,
        articles: generatedArticles,
        author: authorProfile,
        ownerId: currentUserId,
        ownerName: currentUserName,
        ownerEmail: currentUserEmail,
        isPermanent: false,
        expiresAt,
        isDeleted: false,
        createdAt: new Date().toISOString()
      };

      await saveProject(newProject);
      return res.status(201).json(newProject);
    }

    // Default: Asynchronous background generation with SSE job tracker
    const job = createJob('generate_project', {
      totalSteps: cleanTopics.length,
      initialMessage: `Initializing campaign for "${companyName}"...`
    });

    // Respond immediately with 202 Accepted and Job ID
    res.status(202).json({
      success: true,
      jobId: job.id,
      message: 'Generation started in background'
    });

    // Run async generation task
    (async () => {
      try {
        updateJob(job.id, {
          status: 'in_progress',
          progress: 5,
          message: `Setting up brand identity and styling...`
        });

        const generatedArticles = [];
        for (let i = 0; i < cleanTopics.length; i++) {
          const topic = cleanTopics[i];
          const pct = Math.round(10 + (i / cleanTopics.length) * 80);

          updateJob(job.id, {
            currentStep: i + 1,
            progress: pct,
            message: `Generating topic ${i + 1}/${cleanTopics.length}: "${topic}"...`
          });

          const article = await generateArticleWithOptionalLLM(
            topic,
            companyName,
            brandColor,
            i,
            { provider: llmProvider, apiKey },
            authorProfile
          );
          generatedArticles.push(article);
        }

        updateJob(job.id, {
          progress: 95,
          message: 'Saving hosted campaign and building navigation index...'
        });

        const newProject = {
          id: projectId,
          companyName: companyName.trim(),
          brandColor: brandColor.trim(),
          logoUrl: finalLogo,
          topics: cleanTopics,
          articles: generatedArticles,
          author: authorProfile,
          ownerId: currentUserId,
          ownerName: currentUserName,
          ownerEmail: currentUserEmail,
          isPermanent: false,
          expiresAt,
          isDeleted: false,
          createdAt: new Date().toISOString()
        };

        await saveProject(newProject);
        completeJob(job.id, newProject);
      } catch (err) {
        console.error('[Async Generation Error]:', err);
        failJob(job.id, err.message || 'Internal generation error');
      }
    })();
  } catch (err) {
    next(err);
  }
});

// Update Project Branding & Metadata (PUT - Only Logged-in Owner)
app.put('/api/projects/:id', requireAuth, validateBody(updateProjectSchema), async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await updateProject(req.params.id, req.validatedBody, currentUserId);
    if (!result.success) {
      return res.status(result.error.includes('Unauthorized') ? 403 : 404).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Update an individual article (PUT - Only Logged-in Owner)
app.put('/api/projects/:id/articles/:slug', requireAuth, validateBody(updateArticleSchema), async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await updateArticle(req.params.id, req.params.slug, req.validatedBody, currentUserId);
    if (!result.success) {
      return res.status(result.error.includes('Unauthorized') ? 403 : 404).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Regenerate a single article in a campaign (POST - Only Logged-in Owner)
app.post('/api/projects/:id/articles/:slug/regenerate', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.ownerId && project.ownerId !== currentUserId && project.ownerId !== 'usr_demo_creator') {
      return res.status(403).json({ error: 'Unauthorized: You can only regenerate articles on your own sites.' });
    }

    const articleIndex = (project.articles || []).findIndex(a => a.slug === req.params.slug);
    if (articleIndex === -1) return res.status(404).json({ error: 'Article not found' });

    const existingArticle = project.articles[articleIndex];
    const topicTitle = existingArticle.topic || existingArticle.title || project.topics[articleIndex] || 'Featured Topic';

    const { llmProvider = 'builtin', apiKey = '' } = req.body || {};

    const freshArticle = await generateArticleWithOptionalLLM(
      topicTitle,
      project.companyName,
      project.brandColor,
      articleIndex,
      { provider: llmProvider, apiKey },
      project.author
    );

    freshArticle.slug = existingArticle.slug;

    const result = await replaceArticleInProject(req.params.id, req.params.slug, freshArticle, currentUserId);
    res.json({ success: true, article: freshArticle, project: result.project });
  } catch (err) {
    next(err);
  }
});

// Delete a project (DELETE - Soft delete with owner authorization)
app.delete('/api/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await deleteProject(req.params.id, currentUserId);
    if (!result.success) {
      return res.status(result.error.includes('Unauthorized') ? 403 : 400).json({ error: result.error });
    }

    res.json({ success: true, message: result.message || 'Hosted site moved to trash' });
  } catch (err) {
    next(err);
  }
});

// Undelete / Restore a soft-deleted project (POST - Only Logged-in Owner)
app.post('/api/projects/:id/undelete', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await undeleteProject(req.params.id, currentUserId);
    if (!result.success) {
      return res.status(result.error.includes('Unauthorized') ? 403 : 400).json({ error: result.error });
    }

    res.json({ success: true, message: result.message || 'Hosted site restored successfully', project: result.project });
  } catch (err) {
    next(err);
  }
});

// Export as standalone static ZIP (All 10 pages + hub + CSS)
app.get('/api/projects/:id/export', async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).send('Project not found');

    res.attachment(`${project.id}-standalone-website.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Add Hub index.html
    const hubHtml = renderHubPage(project);
    archive.append(hubHtml, { name: 'index.html' });

    // Add CSS
    const blogCssPath = path.join(__dirname, 'public', 'css', 'blog-theme.css');
    if (fs.existsSync(blogCssPath)) {
      archive.file(blogCssPath, { name: 'css/blog-theme.css' });
    }

    // Add JS
    const blogJsPath = path.join(__dirname, 'public', 'js', 'blog.js');
    if (fs.existsSync(blogJsPath)) {
      archive.file(blogJsPath, { name: 'js/blog.js' });
    }

    // Add all 10 articles as standalone HTML files
    project.articles.forEach((art) => {
      const artHtml = renderArticlePage(project, art);
      archive.append(artHtml, { name: `blog/${art.slug}.html` });
    });

    archive.finalize();
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Hosted Brand Website Routes (Public Read Access)
// -----------------------------------------------------------------------------

// 1. Hosted Brand Publication Hub (Lists all 10 blog topics)
app.get('/sites/:siteId', async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.siteId);
    if (!project) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Site Not Found</title><link rel="stylesheet" href="/css/blog-theme.css"></head>
        <body style="font-family:sans-serif; text-align:center; padding:80px 20px;">
          <h2>Campaign or Site Not Found</h2>
          <p>The requested hosted site could not be found or has been removed.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#6366f1; color:#fff; border-radius:6px; text-decoration:none;">Go to Webpage Generator Studio</a>
        </body></html>
      `);
    }

    const html = renderHubPage(project);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// 2. Individual Dedicated 1000-Word Hosted Blog Post
app.get('/sites/:siteId/blog/:slug', async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.siteId);
    if (!project) {
      return res.status(404).send('Site Not Found');
    }

    const article = (project.articles || []).find(a => a.slug === req.params.slug);
    if (!article) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Article Not Found</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:80px 20px;">
          <h2>Topic Article Not Found</h2>
          <p>This specific topic page does not exist in this campaign.</p>
          <a href="/sites/${project.id}" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#6366f1; color:#fff; border-radius:6px; text-decoration:none;">Back to All 10 Pages</a>
        </body></html>
      `);
    }

    const html = renderArticlePage(project, article);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Centralized Error Handler Middleware
// -----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[Unhandled API Error]:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'An unexpected server error occurred',
    status
  });
});

// -----------------------------------------------------------------------------
// Seed Initial Demo Project & User if Database is empty
// -----------------------------------------------------------------------------
async function seedDefaultProjectIfEmpty() {
  await seedDemoUserIfEmpty();
  const existing = await getAllProjects();
  if (existing.length === 0) {
    console.log('Seeding initial demo campaign: Apex Cloud Systems (10 hosted pages)...');
    const demoTopics = [
      'Microservices Orchestration in Enterprise Cloud Architectures',
      'Autonomous AI Agents and the Future of DevOps Pipelines',
      'Zero-Trust Security Protocols for Distributed Engineering Teams',
      'Optimizing Cloud Infrastructure Costs without Sacrificing Velocity',
      'Event-Driven Architectures with Kafka and Modern Message Brokers',
      'Continuous Delivery at Scale: Lessons from 10,000 Production Deploys',
      'Observability and OpenTelemetry: Beyond Traditional Metrics',
      'Serverless vs Kubernetes: Making the Right Architectural Tradeoff',
      'Automated Incident Response: Reducing Mean Time to Resolution',
      'Engineering High-Reliability APIs for Mission-Critical Workflows'
    ];

    const demoCompany = 'Apex Cloud Systems';
    const demoColor = '#6366F1';
    const demoLogo = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&h=120&q=80';

    const authorProfile = {
      name: 'Apex Editorial Board',
      role: 'Cloud Systems Architecture Contributor',
      avatar: generateAuthorAvatarSvg('Apex Editorial Board', demoColor),
      bio: 'Authoritative research, benchmarks, and cloud architectural frameworks published by Apex Cloud Systems.'
    };

    const articles = [];
    for (let i = 0; i < demoTopics.length; i++) {
      const art = await generateArticleWithOptionalLLM(
        demoTopics[i],
        demoCompany,
        demoColor,
        i,
        {},
        authorProfile
      );
      articles.push(art);
    }

    const demoProject = {
      id: 'site-apex-cloud-systems-seed',
      companyName: demoCompany,
      brandColor: demoColor,
      logoUrl: demoLogo,
      topics: demoTopics,
      articles,
      author: authorProfile,
      ownerId: 'usr_demo_creator',
      ownerName: 'Demo Creator',
      ownerEmail: 'demo@webpagegenerator.com',
      isPermanent: true,
      expiresAt: null,
      isDeleted: false,
      createdAt: new Date().toISOString()
    };

    await saveProject(demoProject);
    console.log('Seeded initial demo campaign successfully!');
  }
}

// Background cleanup: auto-purge expired non-permanent campaigns and 24h+ trash
setInterval(() => {
  cleanupExpiredProjects();
}, 15 * 60 * 1000);

// Start Server (when run locally, not inside Vercel serverless function)
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(` Webpage Generator Portal running at: http://localhost:${PORT}`);
    console.log(` - Studio Dashboard:   http://localhost:${PORT}`);
    console.log(` - Live Demo Campaign: http://localhost:${PORT}/sites/site-apex-cloud-systems-seed`);
    console.log(` - Gemini API Key:     ${Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'Configured in .env' : 'Not set (using built-in 1000-word engine)'}`);
    console.log(` - Database:           ${Boolean(process.env.MONGODB_URI) ? 'MongoDB Atlas (Connected)' : 'Local File Fallback (/data)'}`);
    console.log(` - Auth & Security:    Helmet, Rate Limiting, Zod Validation, Ownership Guardrails`);
    console.log(` - Real-Time Engine:   Async Job Tracker + Server-Sent Events (SSE)`);
    console.log(` - Expiration Policy:  Non-permanent 24-hour TTL with soft-delete undelete`);
    console.log(`=======================================================`);
    await seedDefaultProjectIfEmpty();
    await cleanupExpiredProjects();
  });
}

module.exports = app;
