# Incident Report Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Incident Report document subsystem matching the OdysseyPH Brand Bible and Office Order architecture, including atomic control numbering (`IR-YYYY-MM-NNN`), AI paste parsing, rich-text editing, electronic signatures, admin management, and public verification.

**Architecture:** A modular document subsystem modeling the proven Office Order architecture: `incidentReportDocument.js` generates letter-sized branded HTML using `brandPage` with incident-specific metadata and severity styling; `incidentReportService.js` handles atomic Firestore counter transactions, status transitions, and e-signatures; and dedicated UI components provide editor, preview frame, admin controls, and public signing.

**Tech Stack:** React 19, Vite, Firebase Firestore (Transactions & Security Rules), TipTap Editor, Tailwind CSS / Vanilla CSS, Node.js Test Runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-06-incident-report-feature-design.md`

## Global Constraints

- Must strictly use OdysseyPH IT Solutions brand identity from `src/utils/brandDocument.js` (`BRAND_CO`, Navy `#16273a`, Orange `#ff6a13`, Poppins, Inter, Great Vibes).
- Tracking number format must strictly be `IR-YYYY-MM-NNN` (3-digit zero-padded sequence).
- Document width must be `816px` min-height `1056px` (US Letter) with `@media print` fidelity.
- Firestore operations for control numbering must run inside a transaction against `incidentReportCounters/{month}`.
- All text inputs must be sanitized/escaped before rendering into document HTML.

## Review Focus

1. **Unformatted / non-ISO date inputs in paste parser**: Incident dates typed as "Nov 6 2026" or "11/06/2026" should be normalized cleanly without throwing `NaN` or unreadable strings.
2. **Missing required fields during draft creation**: Attempting to create an incident report without a title, body, or reporter should fail gracefully with clear validation messages before hitting Firestore.
3. **Draft deletion vs. Issued immutability**: Issued incident reports cannot be edited or deleted (only closed or revoked), preventing tampering with official investigation records.
4. **Signer name mismatch on public signature page**: Typing a name differing from the allocated signer slot should be caught by client validation and security rules.
5. **Print styling integrity with multi-page annexes**: Multi-page incident reports and evidence annexes must break cleanly across letter pages without clipped headers or orphaned signature blocks.

---

### Task 1: Incident Report Document Utility & Template

**Files:**
- Create: `src/utils/incidentReportDocument.js`
- Test: `tests/incidentReportDocument.test.js`

**Interfaces:**
- Consumes: `BRAND_CO`, `esc`, `longDate`, `brandPage` from `src/utils/brandDocument.js`
- Produces:
  - `INCIDENT_REPORT_PREFIX = 'IR'`
  - `controlMonthOf(date?: Date): string`
  - `formatControlNumber(month: string, seq: number): string`
  - `incidentReportLink(id: string, origin?: string): string`
  - `SEVERITIES: Record<string, { label: string, color: string, bg: string }>`
  - `CATEGORIES: Record<string, string>`
  - `SIGNER_KINDS: Record<string, string>`
  - `emptyIncidentSigners(): object`
  - `AI_INCIDENT_PROMPT: string`
  - `parseIncidentReportText(raw: string): object`
  - `buildIncidentReportHtml(report: object, signatures?: object, options?: object): string`

- [ ] **Step 1: Write the failing unit tests for `incidentReportDocument.js`**

Create `tests/incidentReportDocument.test.js` using `node:test` testing:
- Control number formatting (`IR-2026-11-001`).
- `parseIncidentReportText` with AI-generated text containing title, category, severity, incident date, location, sections, and signers.
- `buildIncidentReportHtml` ensuring output contains `INCIDENT REPORT`, the control number, severity badge, brand header, and signers block.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/incidentReportDocument.test.js`
Expected: FAIL ("Cannot find module '../src/utils/incidentReportDocument.js'")

- [ ] **Step 3: Implement `src/utils/incidentReportDocument.js`**

Implement:
- Constants (`INCIDENT_REPORT_PREFIX = 'IR'`, `SEVERITIES`, `CATEGORIES`, `SIGNER_KINDS`, `emptyIncidentSigners`).
- Numbering helpers (`controlMonthOf`, `formatControlNumber`, `incidentReportLink`).
- AI paste parsing (`AI_INCIDENT_PROMPT`, `parseIncidentReportText`, `normalizeBody`).
- HTML document builder `buildIncidentReportHtml` using `brandPage` with:
  - Branded header and title band (`INCIDENT REPORT`, `IR-YYYY-MM-NNN`).
  - Metadata table (Date/Time of Incident, Reported Date, Location, Category, Severity badge pill, Reported By, Persons Involved).
  - Numbered sections (Overview, Immediate Actions, Root Cause, CAPA) with orange numbered badges.
  - Signer blocks (Reporter, Investigator, Approver, Acknowledger) supporting Great Vibes cursive signatures and signed timestamps.
  - Annex pages split by `# Annex`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/incidentReportDocument.test.js`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/incidentReportDocument.js tests/incidentReportDocument.test.js
