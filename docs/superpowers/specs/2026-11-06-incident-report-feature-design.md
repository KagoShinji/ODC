# Design Specification: Incident Report Document Subsystem

**Date:** 2026-11-06  
**Status:** Approved for Implementation  
**Topic:** Incident Report Feature matching Brand Bible and Office Order Template  

---

## 1. Overview & Objectives

OdysseyPH IT Solutions requires a standardized, professional, and audited system to log, investigate, approve, and record operational, technical, workplace, and security incidents. 

This feature introduces an **Incident Report** subsystem designed to:
1. Follow OdysseyPH IT Solutions' official **Brand Bible** template (reusing `brandPage` shell with official ODC mark, `#16273a` navy header band, `#ff6a13` orange accent tab, Poppins & Inter typography, letter print format, and verification footer).
2. Follow the architectural and visual pattern established by **Office Orders** (`OO-`): atomic control numbering (`IR-YYYY-MM-NNN`), multi-slot electronic signatures with cursive font, AI-assisted paste parsing, draft/issued/closed lifecycle, and a public verification and signing URL.
3. Provide rich incident-specific metadata (category, severity badge, incident date/time, location, persons involved, root cause analysis, CAPA action plans).

---

## 2. Brand Bible & Visual Specification

The rendered document adheres strictly to the OdysseyPH IT Solutions corporate document standard:

- **Page Dimensions**: US Letter (`816px` width × `1056px` height min-height), scalable on smaller screens via an iframe container with `@media print` fidelity.
- **Header**: Official SVG mark (`/brand/odc-mark.svg`), company name `ODYSSEYPH IT SOLUTIONS` in bold Poppins, address (`3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu`), email, contact phone, and website.
- **Title Band**:
  - Left Accent Tab: `#ff6a13` (Orange), 64px width.
  - Main Bar: `#16273a` (Deep Navy) with title `INCIDENT REPORT` in Poppins bold letterspaced.
  - Right Document Box: `CONTROL / TRACKING NO.` label with `IR-YYYY-MM-NNN` in orange.
- **Footer**: Verification URL (`Verify: odysseyph.com/incident-report/<id>`) on the left, `Incident Report IR-YYYY-MM-NNN` on the right, capped with a 6px navy/orange bar.
- **Typography**: Inter (body, 12.3px, line-height 1.65), Poppins (headings and titles), and 'Great Vibes' (electronic cursive signatures).
- **Watermark Stamp**: Large diagonal watermark for `DRAFT`, `REVOKED`, or `CLOSED`.

---

## 3. Data Model & Tracking Numbering

### 3.1 Control Numbering Format
- **Pattern**: `IR-YYYY-MM-NNN` (e.g., `IR-2026-11-001`).
- **Counter Storage**: Stored in Firestore document `incidentReportCounters/{YYYY-MM}` with field `{ last: <number> }`.
- **Reservation**: Atomically reserved inside a Firestore transaction when creating a draft.

### 3.2 Incident Report Document Schema (`incidentReports/{id}`)
```typescript
interface IncidentReport {
  id: string;
  controlNumber: string;         // 'IR-YYYY-MM-NNN'
  controlMonth: string;          // 'YYYY-MM'
  controlSeq: number;            // 1, 2, 3...
  title: string;                 // Subject/Title of incident (max 300 chars)
  incidentDate: string;          // ISO date or formatted date (e.g., '2026-11-06')
  incidentTime: string;          // e.g., '09:30 AM' or '14:15'
  dateReported: string;          // ISO date (e.g., '2026-11-06')
  location: string;              // Branch, facility, workstation, or remote system (max 200 chars)
  category: 'operational' | 'security' | 'conduct' | 'safety' | 'equipment' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedByName: string;        // Person filing report (max 200 chars)
  reportedByTitle: string;       // Job title of person filing (max 200 chars)
  personsInvolved: string;       // Names and roles of involved parties/witnesses (max 300 chars)
  body: string;                  // Plain text / markdown version for search & export (max 80,000 chars)
  bodyJson: string;              // JSON serialized TipTap state (max 400,000 chars)
  signers: {
    [slotId: string]: {
      kind: 'reporter' | 'investigator' | 'approver' | 'acknowledger';
      name: string;
      title: string;
      order: number;
    }
  };
  status: 'draft' | 'issued' | 'closed' | 'revoked';
  statusReason?: string;         // Optional note for closure or revocation (max 500 chars)
  createdAt: Timestamp;
  createdByUid: string;
  createdByName: string;
  updatedAt: Timestamp;
  updatedByUid: string;
  issuedAt?: Timestamp;
  closedAt?: Timestamp;
  revokedAt?: Timestamp;
}
```

### 3.3 Signatures Subcollection (`incidentReports/{id}/signatures/{slotId}`)
```typescript
interface IncidentSignature {
  name: string;                  // Typed name matching signer slot (case-insensitive)
  signedAt: Timestamp;
  signedByUid: string;           // Firebase UID if authenticated, or empty string
  userAgent: string;
}
```

---

## 4. Document Sections & AI Paste Parser

