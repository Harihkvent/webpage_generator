/**
 * studio.js
 * Logic for Webpage Generator Studio Portal
 * Features:
 * - Full Authentication & Session management
 * - Ownership-based site deletion & filtering
 * - Real author profile handling (zero fake personas)
 * - Zero emojis (clean SVGs throughout)
 */

// Multi-use case presets data (Real, professional data)
const PRESETS = {
  saas: {
    companyName: 'Apex Cloud Systems',
    brandColor: '#6366F1',
    authorName: 'Apex Architecture Team',
    authorRole: 'Enterprise Cloud Solutions Lead',
    authorBio: 'Specializing in distributed systems, Kubernetes orchestration, and cloud-native resilience.',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&h=120&q=80',
    topics: [
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
    ]
  },
  fintech: {
    companyName: 'Nova Wealth & Capital',
    brandColor: '#0284C7',
    authorName: 'Nova Quantitative Strategy Group',
    authorRole: 'Head of Quantitative Asset Management',
    authorBio: 'Focusing on algorithmic portfolio optimization, real-time liquidity rails, and risk intelligence.',
    logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=120&h=120&q=80',
    topics: [
      'Algorithmic Asset Allocation in Volatile Market Regimes',
      'Decentralized Settlement Networks and Next-Gen Payment Rails',
      'AI-Driven Risk Modeling for Commercial Lending Portfolios',
      'Regulatory Compliance and Automated Anti-Money Laundering Protocols',
      'Private Equity Tokenization: Liquidity and Governance Dynamics',
      'The Evolution of Embedded Finance in B2B Marketplaces',
      'Quantitative Hedging Strategies for High-Net-Worth Portfolios',
      'Open Banking APIs and the Modern Consumer Credit Ecosystem',
      'Digital Treasury Management for Global Remote Organizations',
      'Cybersecurity and Fraud Prevention in Real-Time Payment Networks'
    ]
  },
  cleantech: {
    companyName: 'Verdant Solar Dynamics',
    brandColor: '#10B981',
    authorName: 'Verdant Energy Research Labs',
    authorRole: 'Director of Renewable Grid Technologies',
    authorBio: 'Pioneering utility-scale storage, virtual power plants, and industrial decarbonization protocols.',
    logoUrl: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=120&h=120&q=80',
    topics: [
      'Utility-Scale Solar Storage: Battery Chemistry Breakthroughs',
      'Smart Grid Integration and Virtual Power Plant Orchestration',
      'Industrial Decarbonization: Carbon Capture and Storage Economics',
      'Commercial EV Fleet Electrification and Depot Charging Infrastructure',
      'Green Hydrogen Production: Efficiency Milestones and Capex Trends',
      'ESG Compliance Auditing and Automated Carbon Accounting Platforms',
      'Agrivoltaics: Dual-Use Land Management for Food and Renewable Energy',
      'Building Microgrids for Climate Resilience in Critical Facilities',
      'Circular Economy in Clean Tech: Lithium Battery Recycling Protocols',
      'Policy Incentives and Private Capital Allocation in Renewable Energy'
    ]
  },
  health: {
    companyName: 'Aura Longevity Biotech',
    brandColor: '#8B5CF6',
    authorName: 'Aura Clinical Insights Board',
    authorRole: 'Chief of Preventative & Translational Medicine',
    authorBio: 'Investigating cellular rejuvenation, proactive biomarker telemetry, and targeted therapeutics.',
    logoUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=120&h=120&q=80',
    topics: [
      'Cellular Rejuvenation and Senolytic Therapies in Preventative Medicine',
      'Continuous Biomarker Telemetry: The Shift to Proactive Healthcare',
      'Personalized Epigenetic Nutrition for Metabolic Optimization',
      'AI-Accelerated Peptide Discovery and Therapeutic Molecular Modeling',
      'The Gut Microbiome Axis and Neuro-Immune System Regulation',
      'Sleep Architecture and Glymphatic Clearance in Cognitive Health',
      'Wearable Diagnostics and Real-Time Cardiovascular Monitoring',
      'Genomic Sequencing in Early Detection of Oncological Markers',
      'Mitochondrial Dynamics: Bioenergetics and Longevity Protocols',
      'Regulatory Pathways for Next-Generation Biological Therapeutics'
    ]
  }
};