git commit -m "feat: add incident report document template and parser utility"
```

---

### Task 2: Firestore Service & Security Rules

**Files:**
- Create: `src/services/incidentReportService.js`
- Modify: `firestore.rules:895-945`

**Interfaces:**
- Consumes: `src/lib/firebase.js` (`auth`, `db`), `src/utils/incidentReportDocument.js` (`controlMonthOf`, `formatControlNumber`)
- Produces:
  - `subscribeIncidentReports(onData, onError): Unsubscribe`
  - `subscribeIncidentReport(id, onData, onError): Unsubscribe`
  - `subscribeIncidentSignatures(id, onData, onError): Unsubscribe`
  - `createIncidentReport(user, form): Promise<string>`
  - `updateIncidentReport(user, id, form): Promise<void>`
  - `issueIncidentReport(user, id): Promise<void>`
  - `closeIncidentReport(user, id, reason): Promise<void>`
  - `revokeIncidentReport(user, id, reason): Promise<void>`
  - `deleteIncidentReportDraft(id): Promise<void>`
  - `signIncidentReport(id, slotId, name, user): Promise<void>`

- [ ] **Step 1: Implement `src/services/incidentReportService.js`**

Implement full service:
- Form validation checking required fields (title, body, severity, category, at least one reporter and approver).
- Atomic transaction reserving sequence number in `incidentReportCounters/{month}` and writing draft report in `incidentReports/{id}`.
- Real-time Firestore snapshot listeners for list, single report, and signatures subcollection.
- Status update functions (`issueIncidentReport`, `closeIncidentReport`, `revokeIncidentReport`).
- E-signature writer `signIncidentReport` writing to `incidentReports/{id}/signatures/{slotId}`.

- [ ] **Step 2: Update `firestore.rules`**

Add security rules for `incidentReportCounters` and `incidentReports` matching the spec:
- Admin permission check via `incidentReportAdmin()`.
- Atomic sequence increment check for counters.
- Draft creation validation requiring status `'draft'`.
- Immutability of issued reports (only status transitions to `'closed'` or `'revoked'` permitted).
- Signature validation on `incidentReports/{reportId}/signatures/{slotId}` verifying valid signer slot and name matching.

- [ ] **Step 3: Verify security rules syntax and build**

Run: `npm run build`
Expected: Successful compilation without syntax errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/incidentReportService.js firestore.rules
git commit -m "feat: add incident report firestore service and security rules"
```

---

### Task 3: Incident Report Frame & Editor Components

**Files:**
- Create: `src/components/incidentReports/IncidentReportFrame.jsx`
- Create: `src/components/incidentReports/IncidentReportFrame.css`
- Create: `src/components/incidentReports/IncidentReportEditor.jsx`
- Create: `src/components/incidentReports/IncidentReportEditor.css`

