# Audit Report Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standardized, audited, and brand-compliant Audit Report document subsystem with live rich-text editing, atomic sequence numbering (`AR-YYYY-MM-NNN`), multi-tier digital signatures, and public verification.

**Architecture:** The subsystem provides a dedicated document model and HTML generator following OdysseyPH Brand Bible standards, Firestore transactional counter and signature persistence, a TipTap editor with AI draft paste import, an iframe preview component, an admin management portal, and a public signing page.

**Tech Stack:** React 19, TipTap, Firebase Firestore, Lucide React, CSS variables / Brand Bible styles, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-06-audit-report-feature-design.md`

## Global Constraints

- Control numbers strictly follow `AR-YYYY-MM-NNN` where `YYYY-MM` is the month string and `NNN` is a 3-digit zero-padded sequence.
- All documents render within the `brandPage` shell using the official SVG mark `/brand/odc-mark.svg`, navy `#16273a` header bar, and orange `#ff6a13` accent tab.
- Electronic signatures render in 'Great Vibes' cursive script with ISO verification metadata.
- Status transitions: `draft` -> `issued` -> `closed` / `revoked`. No modifications allowed to report content once issued.

## Review Focus

1. AI paste input with lowercase or unconventional header capitalization (`category:`, `Rating:`, `lead auditor:`) must parse cleanly without dropping fields.
2. Signatures typed with whitespace or mismatched casing must match signer slots case-insensitively.
3. Empty or malformed `bodyJson` should fall back cleanly to markdown `body` rendering without crashing the iframe.
4. Non-standard dates in AI pastes (e.g. "Nov 6, 2026" or "Friday, November 6 2026") must be converted to ISO format `YYYY-MM-DD`.
5. Missing or revoked status reasons should handle empty strings gracefully and show appropriate watermark stamps.

---

### Task 1: Audit Report Document Utilities & Unit Tests

**Files:**
- Create: `src/utils/auditReportDocument.js`
- Create: `tests/auditReportDocument.test.js`

**Interfaces:**
- Produces:
  - `AUDIT_REPORT_PREFIX = 'AR'`
  - `AUDIT_CATEGORIES`, `AUDIT_RATINGS`, `SIGNER_KINDS`, `emptyAuditSigners()`
  - `AI_AUDIT_PROMPT`
  - `controlMonthOf(date: Date) -> string`
  - `formatControlNumber(month: string, seq: number) -> string`
  - `auditReportLink(id: string, origin?: string) -> string`
  - `toIsoDate(text: string) -> string`
  - `parseAuditReportText(raw: string) -> { fields: object, body: string, signers: object }`
  - `buildAuditReportHtml(report: object, signatures?: object, options?: object) -> string`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/auditReportDocument.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_REPORT_PREFIX,
  formatControlNumber,
  parseAuditReportText,
  buildAuditReportHtml,
  emptyAuditSigners,
} from '../src/utils/auditReportDocument.js';

test('formatControlNumber formats sequence with AR prefix and 3 digits', () => {
  assert.equal(AUDIT_REPORT_PREFIX, 'AR');
  assert.equal(formatControlNumber('2026-11', 1), 'AR-2026-11-001');
  assert.equal(formatControlNumber('2026-11', 42), 'AR-2026-11-042');
});

test('parseAuditReportText extracts metadata headers, sections, and 4-tier signers', () => {
  const sample = `
TITLE: Q4 2026 Infrastructure & Security Audit
CATEGORY: IT & Security
RATING: Satisfactory
PERIOD COVERED: 2026-10-01 to 2026-10-31
DATE CONDUCTED: 2026-11-02
DATE ISSUED: 2026-11-06
LEAD AUDITOR: Jane Doe, Senior Security Auditor
AUDITEE: Engineering & DevOps Team
AUDIT TEAM: John Smith, Mark Taylor

## 1. Executive Summary & Audit Objectives
Comprehensive evaluation of access policies and server firewall logs.

## 2. Scope & Methodology
Covered AWS, Cloudflare, and internal bastion hosts.

Audited by:
Jane Doe
Senior Security Auditor

Reviewed by:
Alex Vance
Compliance Manager

Approved by:
Jetch Merald S. Madaya
Founder

Acknowledged by:
DevOps Lead
Systems Head
`;

  const parsed = parseAuditReportText(sample);
  assert.equal(parsed.fields.title, 'Q4 2026 Infrastructure & Security Audit');
  assert.equal(parsed.fields.category, 'it_security');
  assert.equal(parsed.fields.rating, 'satisfactory');
  assert.equal(parsed.fields.auditPeriodStart, '2026-10-01');
  assert.equal(parsed.fields.auditPeriodEnd, '2026-10-31');
  assert.equal(parsed.fields.leadAuditorName, 'Jane Doe');
  assert.equal(parsed.fields.auditeeEntity, 'Engineering & DevOps Team');
  assert.ok(parsed.body.includes('Comprehensive evaluation of access policies'));
  assert.equal(Object.keys(parsed.signers).length, 4);
});

