/**
 * studio.js
 * Logic for Webpage Generator Studio Portal
 * Features:
 * - Full Authentication & Session management
 * - Ownership-based site deletion, editing & filtering
 * - Real-time Server-Sent Events (SSE) generation progress tracking
 * - Interactive Campaign & Article Content Manager (Full CRUD on individual posts)
 * - 1-Click single-article regeneration
 * - Live directory search & pagination
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

// Pagination & Search state
let currentPage = 1;
let currentSearchQuery = '';
let currentTotalPages = 1;
let searchDebounceTimer = null;

// Active campaign management state
let activeManagingProject = null;
let activeEventSource = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  loadPreset('saas');
  checkServerConfig();
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
  const guestCallout = document.getElementById('guest-auth-callout');
  if (guestCallout) {
    guestCallout.style.display = user ? 'none' : 'flex';
  }

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

  highlightActiveSwatch(preset.brandColor);

  currentTopics = [...preset.topics];
  renderTopicRows();

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
  if (addBtn) addBtn.disabled = currentTopics.length >= 10;
  if (counter) counter.textContent = `${currentTopics.length} of 10 topics active`;
}

function handleTopicInput(idx, val) {
  currentTopics[idx] = val;
  updateLivePreview();
}

function addTopicRow() {
  if (currentTopics.length >= 10) return;
  const company = document.getElementById('company-name').value.trim() || 'Enterprise';
  currentTopics.push(`Strategic Frameworks for ${company} Topic ${currentTopics.length + 1}`);
  renderTopicRows();
  updateLivePreview();
}

function removeTopicRow(idx) {
  if (currentTopics.length <= 1) return;
  currentTopics.splice(idx, 1);
  renderTopicRows();
  updateLivePreview();
}

function suggestTopicsForBrand() {
  const company = document.getElementById('company-name').value.trim() || 'Modern Technology';
  currentTopics = [
    `Architectural Principles for ${company} Systems`,
    `Scaling Reliability and Continuous Delivery in ${company}`,
    `Data Governance and Zero-Trust Protocols for ${company}`,
    `Cost Optimization without Sacrificing Velocity at ${company}`,
    `Event-Driven Integration Standards for ${company}`,
    `Autonomous Observability and Telemetry at ${company}`,
    `API Resiliency and Rate-Limiting Frameworks in ${company}`,
    `Decentralized Data Pipelines and Modern Analytics for ${company}`,
    `Compliance Automation and Security Posture in ${company}`,
    `Future Perspectives: Next-Generation Innovation at ${company}`
  ];
  renderTopicRows();
  updateLivePreview();
}

// -----------------------------------------------------------------------------
// Color Picker & Brand Styling
// -----------------------------------------------------------------------------
function handleColorPickerChange(hex) {
  document.getElementById('brand-color-hex').value = hex.toUpperCase();
  highlightActiveSwatch(hex);
  updateBrandColorStyles(hex);
  updateLivePreview();
}

function handleHexInputChange(hex) {
  if (/^#[0-9A-F]{6}$/i.test(hex)) {
    document.getElementById('brand-color-picker').value = hex;
    highlightActiveSwatch(hex);
    updateBrandColorStyles(hex);
    updateLivePreview();
  }
}

function selectPaletteColor(hex) {
  document.getElementById('brand-color-hex').value = hex;
  document.getElementById('brand-color-picker').value = hex;
  highlightActiveSwatch(hex);
  updateBrandColorStyles(hex);
  updateLivePreview();
}

function highlightActiveSwatch(hex) {
  const normHex = hex.toUpperCase();
  document.querySelectorAll('.swatch-btn').forEach(btn => {
    const bg = btn.style.background;
    btn.classList.toggle('active', bg.toUpperCase().includes(normHex));
  });
}

function updateBrandColorStyles(hex) {
  const contrast = getContrastYIQ(hex);
  const badge = document.getElementById('contrast-preview-badge');
  if (badge) {
    badge.style.background = hex;
    badge.style.color = contrast;
  }
}

function getContrastYIQ(hexColor) {
  let hex = (hexColor || '#3B82F6').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return '#FFFFFF';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0F172A' : '#FFFFFF';
}

// -----------------------------------------------------------------------------
// Logo Handling
// -----------------------------------------------------------------------------
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
  currentLogoDataUrl = url.trim();
  const previewImg = document.getElementById('logo-preview-img');
  const placeholder = document.getElementById('logo-dropzone-placeholder');

  if (currentLogoDataUrl) {
    previewImg.src = currentLogoDataUrl;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    previewImg.style.display = 'none';
    placeholder.style.display = 'block';
  }
  updateLivePreview();
}

function toggleApiKeyField() {
  const select = document.getElementById('llm-provider-select');
  const keyContainer = document.getElementById('api-key-container');
  if (select.value === 'gemini') {
    keyContainer.style.display = 'block';
  } else {
    keyContainer.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// Live Brand Preview Updates
// -----------------------------------------------------------------------------
function updateLivePreview() {
  const company = document.getElementById('company-name').value.trim() || 'Your Company';
  const color = document.getElementById('brand-color-hex').value.trim() || '#6366F1';
  const authorName = document.getElementById('author-name').value.trim() || `${company} Editorial`;
  const firstTopic = currentTopics[0] || 'Modern Architectural Frameworks for Growth';

  document.getElementById('sim-company-name').textContent = company;
  document.getElementById('sim-sample-title').textContent = firstTopic;
  document.getElementById('sim-author-display').textContent = `By ${authorName}`;

  const ctaBtn = document.getElementById('sim-btn-cta');
  ctaBtn.style.background = color;
  ctaBtn.style.color = getContrastYIQ(color);

  const badge = document.getElementById('sim-badge');
  badge.style.color = color;
  badge.style.background = hexToRgba(color, 0.15);

  const callout = document.getElementById('sim-callout');
  callout.style.borderLeftColor = color;
  callout.style.background = hexToRgba(color, 0.08);

  const simLogo = document.getElementById('sim-logo');
  if (currentLogoDataUrl) {
    simLogo.src = currentLogoDataUrl;
  } else {
    const initials = company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'CO';
    simLogo.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='6' fill='${encodeURIComponent(color)}'/><text x='16' y='21' font-family='sans-serif' font-weight='800' font-size='14' fill='%23fff' text-anchor='middle'>${initials}</text></svg>`;
  }

  const slug = company.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
  document.getElementById('preview-url-display').textContent = `https://yourbrand.portal/sites/site-${slug}`;
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// -----------------------------------------------------------------------------
// Real-Time Asynchronous Generation with Server-Sent Events (SSE)
// -----------------------------------------------------------------------------
async function handleGenerateSubmit(e) {
  e.preventDefault();

  // Guest guard: only logged in users can create campaigns
  if (!currentUser) {
    openAuthModal('signup');
    alert('Account required: Only logged-in users can generate and host brand platforms. Guest users cannot create sites. Please sign in or create an account.');
    return;
  }

  const companyName = document.getElementById('company-name').value.trim();
  const brandColor = document.getElementById('brand-color-hex').value.trim();
  const authorName = document.getElementById('author-name').value.trim();
  const authorRole = document.getElementById('author-role').value.trim();
  const authorBio = document.getElementById('author-bio').value.trim();
  const provider = document.getElementById('llm-provider-select').value;
  const apiKey = document.getElementById('api-key-input').value.trim();

  const validTopics = currentTopics.filter(t => t && t.trim().length > 0);
  if (validTopics.length === 0) {
    alert('Please enter at least 1 topic (up to 10).');
    return;
  }

  // Open Animated Progress Modal with live indicators
  openGenerationModal(validTopics, companyName);

  try {
    const payload = {
      companyName,
      brandColor,
      logoUrl: currentLogoDataUrl,
      topics: validTopics,
      llmProvider: provider,
      apiKey: apiKey,
      authorName,
      authorRole,
      authorBio
    };

    const token = localStorage.getItem('wpg_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to start generation');
    }

    const data = await response.json();

    // If backend accepted as async job, connect to live SSE stream
    if (data.jobId) {
      connectToJobSSE(data.jobId, companyName);
    } else {
      // Synchronous fallback
      await completeProgressSteps(data);
      fetchAndRenderProjects();
    }
  } catch (err) {
    alert('Generation error: ' + err.message);
    closeGenerationModal();
  }
}

function openGenerationModal(topics, companyName) {
  const modal = document.getElementById('generation-modal');
  const title = document.getElementById('modal-title');
  const status = document.getElementById('modal-status');
  const stepsList = document.getElementById('progress-steps-list');
  const barFill = document.getElementById('progress-bar-fill');
  const pctLabel = document.getElementById('progress-percentage-label');

  modal.classList.remove('success');
  modal.classList.add('active');
  title.textContent = `Generating ${topics.length} Hosted Pages for ${companyName}`;
  status.textContent = 'Initializing generation engine and brand identity styling...';
  barFill.style.width = '5%';
  pctLabel.textContent = '5% Complete';

  stepsList.innerHTML = topics.map((t, idx) => `
    <li class="progress-step-item" id="step-item-${idx}">
      <span class="step-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </span>
      <span>Page ${idx + 1}: ${escapeHtml(t)} (~1,000 words)</span>
    </li>
  `).join('');
}

function connectToJobSSE(jobId, companyName) {
  if (activeEventSource) {
    activeEventSource.close();
  }

  const barFill = document.getElementById('progress-bar-fill');
  const pctLabel = document.getElementById('progress-percentage-label');
  const status = document.getElementById('modal-status');

  activeEventSource = new EventSource(`/api/jobs/${jobId}/stream`);

  activeEventSource.onmessage = async (event) => {
    try {
      const job = JSON.parse(event.data);
      if (typeof job.progress === 'number') {
        barFill.style.width = `${job.progress}%`;
        pctLabel.textContent = `${job.progress}% Complete`;
      }
      if (job.message) {
        status.textContent = job.message;
      }

      // Update step icons
      if (typeof job.currentStep === 'number' && job.currentStep > 0) {
        for (let i = 0; i < job.currentStep - 1; i++) {
          const item = document.getElementById(`step-item-${i}`);
          if (item && !item.classList.contains('done')) {
            item.classList.remove('active');
            item.classList.add('done');
            item.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`;
          }
        }
        const activeItem = document.getElementById(`step-item-${job.currentStep - 1}`);
        if (activeItem) {
          activeItem.classList.add('active');
        }
      }

      if (job.status === 'completed') {
        activeEventSource.close();
        activeEventSource = null;

        // Mark all steps done
        document.querySelectorAll('.progress-step-item').forEach(item => {
          item.classList.remove('active');
          item.classList.add('done');
          item.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`;
        });

        const modal = document.getElementById('generation-modal');
        modal.classList.add('success');
        document.getElementById('modal-title').textContent = 'All 10 Pages Hosted Successfully';
        status.textContent = `Your brand portal is now live with 10 dedicated 1000-word guides for ${companyName}.`;
        document.getElementById('modal-spinner').innerHTML = `
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="#10b981" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="16 10 11 15 8 12"/></svg>
        `;

        if (job.result && job.result.id) {
          document.getElementById('modal-view-hub-btn').href = `/sites/${job.result.id}`;
        }

        fetchAndRenderProjects();
      }

      if (job.status === 'failed') {
        activeEventSource.close();
        activeEventSource = null;
        alert(`Generation failed: ${job.error || 'Server error'}`);
        closeGenerationModal();
      }
    } catch (err) {
      console.warn('Error parsing SSE event:', err);
    }
  };

  activeEventSource.onerror = () => {
    // Fallback polling if SSE connection drops
    activeEventSource.close();
    activeEventSource = null;
    pollJobStatus(jobId, companyName);
  };
}

async function pollJobStatus(jobId, companyName) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) {
      const job = await res.json();
      if (job.status === 'completed') {
        const modal = document.getElementById('generation-modal');
        modal.classList.add('success');
        document.getElementById('modal-title').textContent = 'All 10 Pages Hosted Successfully';
        if (job.result && job.result.id) {
          document.getElementById('modal-view-hub-btn').href = `/sites/${job.result.id}`;
        }
        fetchAndRenderProjects();
      } else if (job.status === 'failed') {
        alert('Generation failed: ' + job.error);
        closeGenerationModal();
      } else {
        setTimeout(() => pollJobStatus(jobId, companyName), 1500);
      }
    }
  } catch (err) {
    console.warn('Polling error:', err);
  }
}

async function completeProgressSteps(project) {
  const articles = project.articles || [];
  const barFill = document.getElementById('progress-bar-fill');
  const pctLabel = document.getElementById('progress-percentage-label');
  const status = document.getElementById('modal-status');

  for (let i = 0; i < articles.length; i++) {
    const item = document.getElementById(`step-item-${i}`);
    if (item) {
      item.classList.add('active');
      await delay(100);
      item.classList.remove('active');
      item.classList.add('done');
      item.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`;
      const pct = Math.round(((i + 1) / articles.length) * 100);
      barFill.style.width = `${pct}%`;
      pctLabel.textContent = `${pct}% Complete`;
      status.textContent = `Hosted Page ${i + 1} of ${articles.length} compiled (${articles[i].wordCount} words)`;
    }
  }

  const modal = document.getElementById('generation-modal');
  modal.classList.add('success');
  document.getElementById('modal-title').textContent = 'All 10 Pages Hosted Successfully';
  status.textContent = `Your brand portal is now live with 10 dedicated 1000-word guides for ${project.companyName}.`;
  document.getElementById('modal-spinner').innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" stroke="#10b981" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="16 10 11 15 8 12"/></svg>
  `;
  document.getElementById('modal-view-hub-btn').href = `/sites/${project.id}`;
}

function closeGenerationModal() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  document.getElementById('generation-modal').classList.remove('active');
}

// -----------------------------------------------------------------------------
// Directory Search & Pagination
// -----------------------------------------------------------------------------
function handleDirectorySearch(query) {
  clearTimeout(searchDebounceTimer);
  const clearBtn = document.getElementById('dir-search-clear');
  if (clearBtn) {
    clearBtn.style.display = query ? 'inline-block' : 'none';
  }

  searchDebounceTimer = setTimeout(() => {
    currentSearchQuery = query.trim();
    currentPage = 1;
    fetchAndRenderProjects();
  }, 250);
}

function clearDirectorySearch() {
  const input = document.getElementById('dir-search-input');
  if (input) input.value = '';
  document.getElementById('dir-search-clear').style.display = 'none';
  currentSearchQuery = '';
  currentPage = 1;
  fetchAndRenderProjects();
}

function formatExpiryTime(expiresAt) {
  if (!expiresAt) return 'No expiry';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 0) return `Expires in ${diffHours}h ${diffMins}m`;
  return `Expires in ${diffMins}m`;
}

function goToPage(page) {
  if (page < 1 || page > currentTotalPages) return;
  currentPage = page;
  fetchAndRenderProjects();
}

function setDirectoryFilter(filter) {
  if (filter === 'mine' || filter === 'trash') {
    if (!currentUser) {
      openAuthModal('login');
      alert('Sign in required: Only logged-in users can view their private sites or restore deleted campaigns.');
      return;
    }
  }

  currentDirectoryFilter = filter;
  document.querySelectorAll('.dir-filter-btn').forEach(b => b.classList.remove('active'));

  if (filter === 'mine') {
    document.getElementById('filter-my-sites-btn').classList.add('active');
  } else if (filter === 'trash') {
    document.getElementById('filter-trash-btn').classList.add('active');
  } else {
    document.getElementById('filter-all-sites-btn').classList.add('active');
  }

  currentPage = 1;
  fetchAndRenderProjects();
}

async function fetchAndRenderProjects() {
  try {
    const token = localStorage.getItem('wpg_auth_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let url = `/api/projects?page=${currentPage}&limit=9`;
    if (currentDirectoryFilter === 'mine') url += '&mine=true&status=active';
    else if (currentDirectoryFilter === 'trash') url += '&mine=true&status=deleted';
    else url += '&status=active';

    if (currentSearchQuery) url += `&search=${encodeURIComponent(currentSearchQuery)}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const data = await res.json();

    const projects = Array.isArray(data) ? data : (data.projects || []);
    const pagination = data.pagination || { total: projects.length, page: 1, totalPages: 1 };

    currentTotalPages = pagination.totalPages || 1;
    document.getElementById('header-sites-count').textContent = pagination.total || projects.length;

    renderProjectsGrid(projects);
    renderPaginationBar(pagination);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
}

function renderPaginationBar(pagination) {
  const container = document.getElementById('directory-pagination');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  document.getElementById('page-indicator').textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
  document.getElementById('btn-page-prev').disabled = pagination.page <= 1;
  document.getElementById('btn-page-next').disabled = pagination.page >= pagination.totalPages;
}

function renderProjectsGrid(projects) {
  const grid = document.getElementById('sites-grid');
  if (!projects || projects.length === 0) {
    const msg = currentDirectoryFilter === 'trash'
      ? 'Your trash is empty. Deleted campaigns appear here for 24 hours before automatic purge.'
      : (currentSearchQuery ? 'No results matched your search term.' : 'Use the generator above to create your first branded multi-page publication!');

    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:50px; background:rgba(255,255,255,0.03); border:1px dashed var(--border-subtle); border-radius:16px;">
        <h4 style="font-size:1.2rem; margin-bottom:8px;">${currentDirectoryFilter === 'trash' ? 'Trash is Empty' : 'No hosted campaigns found'}</h4>
        <p style="color:var(--text-muted); font-size:0.95rem;">${msg}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(proj => {
    const articles = proj.articles || [];
    const totalWords = articles.reduce((sum, a) => sum + (a.wordCount || 0), 0);
    const authorName = proj.author?.name || proj.ownerName || 'Editorial Team';

    // Status & Expiry Badge
    let statusBadge = '';
    if (proj.isPermanent) {
      statusBadge = `<span class="site-permanent-badge" title="Permanent Benchmark Platform">Permanent Demo</span>`;
    } else if (proj.isDeleted) {
      statusBadge = `<span class="site-deleted-badge" title="In trash (restore within 24h)">In Trash</span>`;
    } else {
      statusBadge = `<span class="site-expiry-badge" title="Auto-expires in 24 hours. Export ZIP to keep permanently."><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${formatExpiryTime(proj.expiresAt)}</span>`;
    }

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
            <div class="site-card-badge-row">
              ${statusBadge}
              <span style="font-size:0.75rem; color:var(--text-muted);">Author: <strong>${escapeHtml(authorName)}</strong></span>
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
          ${proj.isDeleted ? `
            <button type="button" class="btn btn-undelete-site" onclick="handleUndeleteProject('${proj.id}')" title="Restore this campaign from trash">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>Undelete / Restore</span>
            </button>
            <a href="/api/projects/${proj.id}/export" class="btn btn-outline" title="Export Static ZIP Bundle">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export ZIP</span>
            </a>
          ` : `
            <a href="/sites/${proj.id}" target="_blank" class="btn btn-brand">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Open Brand Hub</span>
            </a>

            <button type="button" class="btn btn-outline" onclick="openCampaignManager('${proj.id}')" title="Manage articles and brand">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Manage &amp; Edit</span>
            </button>

            <a href="/api/projects/${proj.id}/export" class="btn btn-outline" title="Export Static ZIP Bundle">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export ZIP</span>
            </a>

            <button type="button" class="btn btn-outline" onclick="copySiteLink('${proj.id}', this)" title="Copy Hub URL">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            
            ${(proj.isOwner && !proj.isPermanent) ? `
              <button type="button" class="btn-delete-site" onclick="deleteProject('${proj.id}')" title="Move to trash (can undelete within 24 hours)">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Delete Site</span>
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Undelete / Restore Project
async function handleUndeleteProject(id) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const token = localStorage.getItem('wpg_auth_token');
  try {
    const res = await fetch(`/api/projects/${id}/undelete`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (res.ok) {
      alert('Campaign restored successfully! It is now active again.');
      fetchAndRenderProjects();
    } else {
      alert(data.error || 'Failed to restore campaign.');
    }
  } catch (err) {
    alert('Failed to undelete: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// Interactive Campaign & Article Content Manager
// -----------------------------------------------------------------------------
async function openCampaignManager(projectId) {
  if (!currentUser) {
    openAuthModal('login');
    alert('Sign in required: Only logged-in users can edit articles and campaigns.');
    return;
  }

  try {
    const token = localStorage.getItem('wpg_auth_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(`/api/projects/${projectId}`, { headers });
    if (!res.ok) throw new Error('Failed to load campaign');

    const project = await res.json();
    activeManagingProject = project;

    document.getElementById('manager-site-title').textContent = project.companyName;
    document.getElementById('manager-site-meta').textContent = `${project.brandColor} • ${project.articles.length} Hosted Pages • Created ${new Date(project.createdAt).toLocaleDateString()}`;

    showArticleListView();
    renderManagerArticlesTable(project);

    document.getElementById('manager-modal').classList.add('active');
  } catch (err) {
    alert('Error loading manager: ' + err.message);
  }
}

function closeManagerModal() {
  document.getElementById('manager-modal').classList.remove('active');
  activeManagingProject = null;
}

function showArticleListView() {
  document.getElementById('manager-articles-list-view').style.display = 'block';
  document.getElementById('manager-article-edit-view').style.display = 'none';
}

function renderManagerArticlesTable(project) {
  const tbody = document.getElementById('manager-articles-tbody');
  const articles = project.articles || [];

  tbody.innerHTML = articles.map((art, idx) => `
    <tr>
      <td style="font-weight:700; color:var(--text-secondary);">${idx + 1}</td>
      <td>
        <span class="article-row-title">${escapeHtml(art.title)}</span>
        <span class="article-row-slug">/sites/${project.id}/blog/${art.slug}</span>
      </td>
      <td><strong>${(art.wordCount || 0).toLocaleString()}</strong></td>
      <td>${art.readingTime || '~8 min'}</td>
      <td style="text-align:right;">
        <a href="/sites/${project.id}/blog/${art.slug}" target="_blank" class="btn-table-action btn-table-action-view" title="View live page">
          View
        </a>
        <button type="button" class="btn-table-action btn-table-action-edit" onclick="openArticleEditor('${art.slug}')">
          Edit Content
        </button>
        <button type="button" class="btn-table-action btn-table-action-regen" onclick="regenerateArticle('${project.id}', '${art.slug}', this)" title="Regenerate this single article">
          Regenerate
        </button>
      </td>
    </tr>
  `).join('');
}

// Open WYSIWYG / Content Editor for an article
function openArticleEditor(slug) {
  if (!activeManagingProject) return;
  const article = (activeManagingProject.articles || []).find(a => a.slug === slug);
  if (!article) return;

  document.getElementById('edit-article-slug').value = article.slug;
  document.getElementById('edit-article-title').value = article.title;
  document.getElementById('edit-article-summary').value = article.summary || '';
  document.getElementById('edit-article-readingTime').value = article.readingTime || '~8 min read';

  const sectionsContainer = document.getElementById('edit-article-sections-container');
  sectionsContainer.innerHTML = (article.sections || []).map((sec, sIdx) => `
    <div class="section-edit-card">
      <div class="section-edit-card-header">Section ${sIdx + 1}</div>
      <input type="text" class="form-control-input section-h2-input" data-section="${sIdx}" value="${escapeHtmlAttr(sec.h2 || '')}" placeholder="Section heading..." style="margin-bottom:8px; font-weight:700;" />
      <textarea class="form-control-input section-paragraphs-input" data-section="${sIdx}" rows="4" placeholder="Paragraphs content (paragraphs separated by blank line)...">${escapeHtml((sec.subsections || []).map(sub => (sub.paragraphs || []).join('\n\n')).join('\n\n'))}</textarea>
    </div>
  `).join('');

  document.getElementById('manager-articles-list-view').style.display = 'none';
  document.getElementById('manager-article-edit-view').style.display = 'block';
}

async function handleSaveArticleEdits(e) {
  e.preventDefault();
  if (!activeManagingProject) return;

  const slug = document.getElementById('edit-article-slug').value;
  const title = document.getElementById('edit-article-title').value.trim();
  const summary = document.getElementById('edit-article-summary').value.trim();
  const readingTime = document.getElementById('edit-article-readingTime').value.trim();

  // Read modified sections
  const existingArticle = (activeManagingProject.articles || []).find(a => a.slug === slug);
  const sections = (existingArticle?.sections || []).map((sec, sIdx) => {
    const h2Input = document.querySelector(`.section-h2-input[data-section="${sIdx}"]`);
    const pTextarea = document.querySelector(`.section-paragraphs-input[data-section="${sIdx}"]`);

    const newH2 = h2Input ? h2Input.value.trim() : sec.h2;
    const rawParagraphs = pTextarea ? pTextarea.value.split('\n\n').map(p => p.trim()).filter(Boolean) : [];

    return {
      ...sec,
      h2: newH2,
      subsections: [
        {
          h3: sec.subsections && sec.subsections[0] ? sec.subsections[0].h3 : 'Core Insights',
          paragraphs: rawParagraphs.length > 0 ? rawParagraphs : (sec.subsections && sec.subsections[0] ? sec.subsections[0].paragraphs : [])
        }
      ]
    };
  });

  const payload = {
    title,
    summary,
    readingTime,
    sections
  };

  const token = localStorage.getItem('wpg_auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const submitBtn = document.getElementById('btn-save-article-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Changes...';

  try {
    const res = await fetch(`/api/projects/${activeManagingProject.id}/articles/${slug}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update article');

    // Update local cache
    activeManagingProject = data.project;
    renderManagerArticlesTable(activeManagingProject);
    showArticleListView();
    fetchAndRenderProjects();
    alert('Article updated successfully!');
  } catch (err) {
    alert('Error saving article: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Live Changes';
  }
}

// 1-Click Single Article Regeneration
async function regenerateArticle(projectId, slug, btn) {
  if (!confirm('Regenerate this specific article with freshly synthesized content?')) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating...';

  const token = localStorage.getItem('wpg_auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(`/api/projects/${projectId}/articles/${slug}/regenerate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate article');

    activeManagingProject = data.project;
    renderManagerArticlesTable(activeManagingProject);
    fetchAndRenderProjects();
    alert('Article regenerated successfully with 1000+ words!');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// -----------------------------------------------------------------------------
// Edit Campaign Brand Modal
// -----------------------------------------------------------------------------
function openEditBrandModal() {
  if (!activeManagingProject) return;
  document.getElementById('update-brand-site-id').value = activeManagingProject.id;
  document.getElementById('update-company-name').value = activeManagingProject.companyName;
  document.getElementById('update-brand-hex').value = activeManagingProject.brandColor;
  document.getElementById('update-brand-picker').value = activeManagingProject.brandColor;
  document.getElementById('update-author-name').value = activeManagingProject.author?.name || '';
  document.getElementById('update-author-role').value = activeManagingProject.author?.role || '';
  document.getElementById('update-author-bio').value = activeManagingProject.author?.bio || '';

  document.getElementById('edit-brand-modal').classList.add('active');
}

function closeEditBrandModal() {
  document.getElementById('edit-brand-modal').classList.remove('active');
}

async function handleUpdateBrandSubmit(e) {
  e.preventDefault();
  const siteId = document.getElementById('update-brand-site-id').value;
  const companyName = document.getElementById('update-company-name').value.trim();
  const brandColor = document.getElementById('update-brand-hex').value.trim();
  const authorName = document.getElementById('update-author-name').value.trim();
  const authorRole = document.getElementById('update-author-role').value.trim();
  const authorBio = document.getElementById('update-author-bio').value.trim();

  const payload = {
    companyName,
    brandColor,
    authorName,
    authorRole,
    authorBio
  };

  const token = localStorage.getItem('wpg_auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const btn = document.getElementById('btn-update-brand-submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/projects/${siteId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update branding');

    activeManagingProject = data.project;
    document.getElementById('manager-site-title').textContent = data.project.companyName;
    closeEditBrandModal();
    fetchAndRenderProjects();
    alert('Campaign branding updated successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Brand Changes';
  }
}

// -----------------------------------------------------------------------------
// Project Deletion & Link Copy
// -----------------------------------------------------------------------------
async function deleteProject(id) {
  if (!currentUser) {
    openAuthModal('login');
    alert('Sign in required: Only logged-in owners can delete their hosted campaigns.');
    return;
  }

  if (!confirm('Move this hosted campaign to trash? You can undelete / restore it within 24 hours from the Trash tab.')) {
    return;
  }
  const token = localStorage.getItem('wpg_auth_token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (res.ok) {
      alert('Campaign moved to trash. You can undelete it anytime within 24 hours!');
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
