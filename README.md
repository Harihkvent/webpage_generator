# ⚡ Webpage Generator & Multi-Site 10-Topic Blog Platform

An automated web publishing portal that allows users to configure a company's brand identity, enter up to 10 topics, and instantly generate, style, and host 10 dedicated 1000+ word blog posts with consistent layouts and custom brand colors.

---

## 🌟 Key Features

1. **Brand Identity Configuration**:
   - **Company Name**: Dynamic branding across page titles, headers, author metadata, callouts, and footers.
   - **Logo Image**: Drag-and-drop file upload (PNG, SVG, JPG, WebP), direct image URL, or automatic SVG monogram generation.
   - **Brand Colour in Hex Format**: Visual color picker + real-time Hex code input with live validation (`#HEX`), contrast ratio calculation (white or dark text), and 8 curated designer palettes (Electric Indigo, Ocean Sapphire, Emerald Pulse, Cyber Violet, Sunset Coral, Rose Quartz, Amber Gold, Titanium Teal).
   - **Live Brand Preview**: Instant preview card reacting in real time to color, logo, and company changes.

2. **10 Dedicated Hosted Blog Pages**:
   - Each topic receives its own dedicated URL (`/sites/:siteId/blog/:slug`).
   - Every page features a well-formatted **1000+ word structured article** containing:
     - Executive summary callout box with key takeaways
     - Table of contents
     - 5 detailed thematic sections with H2 and H3 subheadings
     - Comparative benchmark matrices and data tables
     - Operational readiness checklists
     - Interactive FAQ accordions
     - Author metadata, publication date, reading time estimate, and word count badge
     - Next & Previous article navigation to browse between the 10 topics
     - Sidebar with all other hosted topics in the campaign
     - Sticky top reading progress bar that fills dynamically as you scroll

3. **Consistent Brand Layout**:
   - Unified Header with uploaded/generated logo, company name, navigation, and branded CTA button.
   - Dynamic CSS variable injection: `--brand-color`, `--brand-hover`, `--brand-light`, `--brand-soft-bg`, `--brand-border`.
   - Unified Footer with brand info, quick links to all 10 topics, and newsletter signup.

4. **Multi-Use Case Support**:
   - Create unlimited different brands/campaigns (e.g., B2B Cloud SaaS, CleanTech & Solar, FinTech & Wealth, Health & Longevity).
   - Built-in campaign directory displaying all hosted platforms with word counts, brand swatches, and direct links.
   - 1-click Quick Presets for immediate demonstration.
   - Export any campaign as a standalone static ZIP containing all 10 HTML pages, stylesheets, and scripts for external hosting on GitHub Pages, Netlify, or Vercel.

---

## 🚀 Getting Started

### 1. Installation
Navigate into the `webpage_generator` directory:
```bash
cd webpage_generator
npm install
```

### 2. Run the Platform
```bash
npm start
```
The server will start at:
- **Studio Generator Portal**: `http://localhost:5050`
- **Hosted Brand Hub Demo**: `http://localhost:5050/sites/site-apex-cloud-systems-seed`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Studio Dashboard Web Interface |
| `GET` | `/api/projects` | List all created brand campaigns |
| `GET` | `/api/projects/:id` | Get single campaign metadata and 10 articles |
| `POST` | `/api/projects` | Generate and host 10 pages for a new brand |
| `DELETE` | `/api/projects/:id` | Delete a campaign and its hosted pages |
| `GET` | `/api/projects/:id/export` | Download standalone static HTML ZIP bundle |
| `GET` | `/sites/:siteId` | Hosted Brand Publication Hub (listing all 10 posts) |
| `GET` | `/sites/:siteId/blog/:slug` | Dedicated 1000-word hosted topic page |