### 4.1 Narrative Sections
1. **1. Incident Overview & Summary**: Chronological timeline and factual summary of what happened.
2. **2. Immediate Actions Taken**: Emergency actions, isolation, or containment implemented immediately.
3. **3. Root Cause Analysis & Findings**: Primary root causes, technical flaws, or procedural gaps identified.
4. **4. Corrective & Preventive Actions (CAPA)**: Permanent remediations, assignees, and target completion dates.
5. **Annexes** (Optional): Headers starting with `# Annex A — ...` generate distinct secondary annex pages.

### 4.2 AI Prompt & Paste Parsing
`src/utils/incidentReportDocument.js` provides `AI_INCIDENT_PROMPT` and `parseIncidentReportText(raw)` which parses pasted content from ChatGPT/Gemini/Word:
- Detects header keys: `TITLE:`, `INCIDENT DATE:`, `TIME:`, `LOCATION:`, `CATEGORY:`, `SEVERITY:`, `REPORTED BY:`, `PERSONS INVOLVED:`.
- Detects signature sections: `Reported by:`, `Investigated by:`, `Approved by:`, `Acknowledged by:`.
- Normalizes numbered section headers (`1. Incident Overview`, `SECTION 2...`) into standard `## 1. ...` markdown.

---

## 5. Security Rules Specification (`firestore.rules`)

Add the following rules to `firestore.rules`:
```javascript
// ─── Incident Reports ───
function incidentReportAdmin() {
  return operationsRoot() || (request.auth != null && staffAction('incidentreports:manage'));
}

function validIncidentReport(d) {
  return d.keys().hasOnly([
    'controlNumber', 'controlMonth', 'controlSeq', 'title', 'incidentDate', 'incidentTime',
    'dateReported', 'location', 'category', 'severity', 'reportedByName', 'reportedByTitle',
    'personsInvolved', 'body', 'bodyJson', 'signers', 'status', 'statusReason',
    'createdAt', 'createdByUid', 'createdByName', 'updatedAt', 'updatedByUid',
    'issuedAt', 'closedAt', 'revokedAt'
  ]) &&
  docText(d.title, 1, 300) &&
  docText(d.incidentDate, 0, 20) &&
  docText(d.incidentTime, 0, 30) &&
  docText(d.dateReported, 0, 20) &&
  docText(d.location, 0, 200) &&
  d.category in ['operational', 'security', 'conduct', 'safety', 'equipment', 'other'] &&
  d.severity in ['low', 'medium', 'high', 'critical'] &&
  docText(d.reportedByName, 0, 200) &&
  docText(d.reportedByTitle, 0, 200) &&
  docText(d.personsInvolved, 0, 300) &&
  docText(d.body, 0, 80000) &&
  docText(d.get('bodyJson', ''), 0, 400000) &&
  d.signers is map && d.signers.size() <= 12 &&
  d.status in ['draft', 'issued', 'closed', 'revoked'] &&
  docText(d.get('statusReason', ''), 0, 500) &&
  d.controlMonth.matches('[0-9]{4}-[0-9]{2}') &&
  d.controlSeq is int && d.controlSeq > 0 &&
  d.controlNumber == 'IR-' + d.controlMonth + '-' + seqText(d.controlSeq) &&
  d.updatedAt == request.time && d.updatedByUid == request.auth.uid;
}

match /incidentReportCounters/{month} {
  allow get: if incidentReportAdmin();
  allow create, update: if incidentReportAdmin() && month.matches('[0-9]{4}-[0-9]{2}') &&
    request.resource.data.keys().hasOnly(['last']) &&
    request.resource.data.last == (resource == null ? 1 : resource.data.last + 1);
  allow list, delete: if false;
}

match /incidentReports/{reportId} {
  allow get: if incidentReportAdmin() || resource.data.status in ['issued', 'closed', 'revoked'];
  allow list: if incidentReportAdmin();
  allow create: if incidentReportAdmin() && validIncidentReport(request.resource.data) &&
    request.resource.data.status == 'draft' &&
    request.resource.data.createdAt == request.time && request.resource.data.createdByUid == request.auth.uid &&
    afterRecord('incidentReportCounters', request.resource.data.controlMonth).last == request.resource.data.controlSeq;
  allow update: if incidentReportAdmin() && validIncidentReport(request.resource.data) &&
    unchanged(['controlNumber', 'controlMonth', 'controlSeq', 'createdAt', 'createdByUid', 'createdByName']) &&
    (resource.data.status == 'draft'
      ? request.resource.data.status == 'draft' || (request.resource.data.status == 'issued' && request.resource.data.issuedAt == request.time)
      : (resource.data.status == 'issued' && request.resource.data.status in ['closed', 'revoked'] &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'statusReason', 'closedAt', 'revokedAt', 'updatedAt', 'updatedByUid'])));
  allow delete: if incidentReportAdmin() && resource.data.status == 'draft';

  match /signatures/{slotId} {
    allow read: if incidentReportAdmin() || record('incidentReports', reportId).status in ['issued', 'closed', 'revoked'];
    allow create: if record('incidentReports', reportId).status in ['issued', 'closed'] &&
      record('incidentReports', reportId).signers.keys().hasAny([slotId]) &&
      request.resource.data.keys().hasOnly(['name', 'signedAt', 'signedByUid', 'userAgent']) &&
      docText(request.resource.data.name, 2, 200) &&
      request.resource.data.signedAt == request.time &&
      docText(request.resource.data.userAgent, 0, 300) &&
      request.resource.data.signedByUid == (request.auth == null ? '' : request.auth.uid) &&
      (record('incidentReports', reportId).signers[slotId].name == '' ||
       request.resource.data.name.trim().lower() == record('incidentReports', reportId).signers[slotId].name.trim().lower());
    allow update, delete: if false;
  }
}
```