**Interfaces:**
- Consumes: `src/utils/incidentReportDocument.js`, TipTap extensions (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`)
- Produces:
  - `<IncidentReportFrame report={report} signatures={signatures} scale={scale} />`
  - `<IncidentReportEditor form={form} controlNumber={controlNumber} initialContent={initialContent} onField={onField} onDoc={onDoc} onParsed={onParsed} />`

- [ ] **Step 1: Implement `IncidentReportFrame.jsx` & `IncidentReportFrame.css`**

Implement iframe preview:
- Live document preview using `srcdoc` generated from `buildIncidentReportHtml`.
- Responsive container scaling the 816px letter page to fit parent container width.
- Dynamic height adjustment based on content height.

- [ ] **Step 2: Implement `IncidentReportEditor.jsx` & `IncidentReportEditor.css`**

Implement editor component:
- Metadata fields: Title, Incident Date, Incident Time, Date Reported, Location, Category dropdown, Severity selection pills (Low, Medium, High, Critical), Reported By (Name & Title), Persons Involved.
- AI Quick Paste modal/textarea with 1-click import that calls `parseIncidentReportText` and populates all form fields.
- Signer slot management: dynamic slots with role selector (`Reported by`, `Investigated by`, `Approved by`, `Acknowledged by`), name, and title.
- TipTap rich-text editor configured with StarterKit, Table, and Text Alignment for narrative sections.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Successful compilation.

- [ ] **Step 4: Commit**

```bash
git add src/components/incidentReports/
git commit -m "feat: add incident report frame and editor components"
```

---

### Task 4: Admin Management Integration

**Files:**
- Create: `src/pages/AdminIncidentReports.jsx`
- Create: `src/pages/AdminIncidentReports.css`
- Modify: `src/utils/navigationConfig.js:145-165`
- Modify: `src/pages/Admin.jsx:60-70, 880-900`

**Interfaces:**
- Consumes: `incidentReportService.js`, `IncidentReportEditor`, `IncidentReportFrame`
- Produces: Admin tab component `<AdminIncidentReports firebaseUser={firebaseUser} can={can} />`

- [ ] **Step 1: Register navigation and permissions in `src/utils/navigationConfig.js`**

Add `incidentreports` under system navigation:
```javascript
{
  id: 'incidentreports',
  label: 'Incident Reports',
  desc: 'Incident logging, CAPA & signoffs',
  icon: AlertOctagon,
  color: '#ef4444',
  actions: [
    { id: 'incidentreports:manage', label: 'Manage Incident Reports', desc: 'Draft, issue, sign and close incident reports' },
  ],
}
```

- [ ] **Step 2: Implement `AdminIncidentReports.jsx` & `AdminIncidentReports.css`**

Implement dashboard:
- Metrics summary cards (Total Incidents, Drafts, Issued / In Investigation, Critical / High severity).
- Search and filter bar (filter by status `draft | issued | closed | revoked`, severity, category).
- Data table listing control number, title, category, severity pill, incident date, status badge, and actions (View, Edit, Print, Copy link).
- Slide-over/modal drawer for Create & Edit with live frame preview, "Issue Report", "Revoke", "Close / Resolve", and Admin 1-click signing.

- [ ] **Step 3: Wire into `src/pages/Admin.jsx`**

- Import `AdminIncidentReports` via `lazy(() => import('./AdminIncidentReports'))`.
- Render `<AdminIncidentReports firebaseUser={firebaseUser} can={can} />` when `activeTab === 'incidentreports' && hasPermission('incidentreports')`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean compilation with newly added admin module.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminIncidentReports.jsx src/pages/AdminIncidentReports.css src/utils/navigationConfig.js src/pages/Admin.jsx
git commit -m "feat: integrate incident reports into admin dashboard and navigation"
```

---

### Task 5: Standalone Public Verification & Signing Page

**Files:**
- Create: `src/pages/IncidentReportPage.jsx`
- Create: `src/pages/IncidentReportPage.css`
- Modify: `src/App.jsx:20-30, 90-105`

**Interfaces:**
- Consumes: `incidentReportService.js`, `IncidentReportFrame`, `src/utils/incidentReportDocument.js`
- Produces: Public route `/incident-report/:id`

- [ ] **Step 1: Implement `IncidentReportPage.jsx` & `IncidentReportPage.css`**

Implement public verification page:
- Reads `:id` from `useParams()`.
- Subscribes to real-time report and signatures.
- Top bar with OdysseyPH logo, document control number, Print button, and zoom controls.
- Letter document preview with `IncidentReportFrame`.
- Electronic signing drawer/card:
  - Displays unsigned slots allocated to the viewer (Reporter, Investigator, Approver, Acknowledger).
  - Name input matching signer slot.
  - Agreement checkbox acknowledging factual correctness of report.
  - "Sign Electronically" action that records signature in Firestore.

- [ ] **Step 2: Register route in `src/App.jsx`**

- Lazy load `IncidentReportPage`.
- Add `<Route path="/incident-report/:id" element={<IncidentReportPage />} />`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Zero build errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/IncidentReportPage.jsx src/pages/IncidentReportPage.css src/App.jsx
git commit -m "feat: add public incident report verification and signing page"
```

---

### Task 6: End-to-End Verification & Sanity Checks

**Files:**
- Test: `tests/incidentReportDocument.test.js`

- [ ] **Step 1: Run unit tests**

Run: `node --test tests/incidentReportDocument.test.js`
Expected: PASS.

- [ ] **Step 2: Verify full project build**

Run: `npm run build`
Expected: Exit code 0, dist bundle successfully generated.

- [ ] **Step 3: Verification of Brand Bible compliance**

Inspect generated HTML structure:
- Verified ODC mark `/brand/odc-mark.svg` present.
- Verified Navy `#16273a` and Orange `#ff6a13` brand styling present.
- Verified control number prefix `IR-` present.
- Verified Letter page dimensions (`816px`) and font declarations (`Inter`, `Poppins`, `Great Vibes`) present.
