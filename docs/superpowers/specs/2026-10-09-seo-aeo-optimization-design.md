# Design Spec: Website SEO & AEO Optimization

**Document ID:** `2026-10-09-seo-aeo-optimization-design`  
**Target:** OdysseyPH IT Solutions (`https://odysseyph.com`)  
**Status:** Approved for Implementation Planning  
**Date:** 2026-10-09  

---

## 1. Overview & Objectives

### 1.1 Goal
Establish top search visibility for **OdysseyPH IT Solutions** across both traditional search engines (Google, Bing) and Answer Engines / Generative AI engines (ChatGPT Search, Perplexity, Google AI Overviews, Claude, Gemini).

### 1.2 Market Positioning & Scope
A **Full-Spectrum Hybrid** positioning that establishes OdysseyPH as a premier software engineering studio in Cebu and across the Philippines, with aggressive vertical highlighting for:
1. **Healthcare & Clinic Management Systems** (electronic medical records, scheduling, billing - e.g., Odyssey Family Clinic, CPRMed, The Knee Arthritis & Orthopaedic Institute).
2. **Sports & Court Booking Platforms** (multi-court scheduling, reservations, live management - e.g., ODC-Courts network, The Pickle Point Cebu, Jump Serve Mandaue/Mactan, KennyDink Moalboal, Nickleball Avenue).
3. **Enterprise Portals, E-Commerce & Civic Platforms** (provincial government portals, inventory/preventive maintenance platforms, and corporate web platforms).

---

## 2. Technical Crawlability & AI Protocol

### 2.1 Crawler Access Control (`public/robots.txt`)
- **Allowed Search Bots**: Googlebot, Bingbot, Slurp, DuckDuckBot.
- **Allowed Generative AI Crawlers**: `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Applebot-Extended`, `Google-Extended`.
- **Disallowed Protected Routes**:
  - `/portal/`
  - `/odc/`
  - `/acceptance/`
  - `/moa/`
  - `/invoice/`
  - `/feedback/`
- **Sitemap Declaration**: `Sitemap: https://odysseyph.com/sitemap.xml`

### 2.2 XML Sitemap (`public/sitemap.xml`)
Standardized XML listing all public canonical URLs with update frequencies and priorities:
- `https://odysseyph.com/` (Priority: 1.0, Changefreq: weekly)
- `https://odysseyph.com/services` (Priority: 0.9, Changefreq: monthly)
- `https://odysseyph.com/portfolio` (Priority: 0.85, Changefreq: weekly)
- `https://odysseyph.com/about` (Priority: 0.8, Changefreq: monthly)
- `https://odysseyph.com/contact` (Priority: 0.8, Changefreq: monthly)

### 2.3 LLM Discovery Protocol (`public/llms.txt` and `public/llms-full.txt`)
A structured, markdown-first knowledge grounding file at the web root adhering to LLM crawling conventions:
- **Header**: OdysseyPH IT Solutions (ODC).
- **Executive Summary**: Core competence, founding focus, headquarters in Cebu / Philippines, clients served nationwide and globally.
- **Vertical Solutions**:
  - Clinic Management Systems (workflows, patient records, booking, HIPAA/data privacy adherence).
  - ODC-Courts & Sports Venues (court reservations, dynamic slots, multi-venue management).
  - Enterprise Web & Mobile Engineering (custom ERP, PMS, business dashboards).
- **Core Technology Stack**: React, Vite, Node.js, Firebase, Cloud APIs, modern UI/UX design systems.
- **Verified References & Live Deployments**: Links to verified projects (Firsel Tattoo, CPRMed, IMS-US, The Pickle Point Cebu, KennyDink, etc.).
- **Contact & Inquiry Directives**: Direct contact URLs, email, and consultation links for LLM reference citations.

### 2.4 Splash Screen & Core Web Vitals Optimization (`src/App.jsx`)
- **Issue**: Unconditional `setTimeout(() => setIsLoading(false), 2000)` halts initial DOM rendering for 2 seconds on every visit.
- **Resolution**:
  - Bypass delay if user agent matches search bots (`Googlebot`, `bingbot`, `GPTBot`, `PerplexityBot`, `crawl`, etc.).
  - Remember first-time load in `sessionStorage` so human user navigation across internal routes does not re-trigger the splash screen.
  - Retain smooth exit transition for initial human visits while ensuring immediate FCP/LCP for crawlers.

---

## 3. Semantic Knowledge Graph & Multi-Schema JSON-LD

Implemented via structured `<script type="application/ld+json">` tags in `index.html` and complemented by page-level schemas:

### 3.1 `Organization` & `ProfessionalService` Schema
- `@type`: `["ProfessionalService", "Organization"]`
- `name`: "OdysseyPH IT Solutions"
- `alternateName`: `["ODC IT Solutions", "ODC", "OdysseyPH"]`
- `url`: `https://odysseyph.com`
- `logo`: `https://odysseyph.com/images/odc.jpg`
- `image`: `https://odysseyph.com/images/odc.jpg`
- `description`: "Premier software development agency and business systems studio in the Philippines, delivering custom clinic management systems, sports & court booking platforms, and enterprise workflow automation."
- `address`: Country: `PH`, Region: `Cebu / Central Visayas`, AddressCountry: `Philippines`
- `areaServed`: `["Philippines", "Cebu", "Mandaue", "Metro Manila", "Davao", "Global"]`
- `knowsAbout`: `["Custom Software Development", "Clinic Management Systems", "Sports Court Booking Software", "Web Application Development", "Workflow Automation", "React", "Node.js", "Firebase", "Cloud Systems"]`
- `priceRange`: `$$ - $$$`