---

## 6. Architecture & Implementation Components

### 6.1 `src/utils/incidentReportDocument.js`
- Exports constants: `INCIDENT_REPORT_PREFIX = 'IR'`, `SEVERITIES`, `CATEGORIES`, `SIGNER_KINDS`, `AI_INCIDENT_PROMPT`.
- Exports helpers: `formatControlNumber`, `incidentReportLink`, `parseIncidentReportText`, `buildIncidentReportHtml`.
- Renders:
  - Top meta grid: Incident Date/Time, Reported Date, Location, Category, Severity badge pill, Reported By, Persons Involved.
  - Numbered sections with orange number tags.
  - Tables, callouts, lists, blockquotes.
  - Signer blocks with Great Vibes e-signature line, designation, and signed timestamp.

### 6.2 `src/services/incidentReportService.js`
- `subscribeIncidentReports(onData, onError)`: Real-time query ordered by `createdAt desc`.
- `subscribeIncidentReport(id, onData, onError)`: Real-time document subscription.
- `subscribeIncidentSignatures(id, onData, onError)`: Real-time signatures subcollection subscription.
- `createIncidentReport(user, form)`: Transaction allocating sequence in `incidentReportCounters` and creating draft.
- `updateIncidentReport(user, id, form)`: Updates draft report fields and TipTap `bodyJson`.
- `issueIncidentReport(user, id)`: Locks draft and transitions status to `issued`.
- `closeIncidentReport(user, id, reason)`: Marks report as `closed` / resolved.
- `revokeIncidentReport(user, id, reason)`: Marks report as `revoked`.
- `deleteIncidentReportDraft(id)`: Removes draft document.
- `signIncidentReport(id, slotId, name, user)`: Affixes signature to `signatures/{slotId}`.

### 6.3 `src/components/incidentReports/`
- **`IncidentReportEditor.jsx`**:
  - Inputs for Title, Incident Date, Incident Time, Location, Category dropdown, Severity radio/buttons, Reported By, Persons Involved.
  - Signer slot manager (add/remove signers with roles: Reporter, Investigator, Approver, Acknowledger).
  - Rich text editor with TipTap (Headings, bold, lists, tables) + AI draft quick-paste drawer.
- **`IncidentReportFrame.jsx`**:
  - Sandboxed iframe previewing live generated HTML from `buildIncidentReportHtml`.

### 6.4 `src/pages/`
- **`AdminIncidentReports.jsx`**:
  - Search and filter bar (by status, severity, category).
  - Overview cards: Total Incidents, Open/Draft, Issued, Critical/High count.
  - Table of reports with quick-action buttons (View, Edit, Print, Copy Link).
  - Detail/Editor modal allowing in-place editing, preview, issuing, admin signing, closing, or revoking.
- **`IncidentReportPage.jsx`**:
  - Standalone public verification route (`/incident-report/:id`).
  - Displays framed branded document with Zoom and Print controls.
  - Interactive signature box allowing designated signers to sign by entering their name and accepting terms.

### 6.5 App Routing & Navigation
- **`src/App.jsx`**: Add lazy route `<Route path="/incident-report/:id" element={<IncidentReportPage />} />`.
- **`src/utils/navigationConfig.js`**: Add `incidentreports` item with action `incidentreports:manage`, icon `AlertOctagon`, color `#ef4444`.
- **`src/pages/Admin.jsx`**: Render `<AdminIncidentReports firebaseUser={firebaseUser} can={can} />` when activeTab is `'incidentreports'`.

---

## 7. Verification & Testing Plan

1. **Unit & Formatting Verification**:
   - Verify control number generation format `IR-YYYY-MM-NNN`.
   - Test `parseIncidentReportText` against AI sample paste.
   - Verify `buildIncidentReportHtml` renders valid HTML containing brand header, metadata grid, severity badges, and signature blocks.
2. **Build & Lint Verification**:
   - Execute `npm run build` to confirm zero Vite build errors and bundle resolution.
3. **End-to-End Workflow Verification**:
   - Create a draft Incident Report with severity, category, location, and signers.
   - Edit draft content in TipTap editor and verify live frame preview updates.
   - Issue the Incident Report and verify it locks further content edits.
   - Navigate to `/incident-report/:id` and test electronic signature submission.
   - Confirm print popup window opens formatted letter page.
