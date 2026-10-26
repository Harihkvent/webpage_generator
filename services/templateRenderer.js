/**
 * templateRenderer.js
 * Renders HTML for:
 * 1. Branded Blog Hub (/sites/:siteId)
 * 2. Dedicated 1000-Word Hosted Blog Post (/sites/:siteId/blog/:slug)
 * Uses clean SVG icons (no emojis), authentic author profiles, and consistent brand styling
 */

const { getContrastColor, adjustBrightness } = require('./siteStorage');

// Helper to escape HTML characters

/**
 * Safely encode and sanitize SVG Data URIs to Base64 to prevent attribute quote escaping bugs
 */
function safeAvatarUrl(url, name = 'Author', color = '#6366F1') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    const initials = (name || 'ED').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'ED';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="' + color + '" stroke="#ffffff" stroke-width="2"/><text x="40" y="49" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-weight="700" font-size="26" fill="#ffffff" text-anchor="middle">' + initials + '</text></svg>';
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/svg+xml;utf8,') || (trimmed.startsWith('data:image/svg+xml') && trimmed.includes('<svg'))) {
    const svgContent = trimmed.replace(/^data:image\/svg\+xml(;utf8)?,?/, '');
    return 'data:image/svg+xml;base64,' + Buffer.from(svgContent, 'utf8').toString('base64');
  }
  return trimmed;
}

function safeLogoUrl(url, company = 'Company', color = '#6366F1') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    const initials = (company || 'CO').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'CO';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="' + color + '"/><text x="60" y="73" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-weight="800" font-size="44" fill="#ffffff" text-anchor="middle">' + initials + '</text></svg>';
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/svg+xml;utf8,') || (trimmed.startsWith('data:image/svg+xml') && trimmed.includes('<svg'))) {
    const svgContent = trimmed.replace(/^data:image\/svg\+xml(;utf8)?,?/, '');
    return 'data:image/svg+xml;base64,' + Buffer.from(svgContent, 'utf8').toString('base64');
  }
  return trimmed;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Common Brand CSS styles injected dynamically
 */
function getBrandCssVariables(brandColor) {
  const contrast = getContrastColor(brandColor);
  const hoverColor = adjustBrightness(brandColor, -15);
  const lightColor = adjustBrightness(brandColor, 40);
  const softBg = `${brandColor}12`;
  const borderTint = `${brandColor}33`;
  const shadowTint = `${brandColor}40`;

  return `
    :root {
      --brand-color: ${brandColor};
      --brand-contrast: ${contrast};
      --brand-hover: ${hoverColor};
      --brand-light: ${lightColor};
      --brand-soft-bg: ${softBg};
      --brand-border: ${borderTint};
      --brand-shadow: ${shadowTint};
    }
  `;
}

/**
 * Shared Header Component (Zero emojis, modern SVG icons)
 */
function renderHeader(project, currentSlug = '') {
  const logo = project.logoUrl;
  const company = escapeHtml(project.companyName);
  const hubUrl = `/sites/${project.id}`;

  return `
    <header class="site-header">
      <div class="header-container">
        <a href="${hubUrl}" class="brand-identity">
          <img src="${safeLogoUrl(project.logoUrl, company, brandColor)}" alt="${company} Logo" class="brand-logo" />
          <span class="brand-name">${company}</span>
        </a>
        <nav class="site-nav" aria-label="Main Navigation">
          <a href="${hubUrl}" class="nav-link ${!currentSlug ? 'active' : ''}">All Articles</a>
          <a href="${hubUrl}#featured" class="nav-link">Featured</a>
          <a href="${hubUrl}#about" class="nav-link">About ${company}</a>
          <a href="/" class="nav-link nav-studio-link" title="Open Webpage Generator Studio">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Studio</span>
          </a>
        </nav>
        <div class="header-actions">
          <a href="#subscribe" class="btn btn-brand btn-sm">Subscribe</a>
        </div>
      </div>
    </header>
  `;
}

