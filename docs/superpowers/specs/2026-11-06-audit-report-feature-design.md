# Design Specification: Audit Report Document Subsystem

**Date:** 2026-11-06  
**Status:** In Review  
**Topic:** Audit Report Feature matching OdysseyPH Brand Bible, Office Order, and Incident Report Templates  

---

## 1. Overview & Objectives

OdysseyPH IT Solutions requires a standardized, professional, and audited system to conduct, document, review, approve, and track internal and external audits across all company disciplines.

This feature introduces an **Audit Report** subsystem designed to:
1. **Adhere to the OdysseyPH Brand Bible**: Reuse the corporate `brandPage` shell with the official ODC SVG mark, deep navy header bar (`#16273a`), orange accent tab (`#ff6a13`), Poppins & Inter typography, letter print format, and official verification footer.
2. **Follow established Document Suite Patterns**: Use atomic sequence control numbering (`AR-YYYY-MM-NNN`), multi-slot electronic signatures with cursive font styling, live sandboxed iframe preview, AI-assisted paste parsing (`AI_AUDIT_PROMPT`), a draft/issued/closed/revoked lifecycle, and a public verification and digital signing URL (`/audit-report/:id`).
3. **Capture Comprehensive Audit Metadata**: Track Audit Title, Audit Scope/Category (IT & Security, Operations, Financial, Compliance, Inventory, Quality), Overall Rating badge (*Satisfactory*, *Needs Improvement*, *Unsatisfactory*), Audit Period Covered, Date Conducted, Date Issued, Lead Auditor, and Audited Entity / Department.
4. **Support 4-Tier Governance Signoff**: Standardize signing slots for Lead Auditor (Prepared by), Audit Reviewer (Reviewed by), Management Approval (Approved by: Founder Jetch Merald S. Madaya), and Auditee / Department Head (Acknowledged by / Conforme).

---

## 2. Brand Bible & Visual Specification

The rendered document adheres strictly to the OdysseyPH IT Solutions corporate document standard:

- **Page Dimensions**: US Letter (`816px` width × `1056px` minimum height per page), auto-scaled responsively in viewport and formatted for crisp printing via `@media print`.
- **Header**: Official SVG mark (`/brand/odc-mark.svg`), corporate title `ODYSSEYPH IT SOLUTIONS` in bold Poppins, official office address (`3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu`), email, telephone, and website.
- **Title Band**:
  - Left Accent Tab: `#ff6a13` (Orange), 64px width.
  - Main Bar: `#16273a` (Deep Navy) with title `AUDIT REPORT` in Poppins bold letterspaced.
  - Right Document Box: `CONTROL / TRACKING NO.` label with `AR-YYYY-MM-NNN` in orange.
- **Footer**: Verification link (`Verify: odysseyph.com/audit-report/<id>`) on the left, `Audit Report AR-YYYY-MM-NNN` on the right, capped by a 6px deep navy/orange gradient bottom bar.
- **Typography**: Inter (body text, 12.3px, line-height 1.65), Poppins (headers, titles, and metadata tags), and Great Vibes (electronic cursive signatures).
- **Watermark Stamps**: Diagonal semi-transparent watermark for `DRAFT`, `REVOKED`, or `CLOSED`.
- **Rating Badges**:
  - `satisfactory`: Green badge (`#027a48`, background `#ecfdf3`)
  - `needs_improvement`: Amber badge (`#b54708`, background `#fffaeb`)
  - `unsatisfactory`: Red badge (`#b42318`, background `#fef3f2`)

---

## 3. Data Model & Tracking Numbering

### 3.1 Control Numbering Format
- **Pattern**: `AR-YYYY-MM-NNN` (e.g., `AR-2026-11-001`).
- **Counter Storage**: Stored in Firestore document `auditReportCounters/{YYYY-MM}` with field `{ last: <number> }`.
- **Atomic Reservation**: Reserved inside a Firestore transaction upon draft creation.

