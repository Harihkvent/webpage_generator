/**
 * server.js
 * Express server for Webpage Generator
 * Hosts both the Studio Portal and all generated 10-page brand websites
 * Features:
 * - Authentication & Authorization (Only owners can delete/modify their sites)
 * - Authentic Author Management (Zero fake people data)
 * - Zero Emojis (Clean SVG vector icons throughout)
 * - MongoDB Atlas integration with local file fallback
 * - Vercel Serverless Ready
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const archiver = require('archiver');

const { connectDB } = require('./services/db');

const {
  getAllProjects,
  getProjectById,
  getProjectsByOwner,
  saveProject,
  deleteProject,
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

const app = express();
const PORT = process.env.PORT || 5050;

// Initialize MongoDB connection pool
connectDB().catch(err => {
  console.warn('[MongoDB] Initial connection notice:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static asset folders
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// -----------------------------------------------------------------------------
// Auth Middleware
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
// Studio Dashboard Route
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// -----------------------------------------------------------------------------
// API Endpoints: Auth
// -----------------------------------------------------------------------------

// Sign up new user
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await registerUser({ name, email, password });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Log in existing user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
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
// API Endpoints: Projects (Hosted Sites)
// -----------------------------------------------------------------------------

// List all projects (supports ?mine=true filter and attaches isOwner flag)
app.get('/api/projects', async (req, res) => {
  try {
    const onlyMine = req.query.mine === 'true';
    const currentUserId = req.user ? req.user.id : null;

    let projects;
    if (onlyMine && currentUserId) {
      projects = await getProjectsByOwner(currentUserId);
    } else {
      projects = await getAllProjects();
    }

    // Attach ownership status relative to requesting user
    const projectsWithPerms = projects.map(p => ({
      ...p,
      isOwner: Boolean(currentUserId && p.ownerId === currentUserId) || (!p.ownerId && !currentUserId)
    }));

    res.json(projectsWithPerms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const currentUserId = req.user ? req.user.id : null;
    res.json({
      ...project,
      isOwner: Boolean(currentUserId && project.ownerId === currentUserId)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create and generate 10 hosted pages for a new campaign
app.post('/api/projects', async (req, res) => {
  try {
    const {
      companyName,
      brandColor = '#6366F1',
      logoUrl,
      topics = [],
      llmProvider = 'builtin',
      apiKey = '',
      // Real author inputs (no fake personas)
      authorName = '',
      authorRole = '',
      authorBio = '',
      authorAvatar = ''
    } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    const cleanTopics = (Array.isArray(topics) ? topics : [])
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .slice(0, 10);

    if (cleanTopics.length === 0) {
      return res.status(400).json({ error: 'At least 1 topic is required (up to 10).' });
    }

    // Determine final logo: provided URL, uploaded base64 data, or generated SVG monogram
    const finalLogo = logoUrl && logoUrl.trim() 
      ? logoUrl.trim() 
      : generateMonogramSvg(companyName, brandColor);

    // Build real author profile (strictly user-defined or clean company fallback)
    const effectiveAuthorName = authorName && authorName.trim()
      ? authorName.trim()
      : (req.user ? req.user.name : `${companyName.trim()} Editorial Team`);

    const effectiveAuthorRole = authorRole && authorRole.trim()
      ? authorRole.trim()
      : 'Research & Strategy Contributor';

    const effectiveAuthorAvatar = authorAvatar && authorAvatar.trim()
      ? authorAvatar.trim()
      : generateAuthorAvatarSvg(effectiveAuthorName, brandColor);

    const effectiveAuthorBio = authorBio && authorBio.trim()
      ? authorBio.trim()
      : `Authoritative intelligence and strategic insights published by ${companyName.trim()}.`;

    const authorProfile = {
      name: effectiveAuthorName,
      role: effectiveAuthorRole,
      avatar: effectiveAuthorAvatar,
      bio: effectiveAuthorBio
    };

    const projectId = `site-${slugify(companyName)}-${Date.now().toString(36)}`;

    // Generate each 1000-word article with authentic author details
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
      // Record owner for authorization checks
      ownerId: req.user ? req.user.id : 'usr_demo_creator',
      ownerName: req.user ? req.user.name : 'Guest Creator',
      ownerEmail: req.user ? req.user.email : 'demo@webpagegenerator.com',
      createdAt: new Date().toISOString()
    };

    await saveProject(newProject);

    res.status(201).json(newProject);
  } catch (err) {
    console.error('Error generating project:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete a project (enforces authorization: only the owner can delete their site)
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const project = await getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If project has an assigned owner, enforce ownership
    if (project.ownerId && project.ownerId !== 'usr_demo_creator') {
      if (!currentUserId || project.ownerId !== currentUserId) {
        return res.status(403).json({
          error: 'Unauthorized: You can only delete sites you created.'
        });
      }
    }

    const result = await deleteProject(req.params.id, currentUserId);
    if (!result.success) {
      return res.status(403).json({ error: result.error || 'Failed to delete' });
    }

    res.json({ success: true, message: 'Hosted site deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export as standalone static ZIP (All 10 pages + hub + CSS)
app.get('/api/projects/:id/export', async (req, res) => {
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
    res.status(500).send('Export error: ' + err.message);
  }
});

// -----------------------------------------------------------------------------
// Hosted Brand Website Routes (Public Read Access)
// -----------------------------------------------------------------------------

// 1. Hosted Brand Publication Hub (Lists all 10 blog topics)
app.get('/sites/:siteId', async (req, res) => {
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
    res.status(500).send('Server Error: ' + err.message);
  }
});

// 2. Individual Dedicated 1000-Word Hosted Blog Post
app.get('/sites/:siteId/blog/:slug', async (req, res) => {
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
    res.status(500).send('Server Error: ' + err.message);
  }
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
      createdAt: new Date().toISOString()
    };

    await saveProject(demoProject);
    console.log('Seeded initial demo campaign successfully!');
  }
}

// Start Server (when run locally, not inside Vercel serverless function)
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(` Webpage Generator Portal running at: http://localhost:${PORT}`);
    console.log(` - Studio Dashboard:   http://localhost:${PORT}`);
    console.log(` - Live Demo Campaign: http://localhost:${PORT}/sites/site-apex-cloud-systems-seed`);
    console.log(` - Gemini API Key:     ${Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'Configured in .env' : 'Not set (using built-in 1000-word engine)'}`);
    console.log(` - Database:           ${Boolean(process.env.MONGODB_URI) ? 'MongoDB Atlas (Connected)' : 'Local File Fallback (/data)'}`);
    console.log(` - Auth System:        Enabled (Email/Password, Tokens & Ownership)`);
    console.log(`=======================================================`);
    await seedDefaultProjectIfEmpty();
  });
}

module.exports = app;
