# Design Specification: Standardizing MOA & Certificate of Acceptance to Audit Report & Incident Order Pattern

**Date:** 2026-11-09  
**Status:** Approved  
**Topic:** Aligning MOA (Memorandum of Agreement) and Certificate of Acceptance (COA) generation, editing, rendering, and electronic signature workflows with the established Audit Report and Incident Order architecture.

---

## 1. Overview & Objectives

OdysseyPH IT Solutions currently manages several formal documents. Recently, **Audit Reports** and **Incident Reports / Office Orders** were standardized into a best-in-class pattern:
1. Document Generation Engine adhering strictly to the ODC Brand Bible (`brandPage`).
2. TipTap-based visual WYSIWYG on-paper document editor with rich-text formatting (headings, lists, tables, callouts) and automated AI prompt & text parsing.
3. Calligraphy cursive electronic signatures (`font-family: 'Great Vibes', cursive; font-size: 32px;`) with uppercase signer designation tags and ISO/formatted electronic timestamps (`Signed electronically Nov 9, 2026, 3:00 PM`).
4. Dual-pane admin viewer combining management controls, signer governance checklist, and an in-app "Affix E-Signature" form for managers, alongside a live vector iframe document frame with native print (PDF) and Retina PNG download.
5. Secure public portal for client sign-offs with slot-based verification.

This specification modernizes **Memorandum of Agreement (MOA)** and **Certificate of Acceptance (COA)** to adhere 1:1 to this proven pattern.

---

## 2. Architecture & File Structure

```
src/
├── utils/
│   ├── brandDocument.js                 (Existing shared Brand Bible shell)
│   ├── moaDocument.js                   (Refactored: TipTap rendering, AI prompts, cursive signatures)
│   └── acceptanceDocument.js            (Refactored: TipTap rendering, AI prompts, cursive signatures)
├── services/
│   ├── moaService.js                    (New: CRUD, atomic control numbers, status, signatures)
│   └── acceptanceService.js             (New: CRUD, atomic control numbers, status, signatures)
├── components/
│   ├── moa/
│   │   ├── MoaFrame.jsx                 (New: iframe preview, print PDF, save PNG)
│   │   ├── MoaFrame.css                 (New: isolated frame styling)
│   │   ├── MoaEditor.jsx                (New: visual paper canvas, toolbar, AI paste, signers)
│   │   └── MoaEditor.css                (New: editor & paper styles)
│   └── acceptance/
│       ├── AcceptanceFrame.jsx          (New: iframe preview, print PDF, save PNG)
│       ├── AcceptanceFrame.css          (New: isolated frame styling)
│       ├── AcceptanceEditor.jsx         (New: visual paper canvas, toolbar, AI paste, signers)
│       └── AcceptanceEditor.css         (New: editor & paper styles)
├── pages/
│   ├── AdminMOA.jsx                     (Refactored: task-module layout, list/detail/edit modes, in-app sign)
│   ├── AdminAcceptance.jsx              (Refactored: task-module layout, list/detail/edit modes, in-app sign)
│   ├── ClientMOAPage.jsx                (Refactored: public signing portal matching AuditReportPage)
│   └── AcceptancePage.jsx               (Refactored: public signing portal matching AuditReportPage)
tests/
├── moaDocument.test.js                  (Updated: testing TipTap rendering, control numbers, signatures)
└── acceptanceAndReceiptDocument.test.js (Updated: testing TipTap rendering, control numbers, signatures)
```

---

## 3. Detailed Data Models & Services

### 3.1 Memorandum of Agreement (`moas` collection)
- **Status Lifecycle**:
  - `draft`: Editable by staff with permissions; can be deleted or issued.
  - `issued`: Locked from body edits; signers can sign; admin can sign in-app.
  - `executed`: Automatically marked executed once required signers have signed.
  - `revoked`: Marked revoked with a required reason; displays red "REVOKED" watermark.
  - *Backwards compatibility*: Maps legacy statuses (`Executed`, `Pending`, `Void`, `Cancelled`) to the lifecycle.
- **Control Number**:
  - Sequenced atomically as `MOA-YYYY-MM-NNN` using `moaCounters/{YYYY-MM}`.
  - Preserves existing legacy `moaNumber` or ID when reading historical records.