/**
 * Shared Footer Component
 */
function renderFooter(project) {
  const company = escapeHtml(project.companyName);
  const hubUrl = `/sites/${project.id}`;
  const articles = project.articles || [];

  return `
    <footer class="site-footer" id="about">
      <div class="footer-container">
        <div class="footer-grid">
          <div class="footer-brand-col">
            <div class="footer-logo-row">
              <img src="${safeLogoUrl(project.logoUrl, company, brandColor)}" alt="${company} Logo" class="footer-logo" />
              <span class="footer-company-name">${company}</span>
            </div>
            <p class="footer-tagline">Authoritative intelligence, strategic benchmarks, and industry perspectives curated by the ${company} research team.</p>
            <div class="brand-color-badge" style="display:inline-flex; align-items:center; gap:8px; font-size:12px; margin-top:12px; padding:4px 10px; border-radius:20px; background:var(--brand-soft-bg); border:1px solid var(--brand-border);">
              <span style="width:10px; height:10px; border-radius:50%; background:var(--brand-color);"></span>
              <span>Brand Hex: <strong>${project.brandColor}</strong></span>
            </div>
          </div>

          <div class="footer-nav-col">
            <h4>Hosted Guides (10 Topics)</h4>
            <ul class="footer-links-list">
              ${articles.slice(0, 5).map(a => `
                <li><a href="/sites/${project.id}/blog/${a.slug}">${escapeHtml(a.title)}</a></li>
              `).join('')}
            </ul>
          </div>

          <div class="footer-nav-col">
            <h4>More Topics</h4>
            <ul class="footer-links-list">
              ${articles.slice(5, 10).map(a => `
                <li><a href="/sites/${project.id}/blog/${a.slug}">${escapeHtml(a.title)}</a></li>
              `).join('')}
            </ul>
          </div>

          <div class="footer-subscribe-col" id="subscribe">
            <h4>Stay Updated</h4>
            <p>Get our latest deep-dive research delivered straight to your inbox.</p>
            <form class="footer-newsletter-form" onsubmit="event.preventDefault(); alert('Thank you for subscribing to ${company} updates!'); this.reset();">
              <input type="email" placeholder="Enter your email" required class="form-input" />
              <button type="submit" class="btn btn-brand">Join Readers</button>
            </form>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</p>
          <div class="footer-sub-links">
            <a href="${hubUrl}">Home Hub</a>
            <a href="/">Create Another Website</a>
            <a href="javascript:window.scrollTo({top:0, behavior:'smooth'})">Back to Top &uarr;</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Render Branded Blog Hub Page (Listing all 10 articles)
 */
function renderHubPage(project) {
  const company = escapeHtml(project.companyName);
  const articles = project.articles || [];
  const featured = articles[0] || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${company} &bull; Publications &amp; Research Hub</title>
  <meta name="description" content="Explore authoritative, 1000+ word guides and deep research published by ${company} across ${articles.length} key industry topics.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/blog-theme.css">
  <style>
    ${getBrandCssVariables(project.brandColor)}
  </style>
</head>
<body class="blog-theme-body">

  ${renderHeader(project)}

  <!-- Owner Management Banner (Activated if user owns this site) -->
  <div id="owner-controls-bar" class="owner-controls-bar" style="display:none;" data-site-id="${project.id}">
    <div class="owner-controls-inner">
      <div class="owner-badge">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>You Own This Hosted Site</span>
      </div>
      <div class="owner-actions">
        <a href="/api/projects/${project.id}/export" class="btn btn-outline btn-sm">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export ZIP
        </a>
        <button type="button" class="btn btn-outline btn-sm btn-delete-owner" onclick="handleOwnerDeleteSite('${project.id}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete Site
        </button>
      </div>
    </div>
  </div>

  <main class="hub-main-container">
    <!-- Hub Hero Section -->
    <section class="hub-hero">
      <div class="hub-hero-content">
        <div class="brand-pill">
          <span class="pill-dot"></span>
          <span>Official Research &amp; Publications Hub</span>
        </div>
        <h1 class="hub-title">${company} Insights &amp; Perspectives</h1>
        <p class="hub-subtitle">Authoritative, deeply researched 1000+ word analyses exploring operational mechanics, benchmarks, and strategies shaping modern industry.</p>
        
        <div class="hub-stats-bar">
          <div class="hub-stat-item">
            <span class="stat-number">10</span>
            <span class="stat-label">Published Guides</span>
          </div>
          <div class="hub-stat-divider"></div>
          <div class="hub-stat-item">
            <span class="stat-number">15,000+</span>
            <span class="stat-label">Total Words</span>
          </div>
          <div class="hub-stat-divider"></div>
          <div class="hub-stat-item">
            <span class="stat-number">100%</span>
            <span class="stat-label">Consistent Brand Layout</span>
          </div>
        </div>

        <div class="hub-search-container">
          <input type="text" id="topic-search-input" placeholder="Filter through all 10 topics..." class="hub-search-input" onkeyup="filterArticles()" />
          <span class="search-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
        </div>
      </div>
    </section>

    <!-- Featured Lead Article -->
    ${featured.title ? `
    <section class="featured-article-section" id="featured">
      <div class="featured-card">
        <div class="featured-badge">Featured Publication &bull; Deep Analysis</div>
        <div class="featured-content-grid">
          <div class="featured-text">
            <div class="article-meta-row">
              <span class="meta-tag">${escapeHtml(featured.tags?.[0] || 'Strategic')}</span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-date">${featured.publishDate}</span>
              <span class="meta-dot">&bull;</span>
              <span class="meta-time">${featured.readingTimeMinutes} min read (${featured.wordCount} words)</span>
            </div>
            <h2 class="featured-title">
              <a href="/sites/${project.id}/blog/${featured.slug}">${escapeHtml(featured.title)}</a>
            </h2>
            <p class="featured-excerpt">${escapeHtml(featured.excerpt)}</p>
            <div class="featured-author-row">
              <img src="${safeAvatarUrl(featured.author?.avatar, featured.author?.name, brandColor)}" alt="${escapeHtml(featured.author?.name)}" class="author-avatar-sm" />
              <div class="author-info">
                <strong>${escapeHtml(featured.author?.name)}</strong>
                <span>${escapeHtml(featured.author?.role)}</span>
              </div>
              <a href="/sites/${project.id}/blog/${featured.slug}" class="btn btn-brand read-featured-btn">Read 1000+ Word Guide &rarr;</a>
            </div>
          </div>
        </div>
      </div>
    </section>
    ` : ''}

    <!-- All 10 Articles Grid -->
    <section class="all-topics-section">
      <div class="section-header-row">
        <div>
          <h2 class="section-title">All 10 Dedicated Topic Pages</h2>
          <p class="section-subtitle">Click any topic to view its dedicated 1000-word standalone hosted page.</p>
        </div>
        <div class="topics-counter-badge" id="visible-count">Showing 10 of 10 pages</div>
      </div>

      <div class="articles-grid" id="articles-grid">
        ${articles.map((article, idx) => `
          <article class="article-card" data-title="${escapeHtml(article.title.toLowerCase())}">
            <div class="card-top">
              <span class="page-number-badge">Page ${idx + 1} of 10</span>
              <span class="card-reading-time">${article.readingTimeMinutes} min &bull; ${article.wordCount} words</span>
            </div>
            <h3 class="card-title">
              <a href="/sites/${project.id}/blog/${article.slug}">${escapeHtml(article.title)}</a>
            </h3>
            <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="card-footer">
              <div class="card-author">
                <img src="${safeAvatarUrl(article.author?.avatar, article.author?.name, brandColor)}" alt="${escapeHtml(article.author?.name)}" class="author-avatar-xs" />
                <span class="author-name-xs">${escapeHtml(article.author?.name)}</span>
              </div>
              <a href="/sites/${project.id}/blog/${article.slug}" class="card-read-link">Read Full &rarr;</a>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  </main>

  ${renderFooter(project)}

  <script src="/js/blog.js"></script>
  <script>
    function filterArticles() {
      const q = document.getElementById('topic-search-input').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.article-card');
      let visible = 0;
      cards.forEach(card => {
        const title = card.getAttribute('data-title') || '';
        if (title.includes(q)) {
          card.style.display = 'flex';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });
      document.getElementById('visible-count').textContent = 'Showing ' + visible + ' of ' + cards.length + ' pages';
    }

    // Check if current user is owner to show owner controls
    document.addEventListener('DOMContentLoaded', async () => {
      const token = localStorage.getItem('wpg_auth_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (res.ok) {
            const data = await res.json();
            const siteOwnerId = '${project.ownerId || ""}';
            if (data.user && (data.user.id === siteOwnerId || !siteOwnerId)) {
              document.getElementById('owner-controls-bar').style.display = 'block';
            }
          }
        } catch(e) {}
      }
    });

    async function handleOwnerDeleteSite(siteId) {
      if (!confirm('Are you sure you want to permanently delete this hosted site and all 10 blog pages?')) {
        return;
      }
      const token = localStorage.getItem('wpg_auth_token');
      try {
        const res = await fetch('/api/projects/' + siteId, {
          method: 'DELETE',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        if (res.ok) {
          alert('Hosted site deleted successfully.');
          window.location.href = '/';
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to delete site.');
        }
      } catch (err) {
        alert('Delete error: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Render Dedicated 1000-Word Hosted Blog Post Page
 */
function renderArticlePage(project, article) {
  const company = escapeHtml(project.companyName);
  const title = escapeHtml(article.title);
  const articles = project.articles || [];
  const currentIdx = articles.findIndex(a => a.slug === article.slug);
  const prevArticle = currentIdx > 0 ? articles[currentIdx - 1] : null;
  const nextArticle = currentIdx < articles.length - 1 ? articles[currentIdx + 1] : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} &bull; ${company}</title>
  <meta name="description" content="${escapeHtml(article.excerpt)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/blog-theme.css">
  <style>
    ${getBrandCssVariables(project.brandColor)}
  </style>
</head>
<body class="blog-theme-body">

  <!-- Scroll Progress Indicator -->
  <div class="scroll-progress-container" aria-hidden="true">
    <div class="scroll-progress-bar" id="reading-progress"></div>
  </div>

  ${renderHeader(project, article.slug)}

  <main class="post-layout-container">
    <!-- Breadcrumbs -->
    <nav class="breadcrumb-nav" aria-label="Breadcrumb">
      <a href="/sites/${project.id}">All 10 Pages</a>
      <span class="bc-sep">/</span>
      <span class="bc-category">Topic ${currentIdx + 1} of 10</span>
      <span class="bc-sep">/</span>
      <span class="bc-current">${title}</span>
    </nav>

    <!-- Post Article Wrapper -->
    <div class="post-content-grid">
      <article class="post-main-article">
        <!-- Post Header -->
        <header class="post-header">
          <div class="post-tags-row">
            <span class="topic-pill">Topic ${currentIdx + 1} of 10</span>
            <span class="word-count-badge">${article.wordCount} Words &bull; Comprehensive Guide</span>
            <span class="reading-time-pill">${article.readingTimeMinutes} min read</span>
          </div>

          <h1 class="post-headline">${title}</h1>

          <div class="author-meta-block">
            <div class="author-details">
              <img src="${safeAvatarUrl(article.author?.avatar, article.author?.name, brandColor)}" alt="${escapeHtml(article.author?.name)}" class="author-avatar-md" />
              <div>
                <div class="author-name">${escapeHtml(article.author?.name)}</div>
                <div class="author-title">${escapeHtml(article.author?.role)} &bull; ${company}</div>
              </div>
            </div>

            <div class="post-actions-bar">
              <span class="post-date">Published on ${article.publishDate}</span>
              <button class="btn btn-outline btn-sm copy-link-btn" onclick="copyCurrentUrl(this)">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Page Link</span>
              </button>
            </div>
          </div>
        </header>

        <!-- Article Rich Body (1000+ words) -->
        <div class="post-body-content">
          ${article.contentHtml}
        </div>

        <!-- Post Navigation (Prev / Next Topic) -->
        <nav class="post-pagination-nav" aria-label="Post Navigation">
          ${prevArticle ? `
            <a href="/sites/${project.id}/blog/${prevArticle.slug}" class="pagination-link prev-link">
              <span class="page-nav-label">&larr; Previous Topic (${currentIdx})</span>
              <span class="page-nav-title">${escapeHtml(prevArticle.title)}</span>
            </a>
          ` : `<div></div>`}

          ${nextArticle ? `
            <a href="/sites/${project.id}/blog/${nextArticle.slug}" class="pagination-link next-link">
              <span class="page-nav-label">Next Topic (${currentIdx + 2}) &rarr;</span>
              <span class="page-nav-title">${escapeHtml(nextArticle.title)}</span>
            </a>
          ` : `<div></div>`}
        </nav>
      </article>

      <!-- Sidebar -->
      <aside class="post-sidebar">
        <!-- Author Profile Card (Authentic user data) -->
        <div class="sidebar-widget author-card">
          <div class="widget-header">
            <img src="${safeAvatarUrl(article.author?.avatar, article.author?.name, brandColor)}" alt="${escapeHtml(article.author?.name)}" class="author-avatar-md" />
            <div>
              <h4 class="widget-company">${escapeHtml(article.author?.name)}</h4>
              <span class="widget-meta">${escapeHtml(article.author?.role)}</span>
            </div>
          </div>
          <p class="widget-desc">${escapeHtml(article.author?.bio || `Insights published for ${company}.`)}</p>
        </div>

        <!-- Quick Stats Widget -->
        <div class="sidebar-widget brand-card">
          <div class="widget-header">
            <img src="${safeLogoUrl(project.logoUrl, company, brandColor)}" alt="${company}" class="widget-logo" />
            <div>
              <h4 class="widget-company">${company}</h4>
              <span class="widget-meta">Hosted Blog Platform</span>
            </div>
          </div>
          <p class="widget-desc">This is page <strong>${currentIdx + 1}</strong> of 10 automatically hosted, branded pages generated for ${company}.</p>
          <a href="/sites/${project.id}" class="btn btn-brand btn-block btn-sm">View All 10 Topics &rarr;</a>
        </div>

        <!-- Other Topics in this Campaign -->
        <div class="sidebar-widget">
          <h4 class="widget-title">Explore More Topics (10 Total)</h4>
          <ul class="sidebar-articles-list">
            ${articles.map((a, i) => `
              <li class="sidebar-article-item ${a.slug === article.slug ? 'active-item' : ''}">
                <a href="/sites/${project.id}/blog/${a.slug}">
                  <span class="sidebar-num">${i + 1}</span>
                  <div class="sidebar-item-text">
                    <span class="sidebar-item-title">${escapeHtml(a.title)}</span>
                    <span class="sidebar-item-meta">${a.wordCount} words &bull; ${a.readingTimeMinutes}m</span>
                  </div>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      </aside>
    </div>
  </main>

  ${renderFooter(project)}

  <script src="/js/blog.js"></script>
</body>
</html>`;
}

module.exports = {
  renderHubPage,
  renderArticlePage,
  getBrandCssVariables
};