let currentLogoDataUrl = '';
let currentTopics = [];
let currentUser = null;
let currentDirectoryFilter = 'all';

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Check auth status
  initAuth();

  // Load default SaaS preset
  loadPreset('saas');

  // Check if .env has Gemini API Key
  checkServerConfig();

  // Fetch initial projects
  fetchAndRenderProjects();
});

// Smooth scroll utility
function scrollToSection(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.scrollIntoView({ behavior: 'smooth' });
  }
}

// -----------------------------------------------------------------------------
// Authentication System
// -----------------------------------------------------------------------------
async function initAuth() {
  const token = localStorage.getItem('wpg_auth_token');
  if (!token) {
    renderAuthHeader(null);
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      renderAuthHeader(currentUser);

      // Pre-fill author name if blank
      const authorField = document.getElementById('author-name');
      if (authorField && !authorField.value) {
        authorField.value = currentUser.name;
        updateLivePreview();
      }
    } else {
      localStorage.removeItem('wpg_auth_token');
      renderAuthHeader(null);
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    renderAuthHeader(null);
  }
}

function renderAuthHeader(user) {
  const container = document.getElementById('auth-header-widget');
  if (!container) return;

  if (user) {
    const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    container.innerHTML = `
      <div class="user-profile-pill">
        <span class="user-avatar-dot">${initials}</span>
        <span>${escapeHtml(user.name)}</span>
        <button type="button" class="btn-signout" onclick="handleAuthLogout()" title="Sign Out">
          Sign Out
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-outline btn-sm" onclick="openAuthModal('login')">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        <span>Sign In</span>
      </button>
      <button type="button" class="btn btn-brand btn-sm" onclick="openAuthModal('signup')">
        <span>Sign Up</span>
      </button>
    `;
  }
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-modal').classList.add('active');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('active');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const loginTab = document.getElementById('auth-tab-login');
  const signupTab = document.getElementById('auth-tab-signup');

  if (tab === 'signup') {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    loginTab.classList.remove('active');
    signupTab.classList.add('active');
  } else {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  }
}

async function handleAuthLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('wpg_auth_token', data.token);
    currentUser = data.user;
    renderAuthHeader(currentUser);
    closeAuthModal();

    // Refresh projects list with ownership permissions
    fetchAndRenderProjects();
  } catch (err) {
    alert(err.message);
  }
}

async function handleAuthSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');

    localStorage.setItem('wpg_auth_token', data.token);
    currentUser = data.user;
    renderAuthHeader(currentUser);
    closeAuthModal();

    // Pre-fill author name with user name
    const authorField = document.getElementById('author-name');
    if (authorField) authorField.value = currentUser.name;
    updateLivePreview();

    fetchAndRenderProjects();
  } catch (err) {
    alert(err.message);
  }
}

async function handleDemoQuickLogin() {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@webpagegenerator.com', password: 'Demo1234!' })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('wpg_auth_token', data.token);
      currentUser = data.user;
      renderAuthHeader(currentUser);
      closeAuthModal();
      fetchAndRenderProjects();
    }
  } catch (err) {
    alert('Demo login error: ' + err.message);
  }
}

async function handleAuthLogout() {
  const token = localStorage.getItem('wpg_auth_token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    } catch (e) {}
  }

  localStorage.removeItem('wpg_auth_token');
  currentUser = null;
  renderAuthHeader(null);
  fetchAndRenderProjects();
}

// -----------------------------------------------------------------------------
// System Config & Gemini Key Status
// -----------------------------------------------------------------------------
async function checkServerConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      const statusBadge = document.getElementById('gemini-env-badge');
      if (data.hasGeminiKey) {
        const select = document.getElementById('llm-provider-select');
        const opt = select ? select.querySelector('option[value="gemini"]') : null;
        if (opt) {
          opt.textContent = 'Google Gemini (Active via .env GEMINI_API_KEY)';
        }
        if (statusBadge) {
          statusBadge.style.display = 'inline-flex';
        }
      }
    }
  } catch (e) {
    console.warn('Config check:', e.message);
  }
}