- **Fields**:
  - `title`: Contract title (e.g. `System Enhancement & API Integration Agreement`).
  - `clientName`, `clientBusiness`, `clientAddress`.
  - `providerName`, `providerBusiness` (defaulting to `BRAND_CO.approvedBy` and `BRAND_CO.name`).
  - `projectCost` (numerical amount), `timeline` (e.g. `November 1 to November 30, 2026`).
  - `body`: Plain text representation for search and legacy fallbacks.
  - `bodyJson`: JSON string representing the TipTap document tree.
  - `signers`: Map of signer slots `{ [slotId]: { id, kind, name, title, order } }`.
    - `s1`: `{ kind: 'provider', name: 'Jetch Merald S. Madaya', title: 'Engineering & Executive Lead', order: 1 }`
    - `s2`: `{ kind: 'client', name: '', title: 'Authorized Representative', order: 2 }`
    - Additional slots can be added with `kind: 'witness'` ("Witnessed by") or `conforme` ("Conforme").
- **Signatures Subcollection**: `moas/{id}/signatures/{slotId}`
  - Schema: `{ name: string, signedAt: timestamp, signedByUid: string, userAgent: string }`.

### 3.2 Certificate of Acceptance (`certificates` collection)
- **Status Lifecycle**:
  - `draft` → `issued` → `accepted` | `revoked`.
  - *Backwards compatibility*: Maps legacy statuses (`Accepted`, `Pending`).
- **Control Number**:
  - Sequenced atomically as `COA-YYYY-MM-NNN` using `certificateCounters/{YYYY-MM}`.
  - Preserves legacy `certificateNumber` or ID fallback.
- **Fields**:
  - `projectName`: Deliverable project name (e.g. `Multi-Tenant Booking & POS Platform`).
  - `turnoverDate`: ISO date string (`YYYY-MM-DD`).
  - `clientName`, `clientBusiness`, `clientAddress`.
  - `providerName`, `providerBusiness`.
  - `body`: Plain text representation.
  - `bodyJson`: JSON string representing the TipTap document tree (scope checklist, acceptance declarations).
  - `signers`: Map of signer slots `{ [slotId]: { id, kind, name, title, order } }`.
    - `s1`: `{ kind: 'turnover', name: 'Jetch Merald S. Madaya', title: 'Engineering & Executive Lead', order: 1 }`
    - `s2`: `{ kind: 'acceptor', name: '', title: 'Authorized Representative', order: 2 }`
    - Additional slots: `kind: 'inspector'` ("Inspected / Verified by") or `noted` ("Noted by").
- **Signatures Subcollection**: `certificates/{id}/signatures/{slotId}`.

### 3.3 Service Modules
`src/services/moaService.js` and `src/services/acceptanceService.js` provide:
- `subscribeMoas(onData, onError)` / `subscribeCertificates(onData, onError)`
- `subscribeMoa(id, onData, onError)` / `subscribeCertificate(id, onData, onError)`
- `subscribeMoaSignatures(id, onData, onError)` / `subscribeCertificateSignatures(id, onData, onError)`
- `createMoa(user, form)` / `createCertificate(user, form)` with atomic transactions
- `updateMoa(user, id, form)` / `updateCertificate(user, id, form)`
- `issueMoa(user, id)` / `issueCertificate(user, id)`
- `revokeMoa(user, id, reason)` / `revokeCertificate(user, id, reason)`
- `deleteMoaDraft(id)` / `deleteCertificateDraft(id)`
- `signMoa(id, slotId, name, user)` / `signCertificate(id, slotId, name, user)`

---

## 4. Document Templates, Signer Blocks & AI Parsers

### 4.1 HTML Generation (`buildMoaHtml` & `buildAcceptanceCertificateHtml`)
1. **Brand Bible Shell**: Uses `brandPage()` with:
   - Header: ODC mark (`/brand/odc-mark.svg`), company name, address, contact numbers, email, website.
   - Title Band: Orange tab, navy bar, uppercase document title, control number tag.
   - Center Stamp: Large semi-transparent watermark (`DRAFT`, `ISSUED`, `EXECUTED`, `ACCEPTED`, `REVOKED`).
   - Metadata Grid: Styled `<dl>` grid with uppercase muted labels and bold values.
2. **TipTap Rendering**:
   - `renderDocJson()` parses the TipTap JSON tree into HTML.
   - Section headings (`h2`) render with numeric badge spans (e.g. `<h2><span>1</span> Purpose of Agreement</h2>`).
   - Tables (`<table class="tbl">`), blockquotes, code blocks, bullet lists, and annexes (`# Annex A — ...`) formatted with clean print typography.
