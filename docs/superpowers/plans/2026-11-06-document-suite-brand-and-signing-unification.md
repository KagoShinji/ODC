# Document Suite Brand & Electronic Signing Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all company documents (Billing Statement / SOA, MOA, Certificate of Acceptance / COA, and Acknowledgement Receipt / AR) to strictly adopt the Brand Bible visual template and electronic signing system used by Office Orders and Incident Reports.

**Architecture:** Implement modular document engines (`billingStatementDocument.js`, `moaDocument.js`, `acceptanceDocument.js`, `acknowledgementReceipt.js`) consuming `brandDocument.js` (`brandPage`). Replace dark glassmorphism card views with the modern split-view verification/signing portal (`ClientInvoicePage`, `ClientMOAPage`, `AcceptancePage`, `ClientReceiptPage`). Add Firestore security rules and signature subcollections for auditable multi-party digital signing.

**Tech Stack:** React 19, Firebase / Firestore v12, Vite 7, CSS / Brand Bible (`#16273a` navy, `#ff6a13` orange, Poppins, Inter, Great Vibes), Node.js test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-06-document-suite-brand-and-signing-unification-design.md`

## Global Constraints
- Strictly reuse `brandPage` from `src/utils/brandDocument.js` for all document generation.
- Colors: Navy `#16273a` and Voyage Orange `#ff6a13`.
- Dimensions: US Letter `816px × 1056px` with zero-margin `@media print` fidelity.
- Cursive Font: `'Great Vibes', cursive` for electronic signature marks.
- Audit Trail: Store signer name, local Philippine timestamp (`Asia/Manila`), user agent, and UID.
- Backwards Compatibility: Read legacy doc fields (`preparedSigned`, `clientSigned`, etc.) alongside new signature subcollections.

## Review Focus
1. Public Verification Access: Issued, paid, accepted, and executed documents must remain accessible and printable by authorized link holders without throwing "expired link" errors.
2. Signer Exact Name Verification: Signers must type their exact designated name (`normalizeSignerName`) before their electronic signature is accepted.
3. Multi-page Annexes & Print Quality: MOAs with long scope items or multi-page sections must paginate cleanly without clipping headers, bands, or signature blocks.
4. Zero Distortion on Payment QRs: Bank details and QR codes in Billing Statements must render with crisp edges and proper aspect ratio in both web preview and print output.
5. Backwards Compatibility: Existing historical invoices, MOAs, COAs, and receipts in Firestore must render faithfully without breaking.

---

### Task 1: Billing Statement Document Engine (`billingStatementDocument.js`)

**Files:**
- Create: `src/utils/billingStatementDocument.js`
- Test: `tests/billingStatementDocument.test.js`

- [ ] **Step 1: Write the failing unit tests for billing statement generation**
  - Assertions for title band (`BILLING STATEMENT`), control tracking number (`SOA-YYYY-MM-NNN`), ODC logo, items table, totals, GoTyme/MariBank QR payment section, and cursive signature blocks.
- [ ] **Step 2: Run test to confirm it fails**
  - Command: `node --test tests/billingStatementDocument.test.js`
- [ ] **Step 3: Implement `src/utils/billingStatementDocument.js`**
  - Export `buildBillingStatementHtml(inv, signatures, options)`, `statementNumberFor(inv)`, `PAYMENT_TERMS`.
  - Format items table, total due in Philippine Pesos, payment instructions, bank accounts, and Great Vibes signature blocks.
- [ ] **Step 4: Run test to confirm it passes**
  - Command: `node --test tests/billingStatementDocument.test.js`
- [ ] **Step 5: Commit changes**
  - Command: `git add src/utils/billingStatementDocument.js tests/billingStatementDocument.test.js && git commit -m "feat(billing): add branded billing statement document generator and tests"`

---

### Task 2: MOA Document Engine (`moaDocument.js`)

**Files:**
- Create: `src/utils/moaDocument.js`
- Test: `tests/moaDocument.test.js`

- [ ] **Step 1: Write the failing unit tests for MOA document generation**
  - Assertions for title band (`MEMORANDUM OF AGREEMENT`), tracking number (`MOA-YYYY-MM-NNN`), parties block (Party A Client & Party B Provider), numbered contract sections (Purpose, Scope of Work, Project Cost, Development Timeline), and dual-party signature blocks.
- [ ] **Step 2: Run test to confirm it fails**
  - Command: `node --test tests/moaDocument.test.js`
- [ ] **Step 3: Implement `src/utils/moaDocument.js`**
  - Export `buildMoaHtml(moa, signatures, options)`, `moaNumberFor(moa)`.
  - Support both structured sections and freeform legal text, with multi-page page breaks and Great Vibes cursive signatures.
- [ ] **Step 4: Run test to confirm it passes**
  - Command: `node --test tests/moaDocument.test.js`
- [ ] **Step 5: Commit changes**
  - Command: `git add src/utils/moaDocument.js tests/moaDocument.test.js && git commit -m "feat(moa): add branded memorandum of agreement document generator and tests"`

---

### Task 3: Certificate of Acceptance & Acknowledgement Receipt Engines

**Files:**
- Create: `src/utils/acceptanceDocument.js`
- Modify: `src/utils/acknowledgementReceipt.js`
- Test: `tests/acceptanceAndReceiptDocument.test.js`

