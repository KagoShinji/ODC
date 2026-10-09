# Design Spec: Interactive Contact Scoper & Recommendation Wizard

**Document ID:** `2026-10-09-interactive-contact-wizard-design`  
**Target:** OdysseyPH IT Solutions (`src/components/sections/Contact.jsx`)  
**Status:** Approved for Implementation Planning  
**Date:** 2026-10-09  

---

## 1. Overview & Objectives

### 1.1 Goal
Transform the traditional static contact form on the OdysseyPH website into a high-converting, interactive project scoping wizard. Users tap through guided questions to define their system requirements, receive an instant, tailored architectural blueprint and portfolio recommendation, and submit their consultation inquiry with fully structured project metadata.

### 1.2 Core Constraints
- **Zero Emojis**: Visual presentation must rely exclusively on Phosphor/Lucide vector SVG icons, clean badges, and agency-grade typography.
- **Layout Preservation**: Maintain the established 2-column layout in `ContactSection` (left: direct contact, office address, Facebook; right: interactive wizard card).
- **Dual-Mode Access**: Users must be able to seamlessly toggle between the interactive wizard and a standard direct contact form at any time.
- **Data Compatibility**: Form submissions must integrate with the existing Firestore `contactSubmissions` collection, populating backward-compatible `goal` summaries so the existing Admin Inquiries dashboard remains fully functional without breaking existing searches.

---

## 2. Interactive Wizard Flow & User Experience

### 2.1 State Architecture
The wizard state tracks:
- `step`: `1` (Category) | `2` (Capabilities) | `3` (Timeline) | `4` (Blueprint Reveal & Lead Form)
- `category`: Selected system category ID.
- `selectedFeatures`: Array of selected capability IDs.
- `timeline`: Selected timeline ID.
- `mode`: `'wizard'` | `'simple'` (allows toggling to the traditional form).
- `lead`: `{ name: '', email: '', phone: '', company: '', notes: '' }`.
- `status`: `'idle'` | `'loading'` | `'success'` | `'error'`.

### 2.2 Step 1: System Category Selection (Single-Select)
Presents tactile grid cards with vector icons and concise descriptions:
1. **Healthcare & Clinic Systems** (Icon: `FirstAid`)
   - *Subtitle*: EMR records, patient scheduling, and doctor workflows.
2. **Sports & Court Booking Platforms** (Icon: `Trophy`)
   - *Subtitle*: Pickleball venues, sports centers, and real-time reservations.
3. **Enterprise Portals & Operations** (Icon: `Buildings`)
   - *Subtitle*: Internal workflows, equipment tracking, and staff management.
4. **Digital Commerce & Retail** (Icon: `ShoppingCart`)
   - *Subtitle*: Product discovery, online checkout, and order fulfillment.
5. **Modern Web Apps & SaaS Platforms** (Icon: `Globe`)
   - *Subtitle*: High-converting client portals, web platforms, and MVPs.
6. **Custom AI & Workflow Automation** (Icon: `Cpu`)
   - *Subtitle*: Intelligent API pipelines, document processing, and automated tasks.

*Behavior*: Selecting a category applies an emerald/primary active border glow and smoothly transitions to Step 2 after a brief 180ms confirmation tick.

### 2.3 Step 2: Core Capabilities & Requirements (Multi-Select)
Interactive toggle chips allowing multi-selection:
- **Live Scheduling & Booking** (Icon: `CalendarCheck`)
- **Patient & Member Portals** (Icon: `Users`)
- **Online Payments (GCash, Maya, Stripe)** (Icon: `CreditCard`)
- **Admin Analytics & Dashboards** (Icon: `ChartBar`)
- **Mobile-Responsive / App Readiness** (Icon: `DeviceMobile`)
- **SMS, WhatsApp & Email Alerts** (Icon: `PaperPlaneRight`)
- **Role-Based Staff Permissions** (Icon: `ShieldCheck`)

*Behavior*: Multi-select toggle. Includes a "Continue to Timeline" button enabled once at least 1 feature is chosen.