### 3.2 Audit Report Document Schema (`auditReports/{id}`)
```typescript
interface AuditReport {
  id: string;
  controlNumber: string;         // 'AR-YYYY-MM-NNN'
  controlMonth: string;          // 'YYYY-MM'
  controlSeq: number;            // 1, 2, 3...
  title: string;                 // Subject/Title of audit (max 300 chars)
  category: 'it_security' | 'operations' | 'financial' | 'compliance' | 'inventory' | 'quality' | 'other';
  rating: 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
  auditPeriodStart: string;      // ISO date (e.g. '2026-10-01')
  auditPeriodEnd: string;        // ISO date (e.g. '2026-10-31')
  auditDate: string;             // ISO date or formatted date (e.g. '2026-11-02')
  dateIssued: string;            // ISO date (e.g. '2026-11-06')
  leadAuditorName: string;       // Lead auditor full name (max 200 chars)
  leadAuditorTitle: string;      // Lead auditor position/designation (max 200 chars)
  auditeeEntity: string;         // Department, team, facility, or system audited (max 200 chars)
  auditeeContact: string;        // Department head or auditee contact person (max 200 chars)
  auditTeam: string;             // Comma-separated list of team members/observers (max 300 chars)
  body: string;                  // Plain text / markdown version for search & export (max 80,000 chars)
  bodyJson: string;              // JSON serialized TipTap state (max 400,000 chars)
  signers: {
    [slotId: string]: {
      kind: 'auditor' | 'reviewer' | 'approver' | 'acknowledger';
      name: string;
      title: string;
      order: number;
    }
  };
  status: 'draft' | 'issued' | 'closed' | 'revoked';
  statusReason?: string;         // Optional reason for closure or revocation (max 500 chars)
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

### 3.3 Signatures Subcollection (`auditReports/{id}/signatures/{slotId}`)
```typescript
interface AuditSignature {
  name: string;                  // Typed name matching signer slot (case-insensitive)
  signedAt: Timestamp;
  signedByUid: string;           // Firebase UID if authenticated, or empty string
  userAgent: string;
}
```

---

## 4. Document Sections & AI Paste Parser

### 4.1 Standard Audit Report Sections
1. **1. Executive Summary & Audit Objectives**: High-level background, objectives of the audit engagement, and executive conclusion.
2. **2. Scope & Methodology**: Boundaries of the audit, sampling techniques, systems/records inspected, and standards evaluated against (e.g., ISO, NIST, company SOP).
3. **3. Audit Findings & Observations**: Detailed condition observed, criteria/benchmark, root cause, and risk rating/impact.
4. **4. Recommendations & Corrective Action Plan (CAPA)**: Prescribed remediations, management action items, assigned department owners, and target completion deadlines.
5. **Annexes** (Optional): Headers starting with `# Annex A — ...` generate distinct secondary annex pages.

### 4.2 AI Prompt & Paste Parsing (`AI_AUDIT_PROMPT`)
`src/utils/auditReportDocument.js` provides `AI_AUDIT_PROMPT` and `parseAuditReportText(raw)` which parses pasted content from AI tools or Word:
- Detects header keys: `TITLE:`, `CATEGORY:`, `RATING:`, `PERIOD COVERED:`, `DATE CONDUCTED:`, `DATE ISSUED:`, `LEAD AUDITOR:`, `AUDITEE:`, `AUDIT TEAM:`.
- Detects signature sections: `Audited by:` / `Prepared by:`, `Reviewed by:`, `Approved by:`, `Acknowledged by:` / `Conforme:`.
- Normalizes numbered section headers (`1. Executive Summary`, `2. Scope...`) into clean markdown.

---

## 5. Security Rules Specification (`firestore.rules`)

