/**
 * studio.js
 * Logic for Webpage Generator Studio Portal
 */

// Multi-use case presets data
const PRESETS = {
  saas: {
    companyName: 'Apex Cloud Systems',
    brandColor: '#6366F1',
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Load default SaaS preset
  loadPreset('saas');
  // Fetch existing projects
  fetchAndRenderProjects();
});

// Smooth scroll utility
function scrollToSection(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.scrollIntoView({ behavior: 'smooth' });
  }
}

// Load a preset for instant multi-use testing
function loadPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  document.getElementById('company-name').value = preset.companyName;
  document.getElementById('brand-color-hex').value = preset.brandColor;
  document.getElementById('brand-color-picker').value = preset.brandColor;
  currentLogoDataUrl = preset.logoUrl;

  const previewImg = document.getElementById('logo-preview-img');
  const dropPlaceholder = document.getElementById('logo-dropzone-placeholder');
  previewImg.src = preset.logoUrl;
  previewImg.style.display = 'block';
  dropPlaceholder.style.display = 'none';

  // Highlight active preset color swatch if matches
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
      >&times;</button>
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
    alert('Please enter a Company Name first so we can suggest relevant topics!');
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
    const bg = btn.style.backgroundColor;
    // approximate match
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

  // Update company name
  document.getElementById('sim-company-name').textContent = company;
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
    // Generate monogram
    const initials = company.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'CO';
    simLogo.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='6' fill='${encodeURIComponent(hex)}'/><text x='16' y='21' font-family='sans-serif' font-weight='800' font-size='14' fill='${encodeURIComponent(contrast)}' text-anchor='middle'>${initials}</text></svg>`;
  }
}

// Handle Form Submission: Generate 10 Hosted Pages
async function handleGenerateSubmit(e) {
  e.preventDefault();

  const companyName = document.getElementById('company-name').value.trim();
  const brandColor = document.getElementById('brand-color-hex').value.trim();
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

  // Open Animated Progress Modal
  openGenerationModal(validTopics, companyName);

  try {
    const payload = {
      companyName,
      brandColor,
      logoUrl: currentLogoDataUrl,
      topics: validTopics,
      llmProvider: provider,
      apiKey: apiKey
    };

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to generate pages');
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

// Modal Progress Control
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
      <span class="step-icon">⏳</span>
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
      item.querySelector('.step-icon').textContent = '✍️';
      await delay(120); // Smooth visual progression
      item.classList.remove('active');
      item.classList.add('done');
      item.querySelector('.step-icon').textContent = '✅';
      const pct = Math.round(((i + 1) / articles.length) * 100);
      barFill.style.width = `${pct}%`;
      status.textContent = `Hosted Page ${i + 1} of ${articles.length} compiled (${articles[i].wordCount} words)`;
    }
  }

  // Done
  const modal = document.getElementById('generation-modal');
  modal.classList.add('success');
  document.getElementById('modal-title').textContent = '🎉 All 10 Pages Hosted Successfully!';
  status.textContent = `Your brand portal is now live with 10 dedicated 1000-word guides for ${project.companyName}.`;
  document.getElementById('modal-spinner').innerHTML = '🚀';

  const viewHubBtn = document.getElementById('modal-view-hub-btn');
  viewHubBtn.href = `/sites/${project.id}`;
}

function closeGenerationModal() {
  document.getElementById('generation-modal').classList.remove('active');
}

// Fetch and render existing projects (Multi-use-case platform support)
async function fetchAndRenderProjects() {
  try {
    const res = await fetch('/api/projects');
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
        <h4 style="font-size:1.2rem; margin-bottom:8px;">No hosted sites created yet</h4>
        <p style="color:var(--text-muted); font-size:0.95rem;">Use the generator above or pick one of the quick presets to generate your first 10-page brand publication!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(proj => {
    const articles = proj.articles || [];
    const totalWords = articles.reduce((sum, a) => sum + (a.wordCount || 0), 0);
    const dateFormatted = new Date(proj.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
            <span>🌐</span> Open Brand Hub
          </a>
          <button type="button" class="btn btn-outline" onclick="copySiteLink('${proj.id}', this)">
            <span>📋</span> Copy URL
          </button>
          <button type="button" class="btn-delete-site" onclick="deleteProject('${proj.id}')">
            🗑️ Delete Campaign
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this hosted campaign and all its pages?')) return;
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchAndRenderProjects();
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
      btn.innerHTML = '<span>✅</span> Copied!';
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
