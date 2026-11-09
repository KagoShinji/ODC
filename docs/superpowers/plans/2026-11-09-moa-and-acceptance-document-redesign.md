# MOA & Certificate of Acceptance Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize Memorandum of Agreement (MOA) and Certificate of Acceptance (COA) generation, editing, rendering, and signing to strictly follow the Audit Report and Incident Order architecture.

**Architecture:** Refactor `moaDocument.js` and `acceptanceDocument.js` to support TipTap JSON trees, AI text parsing, and calligraphy cursive signature blocks. Implement dedicated services (`moaService.js`, `acceptanceService.js`), iframe document frames (`MoaFrame`, `AcceptanceFrame`), visual paper editors (`MoaEditor`, `AcceptanceEditor`), modern admin task-module pages (`AdminMOA`, `AdminAcceptance`), and public signing portals (`ClientMOAPage`, `AcceptancePage`).

**Tech Stack:** React 19, Vite, TipTap (StarterKit, TableKit, TextAlign), html-to-image, Lucide icons, Firebase Firestore (transactions, subcollections, real-time snapshots).

**Spec:** [docs/superpowers/specs/2026-11-09-moa-and-acceptance-document-redesign-design.md](file:///Users/jetchmerald/Documents/jetch/ODC/docs/superpowers/specs/2026-11-09-moa-and-acceptance-document-redesign-design.md)

## Global Constraints

- Never break backwards compatibility with existing Firestore `moas` and `certificates` records.
- Preserve Brand Bible styling from `src/utils/brandDocument.js` (colors `#16273a`, `#ff6a13`, `#1d2939`, fonts `Poppins`, `Inter`, and cursive signature font `Great Vibes`).
- Keep tracking numbers prefixed as `MOA-YYYY-MM-NNN` and `COA-YYYY-MM-NNN`.
- Electronic signatures must record `{ name, signedAt, signedByUid, userAgent }` in the document's `signatures` subcollection.
- All unit tests in `tests/*.test.js` must pass, and `npm run build` must succeed without errors.

## Review Focus

1. Legacy MOA / COA documents without `bodyJson` or `signers` must render gracefully using fallback markdown/scope fields without errors.
2. Signatures recorded via both the in-app admin form and the public signing page must immediately reflect in the iframe preview with the signer's name in `Great Vibes` cursive script and a formatted electronic timestamp.
3. Multi-page contracts and certificates must expand naturally in `MoaFrame` / `AcceptanceFrame` without inner scrollbars and export cleanly to PDF and Retina PNG.
4. "Paste from AI" modal must reliably parse both JSON and key-value plain text drafts, extracting metadata into header inputs and clauses into the TipTap document.
5. In-app signing by managers must restrict signing to authorized management/provider slots, while client public links must validate typed legal names against designated signer names.

---

### Task 1: Refactor MOA Document Engine (`src/utils/moaDocument.js`)

**Files:**
- Modify: `src/utils/moaDocument.js`
- Test: `tests/moaDocument.test.js`

**Interfaces:**
- Produces:
  - `controlMonthOf(date)`: returns `YYYY-MM`
  - `formatControlNumber(month, seq)`: returns `MOA-YYYY-MM-NNN`
  - `moaNumberFor(moa)`: returns formatted MOA number or fallback
  - `SIGNER_KINDS`: `{ provider: 'Party B (Service Provider)', client: 'Party A (Client)', witness: 'Witnessed by', conforme: 'Conforme' }`
  - `emptyMoaSigners()`: returns default 2-slot signer map
  - `AI_MOA_PROMPT`: string prompt for AI text drafting
  - `parseMoaText(raw)`: parses text into fields, signers, and body
  - `renderDocJson(doc)`: renders TipTap JSON to HTML with section badges and annexes
  - `buildMoaHtml(moa, signatures, options)`: generates full branded HTML with cursive signatures

- [ ] **Step 1: Write tests for TipTap rendering, AI parsing, and cursive signatures in `tests/moaDocument.test.js`**

Add tests checking:
- `parseMoaText` parses headers, clauses, and signers.
- `buildMoaHtml` renders TipTap JSON tree with badge spans (`<span>1</span>`).
- `buildMoaHtml` renders cursive `Great Vibes` signature marks and timestamps for multi-signers.
- Backwards compatibility with existing legacy tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/moaDocument.test.js`  
Expected: FAIL due to missing `parseMoaText` / `renderDocJson`.

- [ ] **Step 3: Implement TipTap rendering, AI parser, and cursive signatures in `src/utils/moaDocument.js`**

Refactor `moaDocument.js` following the exact pattern of `auditReportDocument.js`:
- Add `controlMonthOf`, `formatControlNumber`, `SIGNER_KINDS`, `emptyMoaSigners`, `AI_MOA_PROMPT`, `parseMoaText`.
- Add TipTap node and block renderers (`renderDocJson`, `renderBlock`, `renderInline`, `renderTable`, `splitAnnexes`, `renderBody`).
- Add standard `signerBlock(signer, signature, timeZone)` with `Great Vibes` font and electronic timestamp.
- Update `buildMoaHtml` to handle `bodyJson` or legacy fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/moaDocument.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/moaDocument.js tests/moaDocument.test.js
git commit -m "feat(moa): add TipTap rendering, AI parsing, and cursive signatures to moaDocument"
```

---

### Task 2: Refactor Certificate of Acceptance Document Engine (`src/utils/acceptanceDocument.js`)

**Files:**
- Modify: `src/utils/acceptanceDocument.js`
- Test: `tests/acceptanceAndReceiptDocument.test.js`

**Interfaces:**
- Produces:
  - `controlMonthOf(date)`: returns `YYYY-MM`
  - `formatControlNumber(month, seq)`: returns `COA-YYYY-MM-NNN`
  - `certificateNumberFor(coa)`: returns formatted COA number or fallback
  - `SIGNER_KINDS`: `{ turnover: 'Turned Over by (Service Provider)', acceptor: 'Accepted & Conforme (Client Partner)', inspector: 'Inspected / Verified by', noted: 'Noted by' }`
  - `emptyAcceptanceSigners()`: returns default 2-slot signer map
  - `AI_ACCEPTANCE_PROMPT`: string prompt for AI text drafting
  - `parseAcceptanceText(raw)`: parses text into fields, signers, and body
  - `renderDocJson(doc)`: renders TipTap JSON to HTML with section badges and annexes
  - `buildAcceptanceCertificateHtml(coa, signatures, options)`: generates full branded HTML with cursive signatures

- [ ] **Step 1: Write tests for TipTap rendering, AI parsing, and cursive signatures in `tests/acceptanceAndReceiptDocument.test.js`**

Add tests checking:
- `parseAcceptanceText` parses project name, client details, turnover date, and deliverables.
- `buildAcceptanceCertificateHtml` renders TipTap deliverables checklist and cursive signature marks.
- Backwards compatibility with existing tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/acceptanceAndReceiptDocument.test.js`  
Expected: FAIL due to missing `parseAcceptanceText`.

- [ ] **Step 3: Implement TipTap rendering, AI parser, and cursive signatures in `src/utils/acceptanceDocument.js`**

Refactor `acceptanceDocument.js`:
- Add `controlMonthOf`, `formatControlNumber`, `SIGNER_KINDS`, `emptyAcceptanceSigners`, `AI_ACCEPTANCE_PROMPT`, `parseAcceptanceText`.
- Add TipTap node and block renderers (`renderDocJson`, `renderBlock`, `renderInline`, `renderTable`, `splitAnnexes`, `renderBody`).
- Add standard `signerBlock(signer, signature, timeZone)` with `Great Vibes` font and electronic timestamp.
- Update `buildAcceptanceCertificateHtml` to handle `bodyJson` or legacy fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/acceptanceAndReceiptDocument.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/acceptanceDocument.js tests/acceptanceAndReceiptDocument.test.js
git commit -m "feat(acceptance): add TipTap rendering, AI parsing, and cursive signatures to acceptanceDocument"
```

---

### Task 3: Implement MOA & Acceptance Services (`src/services/moaService.js` & `acceptanceService.js`)

**Files:**
- Create: `src/services/moaService.js`
- Create: `src/services/acceptanceService.js`

**Interfaces:**
- Consumes:
  - `moaDocument.js`: `controlMonthOf`, `formatControlNumber`, `normalizeSignerName`
  - `acceptanceDocument.js`: `controlMonthOf`, `formatControlNumber`, `normalizeSignerName`
  - `lib/firebase.js`: `db`, `auth`
- Produces:
  - `moaService.js`: `subscribeMoas`, `subscribeMoa`, `subscribeMoaSignatures`, `createMoa`, `updateMoa`, `issueMoa`, `revokeMoa`, `deleteMoaDraft`, `signMoa`, `normalizeSignerName`
  - `acceptanceService.js`: `subscribeCertificates`, `subscribeCertificate`, `subscribeCertificateSignatures`, `createCertificate`, `updateCertificate`, `issueCertificate`, `revokeCertificate`, `deleteCertificateDraft`, `signCertificate`, `normalizeSignerName`

- [ ] **Step 1: Implement `src/services/moaService.js`**

Follow `auditReportService.js`:
- `reportFields(form)` sanitizing title, clientName, clientBusiness, clientAddress, providerName, providerBusiness, projectCost, timeline, body, bodyJson, and signers map.
- Real-time Firestore subscriptions (`subscribeMoas`, `subscribeMoa`, `subscribeMoaSignatures`).
- Atomic `createMoa(user, form)` using `moaCounters/{month}` and setting `MOA-YYYY-MM-NNN`.
- `updateMoa(user, id, form)`, `issueMoa(user, id)`, `revokeMoa(user, id, reason)`, `deleteMoaDraft(id)`.
- `signMoa(id, slotId, name, user)` recording in `moas/{id}/signatures/{slotId}` and automatically transitioning status to `executed` if all required signers have signed.

- [ ] **Step 2: Implement `src/services/acceptanceService.js`**

Follow `auditReportService.js`:
- `certificateFields(form)` sanitizing projectName, clientName, clientBusiness, clientAddress, providerName, providerBusiness, turnoverDate, body, bodyJson, and signers map.
- Real-time Firestore subscriptions (`subscribeCertificates`, `subscribeCertificate`, `subscribeCertificateSignatures`).
- Atomic `createCertificate(user, form)` using `certificateCounters/{month}` and setting `COA-YYYY-MM-NNN`.
- `updateCertificate(user, id, form)`, `issueCertificate(user, id)`, `revokeCertificate(user, id, reason)`, `deleteCertificateDraft(id)`.
- `signCertificate(id, slotId, name, user)` recording in `certificates/{id}/signatures/{slotId}` and automatically setting status to `accepted` when client signs.

- [ ] **Step 3: Verify build / import integrity**

Run: `npm run build`  
Expected: PASS with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/moaService.js src/services/acceptanceService.js
git commit -m "feat(services): add dedicated moaService and acceptanceService"
```

---

### Task 4: Implement Document Frames (`MoaFrame` & `AcceptanceFrame`)

**Files:**
- Create: `src/components/moa/MoaFrame.jsx`
- Create: `src/components/moa/MoaFrame.css`
- Create: `src/components/acceptance/AcceptanceFrame.jsx`
- Create: `src/components/acceptance/AcceptanceFrame.css`

**Interfaces:**
- Consumes:
  - `src/utils/moaDocument.js`: `buildMoaHtml`
  - `src/utils/acceptanceDocument.js`: `buildAcceptanceCertificateHtml`
- Produces:
  - `<MoaFrame ref={frameRef} moa={moa} signatures={signatures} scale={scale} title={title} />`
  - `<AcceptanceFrame ref={frameRef} certificate={coa} signatures={signatures} scale={scale} title={title} />`
  - Exposes imperative methods: `print()` and `savePng(filename)`.

- [ ] **Step 1: Implement `src/components/moa/MoaFrame.jsx` and `MoaFrame.css`**

Follow `AuditReportFrame.jsx`:
- Isolated iframe with height measurement.
- `print()` via `frame.current.contentWindow.print()`.
- `savePng()` via `toPng` with Google Fonts embedding (`Great Vibes`, `Poppins`, `Inter`).

- [ ] **Step 2: Implement `src/components/acceptance/AcceptanceFrame.jsx` and `AcceptanceFrame.css`**

Follow `AuditReportFrame.jsx`:
- Isolated iframe with height measurement, `print()`, and `savePng()`.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/moa/MoaFrame.jsx src/components/moa/MoaFrame.css src/components/acceptance/AcceptanceFrame.jsx src/components/acceptance/AcceptanceFrame.css
git commit -m "feat(components): add MoaFrame and AcceptanceFrame with PDF and PNG export"
```

---

### Task 5: Implement Visual Document Editors (`MoaEditor` & `AcceptanceEditor`)

**Files:**
- Create: `src/components/moa/MoaEditor.jsx`
- Create: `src/components/moa/MoaEditor.css`
- Create: `src/components/acceptance/AcceptanceEditor.jsx`
- Create: `src/components/acceptance/AcceptanceEditor.css`

**Interfaces:**
- Consumes:
  - TipTap libraries (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-text-align`, `@tiptap/extensions`)
  - `src/utils/brandDocument.js`: `BRAND_CO`
  - `src/utils/moaDocument.js` & `acceptanceDocument.js`: AI prompts, signer kinds, parsers, and renderers
- Produces:
  - `<MoaEditor form={form} controlNumber={controlNumber} initialContent={initialContent} onField={onField} onDoc={onDoc} onParsed={onParsed} />`
  - `<AcceptanceEditor form={form} controlNumber={controlNumber} initialContent={initialContent} onField={onField} onDoc={onDoc} onParsed={onParsed} />`

- [ ] **Step 1: Implement `src/components/moa/MoaEditor.jsx` and `MoaEditor.css`**

Follow `AuditReportEditor.jsx`:
- WYSIWYG `.ae-paper` canvas replicating the branded MOA.
- Sticky formatting toolbar with undo/redo, headings, lists, tables, callouts, alignment, and "Paste from AI".
- Collapsible "Paste from AI" modal with prompt copy and `parseMoaText`.
- Header metadata fields directly on the paper canvas: Title, Client Name, Business, Address, Provider details, Project Cost, and Timeline.
- TipTap `EditorContent`.
- Dynamic Signers Manager card with Add Signer, Role selector, Name, Title, and delete button.

- [ ] **Step 2: Implement `src/components/acceptance/AcceptanceEditor.jsx` and `AcceptanceEditor.css`**

Follow `AuditReportEditor.jsx`:
- WYSIWYG paper canvas with header fields: Project Name, Client Partner, Address, Turnover Date, and Representative.
- TipTap `EditorContent` for deliverables and turnover terms.
- Collapsible "Paste from AI" modal with `AI_ACCEPTANCE_PROMPT` and `parseAcceptanceText`.
- Dynamic Signers Manager with Add Signer, Role selector (`turnover`, `acceptor`, `inspector`, `noted`), Name, Title, and delete button.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/moa/MoaEditor.jsx src/components/moa/MoaEditor.css src/components/acceptance/AcceptanceEditor.jsx src/components/acceptance/AcceptanceEditor.css
git commit -m "feat(components): add MoaEditor and AcceptanceEditor with TipTap and AI pasting"
```

---

### Task 6: Modernize Admin Management Pages (`AdminMOA.jsx` & `AdminAcceptance.jsx`)

**Files:**
- Modify: `src/pages/AdminMOA.jsx`
- Modify: `src/pages/AdminAcceptance.jsx`

**Interfaces:**
- Consumes:
  - `moaService.js` & `acceptanceService.js`
  - `MoaFrame`, `AcceptanceFrame`
  - `MoaEditor`, `AcceptanceEditor`
  - `AdminTasks.css`

- [ ] **Step 1: Refactor `src/pages/AdminMOA.jsx`**

Restructure into 3 view modes matching `AdminAuditReports.jsx`:
- `mode: 'list'`: Search, status filter pills (`all`, `draft`, `issued`, `executed`, `revoked`), metrics summary, table with control numbers, client, cost, status badges, signers progress, and action buttons.
- `mode: 'detail'`: Dual-pane view:
  - Left sidebar: metadata, action buttons (*Edit Draft*, *Issue*, *Delete Draft*, *Save as PDF*, *Save as PNG*, *Copy Signing Link*, *Revoke*), signer governance checklist with green signed indicators, and in-app "Affix E-Signature" form for managers.
  - Right pane: `<MoaFrame ref={frame} moa={moa} signatures={signatures} />`.
- `mode: 'edit'`: Full-page `<MoaEditor>` with save/cancel aside panel.

- [ ] **Step 2: Refactor `src/pages/AdminAcceptance.jsx`**

Restructure into 3 view modes matching `AdminAuditReports.jsx`:
- `mode: 'list'`: Search, status filters, metrics summary, table with control numbers, client, project name, turnover date, status badges, and action buttons.
- `mode: 'detail'`: Dual-pane view:
  - Left sidebar: metadata, action buttons, signer governance checklist, and in-app "Affix E-Signature" form for managers.
  - Right pane: `<AcceptanceFrame ref={frame} certificate={coa} signatures={signatures} />`.
- `mode: 'edit'`: Full-page `<AcceptanceEditor>` with save/cancel aside panel.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminMOA.jsx src/pages/AdminAcceptance.jsx
git commit -m "feat(admin): modernize AdminMOA and AdminAcceptance with task-module and dual-pane detail"
```

---

### Task 7: Modernize Public Signing Portals (`ClientMOAPage.jsx` & `AcceptancePage.jsx`)

**Files:**
- Modify: `src/pages/ClientMOAPage.jsx`
- Modify: `src/pages/AcceptancePage.jsx`

**Interfaces:**
- Consumes:
  - `moaService.js`: `subscribeMoa`, `subscribeMoaSignatures`, `signMoa`, `normalizeSignerName`
  - `acceptanceService.js`: `subscribeCertificate`, `subscribeCertificateSignatures`, `signCertificate`, `normalizeSignerName`
  - `MoaFrame`, `AcceptanceFrame`

- [ ] **Step 1: Refactor `src/pages/ClientMOAPage.jsx`**

Align to `AuditReportPage.jsx`:
- Branded header bar with ODC mark, MOA control number, status badge, Print PDF, and PNG download.
- Live `<MoaFrame>` with auto-scale for mobile screens.
- Dedicated signing card for pending signers:
  - Slot selector (auto-selected if `?sign=slotId` is in URL).
  - Legal declaration agreement checkbox.
  - Name input validating against designated signatory.
  - "Affix Electronic Signature" button with instant feedback.

- [ ] **Step 2: Refactor `src/pages/AcceptancePage.jsx`**

Align to `AuditReportPage.jsx`:
- Branded header bar with ODC mark, certificate control number, status badge, Print PDF, and PNG download.
- Live `<AcceptanceFrame>` with auto-scale.
- Dedicated signing card with slot selector, declaration checkbox, name validation, and "Affix Electronic Signature" button.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClientMOAPage.jsx src/pages/AcceptancePage.jsx
git commit -m "feat(portal): modernize ClientMOAPage and AcceptancePage with AuditReportPage signing layout"
```

---

### Task 8: Full Verification & Integration Test Suite

**Files:**
- Test: `tests/*.test.js`

- [ ] **Step 1: Run complete test suite**

Run: `node --test tests/*.test.js`  
Expected: All 34+ tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: Build completes with 0 errors.

- [ ] **Step 3: Final branch review & commit**

```bash
git status
```
Ensure working tree is clean.