```javascript
// ─── Audit Reports ───
function auditReportAdmin() {
  return operationsRoot() || (request.auth != null && staffAction('auditreports:manage'));
}

function validAuditReport(d) {
  return d.keys().hasOnly([
    'controlNumber', 'controlMonth', 'controlSeq', 'title', 'category', 'rating',
    'auditPeriodStart', 'auditPeriodEnd', 'auditDate', 'dateIssued',
    'leadAuditorName', 'leadAuditorTitle', 'auditeeEntity', 'auditeeContact', 'auditTeam',
    'body', 'bodyJson', 'signers', 'status', 'statusReason',
    'createdAt', 'createdByUid', 'createdByName', 'updatedAt', 'updatedByUid',
    'issuedAt', 'closedAt', 'revokedAt'
  ]) &&
  docText(d.title, 1, 300) &&
  d.category in ['it_security', 'operations', 'financial', 'compliance', 'inventory', 'quality', 'other'] &&
  d.rating in ['satisfactory', 'needs_improvement', 'unsatisfactory'] &&
  docText(d.get('auditPeriodStart', ''), 0, 20) &&
  docText(d.get('auditPeriodEnd', ''), 0, 20) &&
  docText(d.get('auditDate', ''), 0, 20) &&
  docText(d.get('dateIssued', ''), 0, 20) &&
  docText(d.leadAuditorName, 0, 200) &&
  docText(d.leadAuditorTitle, 0, 200) &&
  docText(d.auditeeEntity, 0, 200) &&
  docText(d.get('auditeeContact', ''), 0, 200) &&
  docText(d.get('auditTeam', ''), 0, 300) &&
  docText(d.body, 0, 80000) &&
  docText(d.get('bodyJson', ''), 0, 400000) &&
  d.signers is map && d.signers.size() <= 12 &&
  d.status in ['draft', 'issued', 'closed', 'revoked'] &&
  docText(d.get('statusReason', ''), 0, 500) &&
  d.controlMonth.matches('[0-9]{4}-[0-9]{2}') &&
  d.controlSeq is int && d.controlSeq > 0 &&
  d.controlNumber == 'AR-' + d.controlMonth + '-' + seqText(d.controlSeq) &&
  d.updatedAt == request.time && d.updatedByUid == request.auth.uid;
}

match /auditReportCounters/{month} {
  allow get: if auditReportAdmin();
  allow create, update: if auditReportAdmin() && month.matches('[0-9]{4}-[0-9]{2}') &&
    request.resource.data.keys().hasOnly(['last']) &&
    request.resource.data.last == (resource == null ? 1 : resource.data.last + 1);
  allow list, delete: if false;
}

match /auditReports/{reportId} {
  allow get: if auditReportAdmin() || resource.data.status in ['issued', 'closed', 'revoked'];
  allow list: if auditReportAdmin();
  allow create: if auditReportAdmin() && validAuditReport(request.resource.data) &&
    request.resource.data.status == 'draft' &&
    request.resource.data.createdAt == request.time && request.resource.data.createdByUid == request.auth.uid &&
    afterRecord('auditReportCounters', request.resource.data.controlMonth).last == request.resource.data.controlSeq;
  allow update: if auditReportAdmin() && validAuditReport(request.resource.data) &&
    unchanged(['controlNumber', 'controlMonth', 'controlSeq', 'createdAt', 'createdByUid', 'createdByName']) &&
    (resource.data.status == 'draft'
      ? request.resource.data.status == 'draft' || (request.resource.data.status == 'issued' && request.resource.data.issuedAt == request.time)
      : (resource.data.status == 'issued' && request.resource.data.status in ['closed', 'revoked'] &&
         ((request.resource.data.status == 'closed' && request.resource.data.closedAt == request.time) ||
          (request.resource.data.status == 'revoked' && request.resource.data.revokedAt == request.time)) &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'statusReason', 'closedAt', 'revokedAt', 'updatedAt', 'updatedByUid'])));
  allow delete: if auditReportAdmin() && resource.data.status == 'draft';

  match /signatures/{slotId} {
    allow read: if auditReportAdmin() || record('auditReports', reportId).status in ['issued', 'closed', 'revoked'];
    allow create: if record('auditReports', reportId).status in ['issued', 'closed'] &&
      record('auditReports', reportId).signers.keys().hasAny([slotId]) &&
      request.resource.data.keys().hasOnly(['name', 'signedAt', 'signedByUid', 'userAgent']) &&
      docText(request.resource.data.name, 2, 200) &&
      request.resource.data.signedAt == request.time &&
      docText(request.resource.data.userAgent, 0, 300) &&
      request.resource.data.signedByUid == (request.auth == null ? '' : request.auth.uid) &&
      (record('auditReports', reportId).signers[slotId].name == '' ||
       request.resource.data.name.trim().lower() == record('auditReports', reportId).signers[slotId].name.trim().lower()) &&
      (record('auditReports', reportId).signers[slotId].kind != 'approver' || auditReportAdmin());
    allow update, delete: if false;
  }
}
```

---

## 6. Architecture & Implementation Components

### 6.1 `src/utils/auditReportDocument.js`
- **Constants**:
  - `AUDIT_REPORT_PREFIX = 'AR'`
  - `AUDIT_CATEGORIES`: IT & Security, Operations, Financial, Compliance, Inventory, Quality, Other.
  - `AUDIT_RATINGS`: Satisfactory (Green), Needs Improvement (Amber), Unsatisfactory (Red).
  - `SIGNER_KINDS`: Auditor, Reviewer, Approver, Acknowledger.
  - `emptyAuditSigners()`: 4-tier default configuration.
  - `AI_AUDIT_PROMPT`: Standard prompt for AI generation.
