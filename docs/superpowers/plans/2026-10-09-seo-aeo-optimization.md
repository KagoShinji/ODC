# SEO & AEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full-spectrum SEO and AEO optimizations for OdysseyPH IT Solutions to achieve high organic search rankings and prominent generative AI citations across Google, ChatGPT Search, Perplexity, and Claude.

**Architecture:** Implement root crawler configurations (`robots.txt`, `sitemap.xml`, `llms.txt`), inject multi-schema JSON-LD Knowledge Graph in `index.html`, remove bot-blocking render delays from the splash screen in `App.jsx`, add dynamic per-route metadata via `usePageSEO`, and build an on-page direct-answer FAQ engine.

**Tech Stack:** React (Vite SPA), Schema.org JSON-LD, Phosphor / Lucide Icons, Framer Motion, XML / Markdown.

**Spec:** `docs/superpowers/specs/2026-10-09-seo-aeo-optimization-design.md`

## Global Constraints

- Domain canonical root is `https://odysseyph.com`.
- Protected routes (`/portal/*`, `/odc/*`, `/acceptance/*`, `/moa/*`, `/invoice/*`, `/feedback/*`) must be disallowed in `robots.txt`.
- No breaking changes to existing client routing, portals, or admin suites.
- Code must pass `npm run build` with zero errors.

## Review Focus

- **Bot detection in splash screen**: Web crawlers without standard user-agent headers must not be blocked indefinitely from rendering DOM content.
- **Valid XML sitemap formatting**: `sitemap.xml` must strictly conform to the Sitemaps XML schema with proper namespaces and dates.
- **Valid JSON-LD Schema graph**: Multiple entity types (`ProfessionalService`, `Organization`, `SoftwareApplication`, `FAQPage`) must parse cleanly without syntax errors or broken `@context` definitions.
- **Head metadata cleanup on route changes**: `usePageSEO` must cleanly update `<title>`, `<meta name="description">`, `<link rel="canonical">`, and OpenGraph tags without leaving stale duplicate tags.
- **Mobile responsiveness of FAQ accordion**: The newly created FAQ component must render fluidly on both small mobile devices and desktop viewports.

---

### Task 1: Technical Crawlability & LLM Protocol Files

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`
- Create: `public/llms.txt`
- Create: `public/llms-full.txt`

**Interfaces:**
- Consumes: None
- Produces: Public HTTP static endpoints at `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/llms-full.txt`.

- [ ] **Step 1: Create `public/robots.txt` with search bot and AI crawler directives**

Include explicit allow rules for `Googlebot`, `Bingbot`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Applebot-Extended`, `Google-Extended`. Disallow `/portal/`, `/odc/`, `/acceptance/`, `/moa/`, `/invoice/`, `/feedback/`. Declare `Sitemap: https://odysseyph.com/sitemap.xml`.

- [ ] **Step 2: Create `public/sitemap.xml`**

Generate valid XML with canonical entries for `/`, `/services`, `/portfolio`, `/about`, and `/contact` with appropriate priority and changefreq tags.

- [ ] **Step 3: Create `public/llms.txt` and `public/llms-full.txt`**

Write standard markdown manifests detailing OdysseyPH's identity, core service verticals (Clinic Management Systems, ODC-Courts sports booking, custom enterprise platforms), technology stack, live project citations, and contact options.

- [ ] **Step 4: Verify static file accessibility**

Run: `ls -la public/robots.txt public/sitemap.xml public/llms.txt public/llms-full.txt`
Expected: All 4 files exist with non-zero byte size.

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt public/sitemap.xml public/llms.txt public/llms-full.txt
git commit -m "feat(seo): add robots.txt, sitemap.xml, and llms.txt protocol files"
```

---

### Task 2: Crawler-Friendly Splash Screen & Core Web Vitals Optimization

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `sessionStorage`, `navigator.userAgent`
- Produces: Instant DOM rendering for crawlers and returning visitors, preserving first-time human animations.

- [ ] **Step 1: Update `PublicSite` in `src/App.jsx` to bypass splash screen for bots & repeat sessions**

Detect bot signatures (`bot`, `crawler`, `spider`, `google`, `bing`, `gpt`, `perplexity`, `claude`) and check `sessionStorage.getItem('odc_splash_seen')`. If a bot or repeat human visit, initialize `isLoading` to `false`. Otherwise, trigger the splash screen and set the session flag on finish.

- [ ] **Step 2: Verify `App.jsx` renders without runtime errors**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "perf(seo): optimize splash screen for crawler indexing and repeat visits"
```

---

### Task 3: Semantic Multi-Schema JSON-LD Knowledge Graph in `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: Schema.org specifications
- Produces: Embedded JSON-LD graph with `ProfessionalService`, `Organization`, `SoftwareApplication` (ODC-Courts, Clinic Management System), `WebSite`, and `hasOfferCatalog`.

- [ ] **Step 1: Add canonical link, robots meta, and comprehensive JSON-LD Knowledge Graph in `index.html`**

