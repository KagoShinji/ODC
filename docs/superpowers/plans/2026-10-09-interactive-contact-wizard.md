# Interactive Contact Scoper & Recommendation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static contact form with an interactive, tap-based scoping wizard that calculates tailored system blueprints and captures high-intent leads in Firestore with zero emojis and full backward compatibility.

**Architecture:** Create a standalone `ContactWizard.jsx` component that manages multi-step state (Category -> Features -> Timeline -> Blueprint & Lead Form), computes dynamic system recommendations, and submits structured data to Firestore `contactSubmissions`. Embed it in `Contact.jsx` with a dual-mode toggle for standard messaging.

**Tech Stack:** React, Framer Motion, Phosphor Icons (`@phosphor-icons/react`), Firebase Firestore (`collection`, `addDoc`, `serverTimestamp`).

**Spec:** `docs/superpowers/specs/2026-10-09-interactive-contact-wizard-design.md`

## Global Constraints

- **Strictly zero emojis** in any code, UI text, badge, button, or blueprint description. Use Phosphor SVG icons exclusively.
- Submissions must write to the `contactSubmissions` Firestore collection with both a formatted `goal` string and a structured `wizardData` object.
- Preserve 100% functionality of the left column (email, phone, Cebu address, Facebook link).
- Build must pass `npm run build` with zero errors.

## Review Focus

- **No emoji leaks**: Ensure zero unicode emojis exist across all options, blueprints, and buttons.
- **State reset & navigation**: Back button must safely retreat steps without erasing previously selected answers.
- **Form validation**: Name and valid email must be required before submitting the blueprint.
- **Firestore payload completeness**: `goal`, `name`, `email`, `wizardData`, and `submittedAt` must be present on every submission.
- **Mobile responsiveness**: Tap cards and chips must wrap cleanly on narrow screens (320px+).

---

### Task 1: Create the Interactive Contact Wizard Component

**Files:**
- Create: `src/components/contact/ContactWizard.jsx`

**Interfaces:**
- Consumes: Firestore `db`, `collection`, `addDoc`, `serverTimestamp`, Phosphor Icons.
- Produces: `<ContactWizard onSwitchToSimple={() => void} />` component.

- [ ] **Step 1: Create `src/components/contact/ContactWizard.jsx` with scoping data and recommendation logic**

Define data arrays for Categories (with Phosphor icons `FirstAid`, `Trophy`, `Buildings`, `ShoppingCart`, `Globe`, `Cpu`), Capabilities (with `CalendarCheck`, `Users`, `CreditCard`, `ChartBar`, `DeviceMobile`, `PaperPlaneRight`, `ShieldCheck`), and Timelines (Rapid 2-4 wks, Standard 1-2 mos, Planning). Implement the dynamic recommendation resolver returning tailored blueprint title, architecture summary, and matched portfolio reference.

- [ ] **Step 2: Implement multi-step navigation (Steps 1, 2, 3, 4) with Framer Motion animations**

Build step indicator header, `< Back` button, smooth slide transitions between steps, multi-select capability toggles, and instant reveal on Step 3 selection.

- [ ] **Step 3: Implement Blueprint Reveal and Lead Form submission**

Render the Blueprint Card summary with capability tags and sprint estimates. Include input fields for Name, Email, Phone/WhatsApp, Company, and optional Notes. Submit payload to `contactSubmissions` in Firestore with backward-compatible `goal` formatting and structured `wizardData`.

- [ ] **Step 4: Implement Success confirmation screen**

Render animated vector `CheckCircle` badge, confirmation copy, Facebook/direct contact options, and a "Start another blueprint" reset button.

- [ ] **Step 5: Verify zero emojis in `ContactWizard.jsx`**

Run: `node -e "const fs = require('fs'); const code = fs.readFileSync('src/components/contact/ContactWizard.jsx', 'utf8'); const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u; if (emojiRegex.test(code)) throw new Error('Emoji found!'); console.log('Zero emojis confirmed in ContactWizard.jsx');"`
Expected: `Zero emojis confirmed in ContactWizard.jsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/contact/ContactWizard.jsx
git commit -m "feat(contact): create interactive scoping wizard component"
```

---

### Task 2: Integrate Wizard and Dual-Mode Toggle in Contact Section

**Files:**
- Modify: `src/components/sections/Contact.jsx`

**Interfaces:**
- Consumes: `<ContactWizard />`
- Produces: Enhanced `<ContactSection />` with dual-mode wizard/simple toggle.

- [ ] **Step 1: Update `Contact.jsx` to render `ContactWizard` as default**

Provide state `mode` (`'wizard'` | `'simple'`). Render `ContactWizard` by default, passing a callback to toggle to simple form. On the simple form, render a clean link to switch back to the interactive builder.

- [ ] **Step 2: Verify build passes with zero errors**

Run: `npm run build`
Expected: Build passes with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Contact.jsx
git commit -m "feat(contact): integrate interactive wizard with dual-mode toggle in contact section"
```

---

### Task 3: End-to-End Verification & Quality Audit

**Files:**
- Test / Verify all contact components.

- [ ] **Step 1: Verify zero emojis across all contact files**

Run: `node -e "const fs = require('fs'); ['src/components/contact/ContactWizard.jsx', 'src/components/sections/Contact.jsx'].forEach(f => { const code = fs.readFileSync(f, 'utf8'); const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u; if (emojiRegex.test(code)) throw new Error('Emoji found in ' + f); }); console.log('Zero emojis verified across all contact files.');"`
Expected: `Zero emojis verified across all contact files.`

- [ ] **Step 2: Run full project production build**

Run: `npm run build`
Expected: Clean build exit code 0.

- [ ] **Step 3: Final commit & status review**

```bash
git status
```