### 2.4 Step 3: Launch Timeline (Single-Select)
1. **Rapid Sprint (2 to 4 Weeks)**: Urgent MVP or venue launch.
2. **Standard Build (1 to 2 Months)**: Comprehensive custom software suite.
3. **Planning & Roadmap**: Strategy, technical scoping, and estimates.

*Behavior*: Selecting an option immediately computes and transitions to Step 4 (Blueprint Reveal).

---

## 3. Dynamic Blueprint Recommendation Engine

When Step 3 is completed, the engine computes a tailored architectural recommendation based on the category:

| Category ID | Blueprint Title | Architecture Summary | Matched Reference |
|---|---|---|---|
| `clinic` | Clinical Operations & Patient Workflow Suite | Secure cloud EMR architecture, multi-practitioner schedule synchronization, and HIPAA/privacy-conscious records. | Odyssey Family Clinic & CPRMed |
| `sports` | Multi-Venue Court Reservation Network | High-concurrency booking engine with real-time slot locking, automated payment webhooks, and venue management dashboards. | ODC-Courts, The Pickle Point & Jump Serve |
| `enterprise` | Operational Enterprise Dashboard & Process Engine | Centralized RBAC management portal with asset tracking, preventive maintenance pipelines, and automated staff workflows. | SPEC PMS Platform & Government Portals |
| `commerce` | High-Conversion Commerce & Order Processing System | Fast responsive storefront with automated inventory synchronization, multi-provider checkout, and fulfillment analytics. | KBDF Luxury & MediQuick |
| `webapp` | Scalable Full-Stack Application Architecture | Reactive mobile-first web application, secure REST/GraphQL API layer, and automated cloud scaling. | SupportTeach & IMS-US |
| `ai` | Intelligent Workflow Automation & AI Pipeline | Serverless orchestration connecting modern AI reasoning models, document extraction, and third-party API integration. | Bespoke Microservice & Automation Architecture |

The Blueprint Card displays:
- **System Blueprint Title** with a vector badge.
- **Architectural Strategy Description**.
- **Portfolio Proof**: Matched live case study from OdysseyPH's track record.
- **Estimated Sprint Timeline**.
- **Capability Tags**: Selected feature chips rendered as clean monochrome tags.

---

## 4. Lead Capture & Data Integration

### 4.1 Form Fields (Embedded Below Blueprint)
- **Full Name** (Required)
- **Work Email** (Required)
- **Phone / WhatsApp Number** (Optional, recommended for fast Philippine coordination)
- **Company / Organization** (Optional)
- **Additional Specifics / Notes** (Optional textarea)
- **Submit Button**: `Lock in Blueprint & Request Strategy Call`

### 4.2 Firestore Document Structure (`contactSubmissions`)
```javascript
{
  name: string,
  email: string,
  phone: string | null,
  company: string | null,
  goal: string, // Human-readable summary for existing Admin search
  wizardData: {
    category: string,
    categoryTitle: string,
    selectedFeatures: string[],
    timeline: string,
    blueprintTitle: string,
    architectureSummary: string,
    matchedCaseStudy: string,
    notes: string | null
  },
  source: "interactive_wizard", // or "standard_form"
  submittedAt: serverTimestamp(),
  userAgent: string,
  referrer: string | null
}
```

### 4.3 Success Screen & Direct Follow-Up
- Displays an animated vector check icon (`CheckCircle`).
- Direct options:
  - "Chat with Technical Team on Facebook"
  - "Start Another Blueprint"

---

## 5. Verification & Testing Gates

1. **Step Transition & Animation**: Verify back/forward state progression and smooth height transitions without jumping.
2. **Dual-Mode Toggle**: Verify switching between wizard and simple form works flawlessly.
3. **Database Write Integrity**: Confirm Firestore writes to `contactSubmissions` with both `goal` string and `wizardData` object.
4. **Emoji Check**: Verify 100% absence of emojis in all rendered labels, cards, and recommendations.
5. **Responsive Design**: Verify usability on mobile screens (minimum width 320px) and desktops.
6. **Build & Lint Verification**: Clean exit code 0 on `npm run build`.