3. **Signatures Grid**:
   - Responsive `.signers` grid containing individual `.signer` cards:
     - `.eyebrow`: Upper-cased role label (e.g. `FOR PARTY B (SERVICE PROVIDER)`).
     - `.sig-mark`: Shows cursive signature (`font-family: 'Great Vibes', cursive; font-size: 32px;`) when signed, or empty space when pending.
     - `.sig-line`: Solid hairline divider.
     - `.sig-name`: Signatory legal name (bold navy).
     - `.sig-tag`: Uppercase position/title.
     - `.sig-meta`: Formatted electronic signing date (`Signed electronically Nov 9, 2026, 3:00 PM`) or date blank.

### 4.2 AI Prompts & Plain-Text Parsers
- `AI_MOA_PROMPT` & `parseMoaText(raw)`:
  - Formats plain text paste into `title`, `clientName`, `clientBusiness`, `clientAddress`, `projectCost`, `timeline`, and extracts signers while converting clauses into TipTap content.
- `AI_ACCEPTANCE_PROMPT` & `parseAcceptanceText(raw)`:
  - Formats plain text paste into `projectName`, `clientName`, `clientBusiness`, `turnoverDate`, signers, and turnover checklist items.

---

## 5. Components: Document Frames & Editors

### 5.1 Document Frames (`MoaFrame.jsx` & `AcceptanceFrame.jsx`)
- Renders `srcDoc={html}` inside an isolated `<iframe>`.
- Measures height dynamically (`scrollHeight + 8`) on font ready to avoid inner scrollbars.
- ForwardRef exposes:
  - `print()`: Triggers native browser print dialog for high-res vector PDF generation.
  - `savePng(filename)`: Renders Retina PNG (`pixelRatio: 2`) with embedded Google Fonts (`Great Vibes`, `Poppins`, `Inter`) via `html-to-image`.
- Supports `scale` property for mobile and split-view preview.

### 5.2 Document Editors (`MoaEditor.jsx` & `AcceptanceEditor.jsx`)
- Styled `.ae-paper` canvas replicating the exact printed page layout.
- Sticky formatting toolbar: Undo, Redo, Paragraph/Headings, Bold, Italic, Underline, Strike, Code, Bullet List, Numbered List, Callout Quote, Alignment, Table Tools, and Clear Formatting.
- Collapsible "Paste from AI" modal with prompt copy and instant auto-fill parsing.
- Header metadata inputs positioned directly on the paper canvas.
- Dynamic Signers Manager: Allows adding signers, selecting role, specifying names and titles, and removing optional signers.

---

## 6. Admin Management Pages & Public Portals

### 6.1 Admin Pages (`AdminMOA.jsx` & `AdminAcceptance.jsx`)
- Built on `AdminTasks.css` / `task-module` architecture:
- Modes:
  - `mode: 'list'`: Summary metrics, search bar, status filter pills, documents table with control numbers, client details, status badges, signer progress, and action buttons.
  - `mode: 'detail'`: Dual-pane view:
    - Left sidebar: metadata, action buttons (*Edit Draft*, *Issue*, *Delete Draft*, *Save as PDF*, *Save as PNG*, *Copy Signing Link*, *Revoke*), signer governance checklist with green signed indicators, and an in-app "Affix E-Signature" form for managers to sign immediately.
    - Right main pane: Live vector iframe document frame with live reactive updates upon signing.
  - `mode: 'edit'`: WYSIWYG paper editor with Save Draft / Save Changes aside panel.

### 6.2 Public Signing Portals (`ClientMOAPage.jsx` & `AcceptancePage.jsx`)
- Top branding bar with ODC mark, control number, status badge, PDF print, and PNG download.
- Centered document frame with mobile responsive scaling.
- Dedicated floating/bottom signing card:
  - Dropdown to select designated signature slot (or preselected via `?sign=slotId`).
  - Legal declaration acceptance checkbox.
  - Name input matching designated signatory.
  - "Affix Electronic Signature" button with instant status feedback.

---

## 7. Testing & Verification

1. **Unit Tests**:
   - `tests/moaDocument.test.js`: Validates control number generation, TipTap JSON tree rendering, Brand Bible compliance, and cursive signature blocks.
   - `tests/acceptanceAndReceiptDocument.test.js`: Validates Certificate of Acceptance control numbers, deliverables checklist, status stamps, and cursive signature blocks.
   - Run `node --test tests/*.test.js` to verify 100% pass rate.
2. **Build Verification**:
   - Run `npm run build` to confirm zero lint or Vite bundling errors.