Inject:
1. `<link rel="canonical" href="https://odysseyph.com/" />`
2. `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`
3. `<script type="application/ld+json">` containing full `@graph` structure with `ProfessionalService`, `Organization`, `SoftwareApplication` (ODC-Courts and Clinic Suite), `hasOfferCatalog`, and geographic `areaServed`.

- [ ] **Step 2: Validate JSON-LD syntax**

Run: `node -e "const fs = require('fs'); const html = fs.readFileSync('index.html', 'utf8'); const match = html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/); JSON.parse(match[1]); console.log('JSON-LD valid!');"`
Expected: Output `JSON-LD valid!`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(seo): embed multi-schema JSON-LD knowledge graph in index.html"
```

---

### Task 4: Dynamic Route-Level Metadata Hook (`usePageSEO`)

**Files:**
- Create: `src/hooks/usePageSEO.js`
- Modify: `src/pages/Home.jsx`
- Modify: `src/pages/About.jsx`
- Modify: `src/pages/Services.jsx`
- Modify: `src/pages/Portfolio.jsx`
- Modify: `src/pages/Contact.jsx`

**Interfaces:**
- Consumes: Page title, description, canonical path, optional image
- Produces: Synchronized `document.title`, `<meta name="description">`, `<link rel="canonical">`, and OpenGraph/Twitter tags.

- [ ] **Step 1: Create `src/hooks/usePageSEO.js`**

Implement a clean React hook that takes `{ title, description, canonicalPath, ogImage }` and dynamically updates document title and head tags via standard DOM manipulation on mount and route transition.

- [ ] **Step 2: Connect `usePageSEO` to `Home.jsx`, `About.jsx`, `Services.jsx`, `Portfolio.jsx`, and `Contact.jsx`**

Apply custom metadata per page:
- `Home`: Title `OdysseyPH IT Solutions | Custom Web & Software Systems Philippines`
- `Services`: Title `Services & Engineering | OdysseyPH IT Solutions - Web, Mobile & Cloud`
- `Portfolio`: Title `Selected Systems & Case Studies | OdysseyPH IT Solutions`
- `About`: Title `About OdysseyPH | Digital Transformation & Tech Studio Philippines`
- `Contact`: Title `Start a Project | OdysseyPH IT Solutions - Cebu, Philippines`

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePageSEO.js src/pages/Home.jsx src/pages/About.jsx src/pages/Services.jsx src/pages/Portfolio.jsx src/pages/Contact.jsx
git commit -m "feat(seo): implement dynamic per-route usePageSEO hook"
```

---

### Task 5: High-Intent FAQ Direct-Answer Component & Vertical AEO Sections

**Files:**
- Create: `src/components/sections/FAQ.jsx`
- Modify: `src/pages/Home.jsx`
- Modify: `src/pages/Services.jsx`
- Modify: `src/components/sections/Portfolio.jsx`

**Interfaces:**
- Consumes: Direct-answer question & answer data formatted for AEO
- Produces: Interactive FAQ accordion with embedded `FAQPage` Schema.org microdata, and keyword-rich project alt tags.

- [ ] **Step 1: Create `src/components/sections/FAQ.jsx`**

Build a modern, dark/ambient styled FAQ accordion with the 6 verified direct-answer questions from the spec. Embed page-level `FAQPage` JSON-LD for rich snippets and answer engine extraction.

- [ ] **Step 2: Integrate FAQ section into `Home.jsx` and `Services.jsx`**

Render `<FAQSection />` before the Final CTA in `Home.jsx` and at the bottom of `Services.jsx`.

- [ ] **Step 3: Upgrade project image alt attributes in `Portfolio.jsx` and `Home.jsx`**

Enrich image `alt` texts to include specific location and system vertical keywords (e.g., *"ODC-Courts multi-location pickleball court booking platform in Cebu"*, *"CPRMed medical clinic website by OdysseyPH"*).

- [ ] **Step 4: Verify build and formatting**

Run: `npm run build`
Expected: Build passes cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/FAQ.jsx src/pages/Home.jsx src/pages/Services.jsx src/components/sections/Portfolio.jsx
git commit -m "feat(aeo): add direct-answer FAQ section and enrich semantic project alt tags"
```

---

### Task 6: End-to-End Verification & Quality Audit

**Files:**
- Test / Verify all created and modified assets.

- [ ] **Step 1: Run comprehensive build & lint validation**

Run: `npm run build`
Expected: Clean exit code 0.

- [ ] **Step 2: Verify static crawler files accessibility**

Run: `node -e "const fs = require('fs'); ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt'].forEach(f => { if (!fs.existsSync('public/' + f)) throw new Error(f + ' missing'); }); console.log('All static crawler assets present.');"`
Expected: `All static crawler assets present.`

- [ ] **Step 3: Validate JSON-LD structures across index.html and FAQ**

Confirm all `@type`, `@context`, and string values are well-formed JSON.

- [ ] **Step 4: Final commit & status check**

```bash
git status
```