test('buildAuditReportHtml produces valid Brand Bible HTML with rating badge and signatures', () => {
  const report = {
    controlNumber: 'AR-2026-11-001',
    title: 'Q4 2026 Infrastructure & Security Audit',
    category: 'it_security',
    rating: 'satisfactory',
    auditPeriodStart: '2026-10-01',
    auditPeriodEnd: '2026-10-31',
    auditDate: '2026-11-02',
    dateIssued: '2026-11-06',
    leadAuditorName: 'Jane Doe',
    leadAuditorTitle: 'Senior Security Auditor',
    auditeeEntity: 'Engineering',
    body: '## 1. Executive Summary\nAll controls passed.',
    signers: emptyAuditSigners(),
    status: 'issued',
  };

  const html = buildAuditReportHtml(report, {
    s1: { name: 'Jane Doe', signedAt: '2026-11-06T10:00:00.000Z' }
  }, { origin: 'https://odysseyph.com' });

  assert.match(html, /AR-2026-11-001/);
  assert.match(html, /AUDIT REPORT/);
  assert.match(html, /satisfactory/i);
  assert.match(html, /Jane Doe/);
  assert.match(html, /brand\/odc-mark\.svg/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/auditReportDocument.test.js`
Expected: FAIL with missing module `src/utils/auditReportDocument.js`.

- [ ] **Step 3: Implement `src/utils/auditReportDocument.js`**

Implement category mapping, rating metadata, regex field extractors, `parseAuditReportText`, and `buildAuditReportHtml` integrating with `brandPage` from `./brandDocument.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/auditReportDocument.test.js`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/auditReportDocument.js tests/auditReportDocument.test.js
git commit -m "feat(auditreports): add document utility functions and tests"
```

---

### Task 2: Audit Report Firebase Service Layer

**Files:**
- Create: `src/services/auditReportService.js`

**Interfaces:**
- Consumes: `src/utils/auditReportDocument.js`, Firebase Firestore (`db`, `auth`)
- Produces:
  - `subscribeAuditReports(onData, onError)`
  - `subscribeAuditReport(id, onData, onError)`
  - `subscribeAuditSignatures(id, onData, onError)`
  - `createAuditReport(user, form)`
  - `updateAuditReport(user, id, form)`
  - `issueAuditReport(user, id)`
  - `closeAuditReport(user, id, reason)`
  - `revokeAuditReport(user, id, reason)`
  - `deleteAuditReportDraft(id)`
  - `signAuditReport(id, slotId, name, user)`

- [ ] **Step 1: Implement `src/services/auditReportService.js`**

Implement real-time Firestore listeners, transaction-based counter allocation in `auditReportCounters/{YYYY-MM}` creating `AR-YYYY-MM-NNN`, document updates, lifecycle state transitions (`issue`, `close`, `revoke`, `delete`), and electronic signature recording in `auditReports/{id}/signatures/{slotId}`.

- [ ] **Step 2: Verify service exports and syntax**

Run: `node -e "import('./src/services/auditReportService.js').then(() => console.log('OK'))"`
Expected: Prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/services/auditReportService.js
git commit -m "feat(auditreports): add audit report firestore service layer"
```

---

### Task 3: Firestore Security Rules Update

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Protects:
  - `auditReportCounters/{month}`
  - `auditReports/{reportId}`
  - `auditReports/{reportId}/signatures/{slotId}`

- [ ] **Step 1: Add Audit Reports rules into `firestore.rules`**

Add `auditReportAdmin()` helper, `validAuditReport(d)` validation rule, and collection matchers for `auditReportCounters` and `auditReports` with immutable subcollection `signatures/{slotId}` before `{document=**}`.

- [ ] **Step 2: Verify firestore rules syntax**

Run: `python3 -c "with open('firestore.rules') as f: content = f.read(); assert 'auditReports' in content; assert 'auditReportCounters' in content; print('Firestore rules valid')"`
Expected: Prints `Firestore rules valid`.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(auditreports): add firestore security rules for audit reports"
```

---

### Task 4: Audit Report Document Frame Component

**Files:**
- Create: `src/components/auditReports/AuditReportFrame.jsx`
- Create: `src/components/auditReports/AuditReportFrame.css`

**Interfaces:**
- Consumes: `src/utils/auditReportDocument.js`
- Props: `{ report, signatures, title, scale }` (forwardRef)
- Produces: Sandboxed iframe rendering `buildAuditReportHtml(report, signatures)` with auto-height adjustment and print helper.

- [ ] **Step 1: Implement `AuditReportFrame.jsx` & `AuditReportFrame.css`**

Build component that renders an iframe with `srcDoc`, memoized HTML, responsive scale transforms, and ref exposure for programmatic `print()`.

- [ ] **Step 2: Commit**

```bash
git add src/components/auditReports/AuditReportFrame.jsx src/components/auditReports/AuditReportFrame.css
git commit -m "feat(auditreports): add AuditReportFrame preview component"
```

---

### Task 5: Audit Report TipTap Editor & AI Paste Drawer

**Files:**
- Create: `src/components/auditReports/AuditReportEditor.jsx`
- Create: `src/components/auditReports/AuditReportEditor.css`

**Interfaces:**
- Consumes: `src/utils/auditReportDocument.js`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`
- Props: `{ form, controlNumber, initialContent, onField, onDoc, onParsed }`
- Produces: Form fields (Title, Category, Rating, Dates, Lead Auditor, Auditee Entity/Contact, Team), Signer management drawer, rich text TipTap editor with toolbar, and AI quick paste drawer.

- [ ] **Step 1: Implement `AuditReportEditor.jsx` & `AuditReportEditor.css`**

Implement rich-text controls, metadata input bindings, dynamic signer management, and the slide-out AI paste drawer using `parseAuditReportText`.

- [ ] **Step 2: Commit**

```bash
git add src/components/auditReports/AuditReportEditor.jsx src/components/auditReports/AuditReportEditor.css
git commit -m "feat(auditreports): add AuditReportEditor with rich-text and AI paste drawer"
```

---

### Task 6: Public Verification & Digital Sign Route (`/audit-report/:id`)

**Files:**
- Create: `src/pages/AuditReportPage.jsx`
- Create: `src/pages/AuditReportPage.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `src/services/auditReportService.js`, `src/components/auditReports/AuditReportFrame.jsx`
- Produces: Public verification route at `/audit-report/:id` allowing signers to sign and download/print the branded report.

- [ ] **Step 1: Implement `AuditReportPage.jsx` & `AuditReportPage.css`**

Build standalone page with zoom and print controls, real-time report subscription, signature state, and interactive signature card for designated signers.

- [ ] **Step 2: Wire `/audit-report/:id` into `src/App.jsx`**

Add lazy import `const AuditReportPage = lazy(() => import('./pages/AuditReportPage'));` and route `<Route path="/audit-report/:id" element={<AuditReportPage />} />`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AuditReportPage.jsx src/pages/AuditReportPage.css src/App.jsx
git commit -m "feat(auditreports): add public verification and signing page at /audit-report/:id"
```

---

### Task 7: Admin Audit Reports Management & Navigation

**Files:**
- Create: `src/pages/AdminAuditReports.jsx`
- Create: `src/pages/AdminAuditReports.css`
- Modify: `src/utils/navigationConfig.js`
- Modify: `src/pages/Admin.jsx`

**Interfaces:**
- Consumes: `src/services/auditReportService.js`, `src/components/auditReports/AuditReportEditor.jsx`, `src/components/auditReports/AuditReportFrame.jsx`
- Produces: Admin workspace tab with metrics cards, status/rating filters, reports table, detail modal with live frame preview, draft editing, and lifecycle controls.

- [ ] **Step 1: Implement `AdminAuditReports.jsx` & `AdminAuditReports.css`**

Implement full admin workflow matching `AdminIncidentReports`: overview metrics (Total, Draft, Issued, Unsatisfactory), search and filter bar, action table, detail/editor modal with live frame preview, issue/close/revoke action forms, and in-admin signing.

- [ ] **Step 2: Add navigation item in `src/utils/navigationConfig.js`**

Add `auditreports` item with `ClipboardCheck` icon, color `#0ea5e9`, and action `auditreports:manage`.

- [ ] **Step 3: Wire into `src/pages/Admin.jsx`**

Add lazy import `const AdminAuditReports = lazy(() => import('./AdminAuditReports'));` and conditional render `{activeTab === 'auditreports' && hasPermission('auditreports') && (<AdminAuditReports firebaseUser={firebaseUser} can={can} />)}`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminAuditReports.jsx src/pages/AdminAuditReports.css src/utils/navigationConfig.js src/pages/Admin.jsx
git commit -m "feat(auditreports): add AdminAuditReports page and navigation tab"
```

---

### Task 8: Verification & Vite Build

**Files:**
- All modified and newly created files.

- [ ] **Step 1: Run unit test suite**

Run: `node --test tests/auditReportDocument.test.js tests/acceptanceAndReceiptDocument.test.js`
Expected: All tests PASS.

- [ ] **Step 2: Run Vite production build**

Run: `npm run build`
Expected: Build succeeds with 0 errors and output bundles emitted into `dist/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(auditreports): verify tests and successful production build"
```