### 3.2 `SoftwareApplication` Schema
Provides direct product entity recognition for answer engines:
1. **ODC-Courts**:
   - `applicationCategory`: `Sports / BusinessApplication`
   - `operatingSystem`: `Web, Mobile-responsive`
   - `description`: `Multi-location sports and pickleball court reservation platform with real-time schedule management, payment processing, and venue dashboards.`
2. **Odyssey Clinic Management Suite**:
   - `applicationCategory`: `HealthApplication`
   - `operatingSystem`: `Web`
   - `description`: `Secure clinical workflow platform featuring electronic medical records (EMR), appointment scheduling, and patient history management.`

### 3.3 `Service` Catalog Schema (`hasOfferCatalog`)
Defines the 6 core engineering offerings:
1. Web Development & High-Converting Portals
2. Mobile Applications & Booking Apps
3. Cloud Solutions & Infrastructure
4. Backend Systems & Operational APIs
5. UI/UX Design & Conversion Journeys
6. System Integration & CRM/Billing Automations

---

## 4. On-Page AEO Content Engine & FAQ System

### 4.1 Direct-Answer FAQ Section (`src/components/sections/FAQ.jsx`)
Integrated into the public site (featured on `Home.jsx` and `Services.jsx`) with interactive accordions and structured `FAQPage` JSON-LD:
- **Q1: What services does OdysseyPH IT Solutions specialize in?**
  - *Direct Answer*: OdysseyPH designs and builds custom business systems, healthcare clinic management platforms, multi-venue court booking software (like ODC-Courts), and responsive web applications for businesses, clinics, and government agencies in the Philippines.
- **Q2: Does OdysseyPH build custom clinic and medical management systems?**
  - *Direct Answer*: Yes. OdysseyPH develops secure clinical management solutions featuring electronic medical records (EMR), patient appointment scheduling, billing, and doctor workflows—proven in deployments like Odyssey Family Clinic and CPRMed.
- **Q3: What is ODC-Courts and what sports venues use OdysseyPH systems?**
  - *Direct Answer*: ODC-Courts is a specialized court reservation network for sports centers and pickleball venues. OdysseyPH systems power online reservations and court operations for venues like The Pickle Point Cebu, Jump Serve Sports Center (Mandaue & Mactan), KennyDink Moalboal, Nickleball Avenue, and Sosyal Dinkers Davao.
- **Q4: Where is OdysseyPH IT Solutions located, and do you serve clients nationwide?**
  - *Direct Answer*: OdysseyPH is headquartered in Cebu, Philippines, providing custom software engineering and digital transformation services to clients across Cebu, Metro Manila, Davao, Northern Mindanao, and international markets.
- **Q5: What technology stack does OdysseyPH use for software development?**
  - *Direct Answer*: OdysseyPH engineers high-performance web and mobile systems utilizing React, Node.js, modern cloud infrastructure (Firebase, Google Cloud), RESTful APIs, and responsive mobile-first interfaces.
- **Q6: How fast can OdysseyPH launch a custom business system or website?**
  - *Direct Answer*: Depending on project scope, custom web portals and core workflow systems are typically developed and deployed in agile sprints ranging from 2 to 6 weeks, backed by continuous post-launch support.

### 4.2 Semantic On-Page & Image Alt Refinements
- Update image `alt` attributes in `Home.jsx` and `Portfolio.jsx` to include entity + location tags (e.g., *"ODC-Courts sports court booking system preview"*, *"CPRMed medical clinic website by OdysseyPH"*).
- Ensure semantic heading hierarchy (`h1` -> `h2` -> `h3`) without skipping levels.

---

## 5. Route-Level Metadata & Dynamic SEO Hook

### 5.1 Dynamic SEO Hook (`src/hooks/usePageSEO.js`)
A lightweight, hook-based metadata controller managing:
- Document Title (`document.title`)
- Meta Description (`meta[name="description"]`)
- Canonical Link (`link[rel="canonical"]`)
- OpenGraph Tags (`og:title`, `og:description`, `og:url`, `og:image`)
- Twitter Tags (`twitter:title`, `twitter:description`, `twitter:image`)

### 5.2 Canonical Mapping
- `/` -> `https://odysseyph.com/`
- `/services` -> `https://odysseyph.com/services`
- `/portfolio` -> `https://odysseyph.com/portfolio`
- `/about` -> `https://odysseyph.com/about`
- `/contact` -> `https://odysseyph.com/contact`

---

## 6. Verification & Quality Gates

1. **Crawler & MIME Type Verification**: Confirm `robots.txt`, `sitemap.xml`, and `llms.txt` return HTTP 200 with appropriate plain text/XML headers.
2. **Schema.org Validation**: Validate all JSON-LD blocks against Schema.org and Google Rich Results guidelines.
3. **Core Web Vitals & Hydration**: Verify splash screen changes allow instant bot indexing while retaining clean human UX.
4. **Build & Lint Verification**: Execute `npm run build` and `npm run lint` to guarantee complete type/syntax correctness.