- [ ] **Step 1: Write the failing unit tests for COA and AR generation**
  - Assertions for COA title band (`CERTIFICATE OF ACCEPTANCE`), project turnover declaration, verified deliverables checklist, dual-party signatures, and AR Great Vibes cursive signatures.
- [ ] **Step 2: Run test to confirm it fails**
  - Command: `node --test tests/acceptanceAndReceiptDocument.test.js`
- [ ] **Step 3: Implement `src/utils/acceptanceDocument.js` and upgrade `acknowledgementReceipt.js`**
  - Export `buildAcceptanceCertificateHtml(coa, signatures, options)`.
  - Update `buildReceiptHtml(receipt, { signatures, ... })` to render Great Vibes cursive signature marks and official Philippine timestamps.
- [ ] **Step 4: Run test to confirm it passes**
  - Command: `node --test tests/acceptanceAndReceiptDocument.test.js`
- [ ] **Step 5: Commit changes**
  - Command: `git add src/utils/acceptanceDocument.js src/utils/acknowledgementReceipt.js tests/acceptanceAndReceiptDocument.test.js && git commit -m "feat(documents): add certificate of acceptance generator and upgrade acknowledgement receipt signatures"`

---

### Task 4: Public Verification & Signing Pages (`/invoice/:id`, `/moa/:id`, `/acceptance/:id`, `/receipt/:id`)

**Files:**
- Modify: `src/pages/ClientInvoicePage.jsx`
- Modify: `src/pages/ClientMOAPage.jsx`
- Modify: `src/pages/AcceptancePage.jsx`
- Modify: `src/pages/ClientReceiptPage.jsx`
- Create: `src/pages/DocumentPortalPage.css`

- [ ] **Step 1: Create shared styling for document verification & signing portals**
  - Responsive split layout: Top bar (branding + actions), main document iframe preview, sticky signing & metadata sidebar.
- [ ] **Step 2: Upgrade `ClientInvoicePage.jsx` (`/invoice/:id`)**
  - Embed `buildBillingStatementHtml` in live preview frame.
  - Add signature sidebar allowing Staff Rep and Founder to sign, and clients to view verified statement.
  - Enable persistent viewing and PDF printing for paid/settled statements.
- [ ] **Step 3: Upgrade `ClientMOAPage.jsx` (`/moa/:id`)**
  - Embed `buildMoaHtml` in live preview frame.
  - Add signature sidebar supporting Provider and Client authorized sign-offs with exact-name validation, cursive preview, and confirmation checkbox.
- [ ] **Step 4: Upgrade `AcceptancePage.jsx` (`/acceptance/:id`)**
  - Embed `buildAcceptanceCertificateHtml` in live preview frame.
  - Add signature sidebar supporting client turnover acceptance sign-off.
- [ ] **Step 5: Upgrade `ClientReceiptPage.jsx` (`/receipt/:id`)**
  - Update preview to use upgraded `buildReceiptHtml` with cursive signatures.
- [ ] **Step 6: Commit changes**
  - Command: `git add src/pages/ClientInvoicePage.jsx src/pages/ClientMOAPage.jsx src/pages/AcceptancePage.jsx src/pages/ClientReceiptPage.jsx src/pages/DocumentPortalPage.css && git commit -m "feat(portals): modernize public verification and signing pages to branded split layout"`

---

### Task 5: Security Rules & Signature Services

**Files:**
- Modify: `firestore.rules`
- Create: `src/services/documentSignatureService.js`

- [ ] **Step 1: Implement `src/services/documentSignatureService.js`**
  - Universal helpers: `subscribeDocumentSignatures(collection, id, onData)`, `signDocumentSlot(collection, id, slotId, name, user)`.
  - Support legacy and subcollection signature normalization.
- [ ] **Step 2: Update `firestore.rules`**
  - Allow public `get` on `/invoices/{id}`, `/moas/{id}`, `/certificates/{id}`, and `/receipts/{id}` for verification.
  - Add `signatures/{slotId}` subcollection rules for each document type with exact name validation.
- [ ] **Step 3: Test and deploy rules to Firebase**
  - Verify syntax and run `npx firebase deploy --only firestore:rules --project odc-website-ce8bf`.
- [ ] **Step 4: Commit changes**
  - Command: `git add firestore.rules src/services/documentSignatureService.js && git commit -m "feat(security): add signature subcollection rules and universal document signing service"`

---

### Task 6: Admin Dashboard Document Integration & End-to-End Verification

**Files:**
- Modify: `src/pages/AdminInvoices.jsx`
- Modify: `src/pages/AdminMOA.jsx`
- Modify: `src/pages/AdminAcceptance.jsx`

- [ ] **Step 1: Update `AdminInvoices.jsx`**
  - Replace old print popup with `buildBillingStatementHtml` and live iframe preview in detail drawer.
- [ ] **Step 2: Update `AdminMOA.jsx`**
  - Replace old print popup with `buildMoaHtml` and live iframe preview in detail drawer.
- [ ] **Step 3: Update `AdminAcceptance.jsx`**
  - Replace old print popup with `buildAcceptanceCertificateHtml` and live iframe preview in detail drawer.
- [ ] **Step 4: Run full test suite and Vite production build**
  - Command: `node --test tests/*.test.js && npm run build`
- [ ] **Step 5: Commit changes**
  - Command: `git add src/pages/AdminInvoices.jsx src/pages/AdminMOA.jsx src/pages/AdminAcceptance.jsx && git commit -m "feat(admin): integrate unified branded document templates into admin dashboards"`