// -----------------------------------------------------------------------------
// Presets & Real Author Setup
// -----------------------------------------------------------------------------
function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  document.getElementById('company-name').value = preset.companyName;
  document.getElementById('brand-color-hex').value = preset.brandColor;
  document.getElementById('brand-color-picker').value = preset.brandColor;
  document.getElementById('author-name').value = preset.authorName;
  document.getElementById('author-role').value = preset.authorRole;
  document.getElementById('author-bio').value = preset.authorBio;
  currentLogoDataUrl = preset.logoUrl;

  const previewImg = document.getElementById('logo-preview-img');
  const dropPlaceholder = document.getElementById('logo-dropzone-placeholder');
  previewImg.src = preset.logoUrl;
  previewImg.style.display = 'block';
  dropPlaceholder.style.display = 'none';

  // Highlight active preset color swatch
  highlightActiveSwatch(preset.brandColor);

  // Set topics
  currentTopics = [...preset.topics];
  renderTopicRows();

  // Update contrast badge & live preview
  updateBrandColorStyles(preset.brandColor);
  updateLivePreview();
}

// Render dynamic topic input rows (up to 10 topics)
function renderTopicRows() {
  const container = document.getElementById('topics-list');
  container.innerHTML = '';

  currentTopics.forEach((topic, idx) => {
    const row = document.createElement('div');
    row.className = 'topic-input-row';
    row.innerHTML = `
      <div class="topic-num-badge">${idx + 1}</div>
      <input 
        type="text" 
        class="topic-text-field" 
        value="${escapeHtmlAttr(topic)}" 
        placeholder="e.g. Topic ${idx + 1} Title..." 
        required
        oninput="handleTopicInput(${idx}, this.value)"
      />
      <button 
        type="button" 
        class="btn-remove-topic" 
        title="Remove topic" 
        onclick="removeTopicRow(${idx})"
        ${currentTopics.length <= 1 ? 'disabled style="opacity:0.2;"' : ''}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(row);
  });

  const addBtn = document.getElementById('btn-add-topic');
  const counter = document.getElementById('topics-counter');

  addBtn.disabled = currentTopics.length >= 10;
  counter.textContent = `${currentTopics.length} of 10 topics active`;

  updateLivePreview();
}

function handleTopicInput(idx, value) {
  currentTopics[idx] = value;
  updateLivePreview();
}

function addTopicRow() {
  if (currentTopics.length >= 10) return;
  const company = document.getElementById('company-name').value.trim() || 'Modern Business';
  currentTopics.push(`Strategic Insights on ${company} Best Practices (${currentTopics.length + 1})`);
  renderTopicRows();
}

function removeTopicRow(idx) {
  if (currentTopics.length <= 1) return;
  currentTopics.splice(idx, 1);
  renderTopicRows();
}

// Auto-suggest 10 topics tailored to the company name
function suggestTopicsForBrand() {
  const company = document.getElementById('company-name').value.trim();
  if (!company) {
    alert('Please enter a Company Name first so we can suggest relevant topics.');
    document.getElementById('company-name').focus();
    return;
  }

  const baseTerms = [
    `Foundational Architectures: How ${company} Builds for Long-Term Scalability`,
    `Modernizing Legacy Workflows with Next-Gen Intelligence`,
    `Cost Optimization and ROI Benchmarks in Modern Operations`,
    `Security, Governance, and Operational Resilience Frameworks`,
    `The Shift Toward Autonomous Systems: Opportunities and Guardrails`,
    `Key Performance Indicators That Forward-Thinking Leaders Track`,
    `Cross-Functional Alignment: Breaking Down Silos for 10x Velocity`,
    `Common Operational Blindspots (And How to Mitigate Them Proactively)`,
    `Customer-Centric Innovation: Delivering Value in Competitive Markets`,
    `The Five-Year Outlook: Trends Shaping the Future of the Industry`
  ];

  currentTopics = baseTerms;
  renderTopicRows();
}

// Hex & Color Picker Synchronization
function handleColorPickerChange(hex) {
  document.getElementById('brand-color-hex').value = hex.toUpperCase();
  updateBrandColorStyles(hex);
  highlightActiveSwatch(hex);
  updateLivePreview();
}

function handleHexInputChange(val) {
  let hex = val.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9A-F]{6}$/i.test(hex) || /^#[0-9A-F]{3}$/i.test(hex)) {
    document.getElementById('brand-color-picker').value = hex;
    updateBrandColorStyles(hex);
    highlightActiveSwatch(hex);
    updateLivePreview();
  }
}

function selectPaletteColor(hex) {
  document.getElementById('brand-color-hex').value = hex;
  document.getElementById('brand-color-picker').value = hex;
  updateBrandColorStyles(hex);
  highlightActiveSwatch(hex);
  updateLivePreview();
}

function highlightActiveSwatch(hex) {
  const cleanHex = hex.toUpperCase();
  document.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

function updateBrandColorStyles(hex) {
  const badge = document.getElementById('contrast-preview-badge');
  const contrast = getContrast(hex);
  badge.style.backgroundColor = hex;
  badge.style.color = contrast;
  badge.textContent = hex.toUpperCase();
}

// Contrast calculation
function getContrast(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return '#FFFFFF';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0F172A' : '#FFFFFF';
}

// Logo Handling
function handleLogoFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    currentLogoDataUrl = event.target.result;
    const previewImg = document.getElementById('logo-preview-img');
    const placeholder = document.getElementById('logo-dropzone-placeholder');
    previewImg.src = currentLogoDataUrl;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    updateLivePreview();
  };
  reader.readAsDataURL(file);
}

function handleLogoUrlInput(url) {
  const cleanUrl = url.trim();
  if (cleanUrl) {
    currentLogoDataUrl = cleanUrl;
    const previewImg = document.getElementById('logo-preview-img');
    const placeholder = document.getElementById('logo-dropzone-placeholder');
    previewImg.src = cleanUrl;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
  }
  updateLivePreview();
}

function toggleApiKeyField() {
  const provider = document.getElementById('llm-provider-select').value;
  const container = document.getElementById('api-key-container');
  container.style.display = provider === 'gemini' ? 'block' : 'none';
}

// Update Live Brand Identity Preview Card
function updateLivePreview() {
  const company = document.getElementById('company-name').value.trim() || 'Your Company';
  const hex = document.getElementById('brand-color-hex').value.trim() || '#6366F1';
  const contrast = getContrast(hex);
  const authorName = document.getElementById('author-name').value.trim() || 'Editorial Board';

  // Update company name & author
  document.getElementById('sim-company-name').textContent = company;
  document.getElementById('sim-author-display').textContent = 'By ' + authorName;
  document.getElementById('sim-sample-title').textContent = currentTopics[0] || '1. Foundational Architecture & Scalability';

  // Update button & badge styling
  const ctaBtn = document.getElementById('sim-btn-cta');
  ctaBtn.style.backgroundColor = hex;
  ctaBtn.style.color = contrast;

  const badge = document.getElementById('sim-badge');
  badge.style.backgroundColor = `${hex}22`;
  badge.style.color = hex;

  const callout = document.getElementById('sim-callout');
  callout.style.backgroundColor = `${hex}10`;
  callout.style.borderLeftColor = hex;

  // Update logo
  const simLogo = document.getElementById('sim-logo');
  if (currentLogoDataUrl) {
    simLogo.src = currentLogoDataUrl;
  } else {
    // Generate monogram safely with Base64
    const initials = company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'CO';
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="' + hex + '"/><text x="16" y="21" font-family="sans-serif" font-weight="800" font-size="14" fill="' + contrast + '" text-anchor="middle">' + initials + '</text></svg>';
    simLogo.src = 'data:image/svg+xml;base64,' + btoa(svgStr);
  }
}

// -----------------------------------------------------------------------------
// Form Submission: Generate 10 Hosted Pages with Real Author Data
// -----------------------------------------------------------------------------
async function handleGenerateSubmit(e) {
  e.preventDefault();

  const companyName = document.getElementById('company-name').value.trim();
  const brandColor = document.getElementById('brand-color-hex').value.trim();
  const authorName = document.getElementById('author-name').value.trim();
  const authorRole = document.getElementById('author-role').value.trim();
  const authorBio = document.getElementById('author-bio').value.trim();
  const provider = document.getElementById('llm-provider-select').value;
  const apiKey = document.getElementById('api-key-input')?.value.trim() || '';

  if (!companyName) {
    alert('Please enter a Company Name');
    return;
  }

  // Filter valid topics
  const validTopics = currentTopics.filter(t => t && t.trim().length > 0);
  if (validTopics.length === 0) {
    alert('Please enter at least 1 topic (up to 10).');
    return;
  }

  // Open Animated Progress Modal (Clean SVG spinner)
  openGenerationModal(validTopics, companyName);

  try {
    const payload = {
      companyName,
      brandColor,
      logoUrl: currentLogoDataUrl,
      topics: validTopics,
      llmProvider: provider,
      apiKey: apiKey,
      // Real author inputs
      authorName,
      authorRole,
      authorBio
    };

    const token = localStorage.getItem('wpg_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate pages');
    }

    const createdProject = await response.json();

    // Finish step-by-step progress animation
    await completeProgressSteps(createdProject);

    // Refresh projects list in background
    fetchAndRenderProjects();

  } catch (err) {
    alert('Generation error: ' + err.message);
    closeGenerationModal();
  }
}

// Modal Progress Control (Zero emojis, SVG icons)
function openGenerationModal(topics, companyName) {
  const modal = document.getElementById('generation-modal');
  const title = document.getElementById('modal-title');
  const status = document.getElementById('modal-status');
  const stepsList = document.getElementById('progress-steps-list');
  const barFill = document.getElementById('progress-bar-fill');

  modal.classList.remove('success');
  modal.classList.add('active');
  title.textContent = `Generating ${topics.length} Hosted Pages for ${companyName}`;
  status.textContent = 'Synthesizing 1000+ word structured articles with benchmarks, data tables, and FAQs...';
  barFill.style.width = '10%';

  stepsList.innerHTML = topics.map((t, idx) => `
    <li class="progress-step-item" id="step-item-${idx}">
      <span class="step-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </span>
      <span>Page ${idx + 1}: ${escapeHtml(t)} (~1,000 words)</span>
    </li>
  `).join('');
}

async function completeProgressSteps(project) {
  const articles = project.articles || [];
  const barFill = document.getElementById('progress-bar-fill');
  const status = document.getElementById('modal-status');

  for (let i = 0; i < articles.length; i++) {
    const item = document.getElementById(`step-item-${i}`);
    if (item) {
      item.classList.add('active');
      item.querySelector('.step-icon').innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      `;
      await delay(120);
      item.classList.remove('active');
      item.classList.add('done');
      item.querySelector('.step-icon').innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
      `;
      const pct = Math.round(((i + 1) / articles.length) * 100);
      barFill.style.width = `${pct}%`;
      status.textContent = `Hosted Page ${i + 1} of ${articles.length} compiled (${articles[i].wordCount} words)`;
    }
  }

  // Done
  const modal = document.getElementById('generation-modal');
  modal.classList.add('success');
  document.getElementById('modal-title').textContent = 'All 10 Pages Hosted Successfully';
  status.textContent = `Your brand portal is now live with 10 dedicated 1000-word guides for ${project.companyName}.`;
  document.getElementById('modal-spinner').innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" stroke="#10b981" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="16 10 11 15 8 12"/></svg>
  `;

  const viewHubBtn = document.getElementById('modal-view-hub-btn');
  viewHubBtn.href = `/sites/${project.id}`;
}

function closeGenerationModal() {
  document.getElementById('generation-modal').classList.remove('active');
}

// -----------------------------------------------------------------------------
// Multiple Use Cases & Ownership Directory
// -----------------------------------------------------------------------------
function setDirectoryFilter(filter) {
  currentDirectoryFilter = filter;
  document.querySelectorAll('.dir-filter-btn').forEach(b => b.classList.remove('active'));

  if (filter === 'mine') {
    document.getElementById('filter-my-sites-btn').classList.add('active');
  } else {
    document.getElementById('filter-all-sites-btn').classList.add('active');
  }

  fetchAndRenderProjects();
}

async function fetchAndRenderProjects() {
  try {
    const token = localStorage.getItem('wpg_auth_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const url = currentDirectoryFilter === 'mine' ? '/api/projects?mine=true' : '/api/projects';
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const projects = await res.json();

    document.getElementById('header-sites-count').textContent = projects.length;
    renderProjectsGrid(projects);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
}

function renderProjectsGrid(projects) {
  const grid = document.getElementById('sites-grid');
  if (!projects || projects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:50px; background:rgba(255,255,255,0.03); border:1px dashed var(--border-subtle); border-radius:16px;">
        <h4 style="font-size:1.2rem; margin-bottom:8px;">No hosted sites found</h4>
        <p style="color:var(--text-muted); font-size:0.95rem;">${currentDirectoryFilter === 'mine' ? 'You have not created any sites yet. Use the generator above to create your first site!' : 'No hosted sites in directory. Create one now!'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(proj => {
    const articles = proj.articles || [];
    const totalWords = articles.reduce((sum, a) => sum + (a.wordCount || 0), 0);
    const authorName = proj.author?.name || proj.ownerName || 'Editorial Team';

    return `
      <div class="site-card">
        <div class="site-card-top">
          <img src="${proj.logoUrl}" alt="${escapeHtml(proj.companyName)}" class="site-card-logo" />
          <div class="site-card-info">
            <h3 class="site-card-company">${escapeHtml(proj.companyName)}</h3>
            <div class="site-card-meta">
              <span class="site-card-swatch" style="background:${proj.brandColor};"></span>
              <span>${proj.brandColor}</span> &bull; 
              <span>${articles.length} Hosted Pages</span> &bull;
              <span>${totalWords.toLocaleString()} Words</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
              Author: <strong>${escapeHtml(authorName)}</strong>
            </div>
          </div>
        </div>

        <div class="site-card-topics-list">
          <h5>Hosted Topics (10 Pages):</h5>
          <div class="site-topic-tags">
            ${articles.slice(0, 5).map(a => `
              <span class="site-topic-tag" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</span>
            `).join('')}
            ${articles.length > 5 ? `<span class="site-topic-tag">+${articles.length - 5} more pages</span>` : ''}
          </div>
        </div>

        <div class="site-card-actions">
          <a href="/sites/${proj.id}" target="_blank" class="btn btn-brand">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>Open Brand Hub</span>
          </a>
          <button type="button" class="btn btn-outline" onclick="copySiteLink('${proj.id}', this)">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy URL</span>
          </button>
          
          ${proj.isOwner ? `
            <button type="button" class="btn-delete-site" onclick="deleteProject('${proj.id}')">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete Hosted Site</span>
            </button>
          ` : `
            <div style="grid-column: span 2; text-align:center; font-size:0.75rem; color:var(--text-muted); padding:4px;">
              Hosted by ${escapeHtml(proj.ownerName || 'Creator')}
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to permanently delete this hosted campaign and all its 10 blog pages?')) {
    return;
  }
  const token = localStorage.getItem('wpg_auth_token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (res.ok) {
      fetchAndRenderProjects();
    } else {
      alert(data.error || 'Failed to delete site.');
    }
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

function copySiteLink(id, btn) {
  const url = `${window.location.origin}/sites/${id}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span>';
      setTimeout(() => btn.innerHTML = orig, 2000);
    });
  }
}

// Helpers
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