- **Functions**:
  - `controlMonthOf(date)` & `formatControlNumber(month, seq)`
  - `auditReportLink(id, origin)`
  - `parseAuditReportText(raw)`: Header, section, and signer parser.
  - `buildAuditReportHtml(report, signatures, options)`: Returns styled corporate HTML.

### 6.2 `src/services/auditReportService.js`
- `subscribeAuditReports(onData, onError)`: Real-time query ordered by `createdAt desc`.
- `subscribeAuditReport(id, onData, onError)`: Real-time report document listener.
- `subscribeAuditSignatures(id, onData, onError)`: Real-time subcollection signatures listener.
- `createAuditReport(user, form)`: Transaction allocating monthly counter and inserting initial draft.
- `updateAuditReport(user, id, form)`: Updates draft metadata and `bodyJson`.
- `issueAuditReport(user, id)`: Locks draft and transitions status to `issued`.
- `closeAuditReport(user, id, reason)`: Marks report as `closed` (findings resolved).
- `revokeAuditReport(user, id, reason)`: Marks report as `revoked`.
- `deleteAuditReportDraft(id)`: Removes draft.
- `signAuditReport(id, slotId, name, user)`: Records digital signature in `signatures/{slotId}`.

### 6.3 `src/components/auditReports/`
- **`AuditReportEditor.jsx` & `AuditReportEditor.css`**:
  - Metadata controls: Title, Category, Rating selector with color tags, Audit Period (From/To), Date Conducted, Date Issued, Lead Auditor (Name/Title), Audited Entity, Auditee Contact, Audit Team.
  - Signer management: add, configure, re-order signer slots.
  - TipTap rich-text editor (headings, bold, lists, callouts, tables) with live sync.
  - AI Paste Drawer: quick one-click import of AI-generated audit reports.
- **`AuditReportFrame.jsx` & `AuditReportFrame.css`**:
  - Sandboxed iframe live previewing generated HTML with smooth zoom and page scaling.

### 6.4 `src/pages/`
- **`AdminAuditReports.jsx` & `AdminAuditReports.css`**:
  - Filter bar (status: all/draft/issued/closed/revoked; rating: satisfactory/needs improvement/unsatisfactory; category).
  - Metrics summary cards (Total Audits, Drafts, Issued & Active, High-Risk / Unsatisfactory count).
  - Action table: View, Edit, Print, Copy Verification Link, Delete draft, Issue, Close, Revoke.
  - Detail/Edit view with split editor and real-time live frame preview.
- **`AuditReportPage.jsx` & `AuditReportPage.css`**:
  - Public verification route (`/audit-report/:id`).
  - Read-only preview of document with print and zoom buttons.
  - Interactive signature portal allowing designated signers to sign with full verification audit log.

### 6.5 App Routing & Navigation
- **`src/App.jsx`**: Lazy load and route `/audit-report/:id` to `<AuditReportPage />`.
- **`src/utils/navigationConfig.js`**: Add `auditreports` item with action `auditreports:manage`, icon `ClipboardCheck`, color `#0ea5e9`.
- **`src/pages/Admin.jsx`**: Render `<AdminAuditReports firebaseUser={firebaseUser} can={can} />` when activeTab is `'auditreports'`.

---

## 7. Verification & Testing Plan

1. **Unit Tests (`tests/auditReportDocument.test.js`)**:
   - Verify control number formatting (`AR-YYYY-MM-NNN`).
   - Test `parseAuditReportText` against AI paste samples (verifying category, rating, dates, sections, and signers).
   - Test `buildAuditReportHtml` output for valid HTML structure, rating badge classes, metadata grid, and Great Vibes signature blocks.
2. **Build Verification**:
   - Run `npm test` and `npm run build` to ensure zero compilation or bundling errors.
3. **End-to-End Workflow Verification**:
   - Create an Audit Report draft in the Admin interface.
   - Paste an AI-generated draft into the paste drawer and verify parsed fields.
   - Edit content in the TipTap rich-text editor and observe live frame preview.
   - Issue the audit report and verify content locking.
   - Test the public `/audit-report/:id` route and complete a test digital signature.
