/**
 * server.js
 * Express server for Webpage Generator
 * Hosts both the Studio Portal and all generated 10-page brand websites
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const archiver = require('archiver');

const {
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject,
  generateMonogramSvg
} = require('./services/siteStorage');

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static asset folders
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// -----------------------------------------------------------------------------
// Studio Dashboard Route
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// List all projects (supports multiple use cases)
app.get('/api/projects', (req, res) => {
  try {
    const projects = getAllProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
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
      apiKey = ''
    } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    const cleanTopics = (Array.isArray(topics) ? topics : [])
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .slice(0, 10); // Up to 10 topics

    if (cleanTopics.length === 0) {
      return res.status(400).json({ error: 'At least 1 topic is required (up to 10).' });
    }

    // Determine final logo: provided URL, uploaded base64 data, or generated SVG monogram
    let finalLogo = logoUrl && logoUrl.trim() ? logoUrl.trim() : generateMonogramSvg(companyName, brandColor);

    const projectId = `site-${slugify(companyName)}-${Date.now().toString(36)}`;

    // Generate each 1000-word article
    const generatedArticles = [];
    for (let i = 0; i < cleanTopics.length; i++) {
      const topic = cleanTopics[i];
      const article = await generateArticleWithOptionalLLM(topic, companyName, brandColor, i, {
        provider: llmProvider,
        apiKey
      });
      generatedArticles.push(article);
    }

    const newProject = {
      id: projectId,
      companyName: companyName.trim(),
      brandColor: brandColor.trim(),
      logoUrl: finalLogo,
      topics: cleanTopics,
      articles: generatedArticles,
      createdAt: new Date().toISOString()
    };

    saveProject(newProject);

    res.status(201).json(newProject);
  } catch (err) {
    console.error('Error generating project:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete a project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const success = deleteProject(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export as standalone static ZIP (All 10 pages + hub + CSS)
app.get('/api/projects/:id/export', (req, res) => {
  try {
    const project = getProjectById(req.params.id);
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
    project.articles.forEach((art, idx) => {
      const artHtml = renderArticlePage(project, art);
      archive.append(artHtml, { name: `blog/${art.slug}.html` });
    });

    archive.finalize();
  } catch (err) {
    res.status(500).send('Export error: ' + err.message);
  }
});

// -----------------------------------------------------------------------------
// Hosted Brand Website Routes
// -----------------------------------------------------------------------------

// 1. Hosted Brand Publication Hub (Lists all 10 blog topics)
app.get('/sites/:siteId', (req, res) => {
  try {
    const project = getProjectById(req.params.siteId);
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
app.get('/sites/:siteId/blog/:slug', (req, res) => {
  try {
    const project = getProjectById(req.params.siteId);
    if (!project) {
      return res.status(404).send('Site Not Found');
    }

    const article = project.articles.find(a => a.slug === req.params.slug);
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
// Seed Initial Demo Project if Database is empty
// -----------------------------------------------------------------------------
async function seedDefaultProjectIfEmpty() {
  const existing = getAllProjects();
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

    const articles = [];
    for (let i = 0; i < demoTopics.length; i++) {
      const art = await generateArticleWithOptionalLLM(demoTopics[i], demoCompany, demoColor, i);
      articles.push(art);
    }

    const demoProject = {
      id: `site-apex-cloud-systems-seed`,
      companyName: demoCompany,
      brandColor: demoColor,
      logoUrl: demoLogo,
      topics: demoTopics,
      articles,
      createdAt: new Date().toISOString()
    };

    saveProject(demoProject);
    console.log('Seeded initial demo campaign successfully!');
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(` Webpage Generator Portal running at: http://localhost:${PORT}`);
  console.log(` - Studio Dashboard:   http://localhost:${PORT}`);
  console.log(` - Live Demo Campaign: http://localhost:${PORT}/sites/site-apex-cloud-systems-seed`);
  console.log(`=======================================================`);
  await seedDefaultProjectIfEmpty();
});
