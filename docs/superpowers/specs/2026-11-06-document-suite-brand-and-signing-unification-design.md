# Document Suite Brand & Electronic Signing Unification Design Spec

**Date:** 2026-11-06  
**Status:** Approved  
**Author:** Antigravity & User  
**Scope:** Unify all official company documents (**Billing Statement / SOA**, **MOA**, **Certificate of Acceptance / COA**, and **Acknowledgement Receipt / AR**) to strictly adopt the **Brand Bible visual template** (`brandDocument.js` / `brandPage`) and the **electronic signing architecture** established by **Office Orders** and **Incident Reports**.

---

## 1. Problem Statement & Motivation
Previously, OdysseyPH IT Solutions used disparate styles across its document portfolio:
- **Office Orders** (`OO-`) and **Incident Reports** (`IR-`) followed the modern company Brand Bible: navy `#16273a` title band, orange `#ff6a13` accent tab, US Letter `816px × 1056px` dimensions, print fidelity, multi-slot cursive electronic signatures (`Great Vibes`), and split-view verification/signing pages.
- **Billing Statements** (`SOA-`), **MOAs**, **Certificates of Acceptance** (`COA-`), and **Acknowledgement Receipts** (`AR-`) lived in legacy dark-theme glassmorphism card layouts or custom HTML templates with inconsistent signature handling and expired public link behaviors.

This feature unifies all formal documents into a single, cohesive, enterprise-grade architecture.

---

## 2. Document Suite Matrix

| Document | Prefix / Tracking | Document Builder | Public URL | Admin Portal | Signer Roles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Billing Statement (SOA)** | `SOA-YYYY-MM-NNN` | `src/utils/billingStatementDocument.js` | `/invoice/:id` | `AdminInvoices.jsx` | `prepared` (Staff Rep), `approved` (Founder), `conforme` (Client) |
| **Memorandum of Agreement** | `MOA-YYYY-MM-NNN` | `src/utils/moaDocument.js` | `/moa/:id` | `AdminMOA.jsx` | `provider` (Party B Rep), `client` (Party A Rep), `witness1`, `witness2` |
| **Certificate of Acceptance** | `COA-YYYY-MM-NNN` | `src/utils/acceptanceDocument.js` | `/acceptance/:id` | `AdminAcceptance.jsx` | `issuer` (Odyssey Rep), `acceptor` (Client Rep) |
| **Acknowledgement Receipt** | `AR-YYYY-MM-NNN` | `src/utils/acknowledgementReceipt.js` | `/receipt/:id` | `AdminInvoices.jsx` / `ClientReceiptPage.jsx` | `prepared` (Finance), `approved` (Founder), `payer` (Client) |

---

## 3. Visual Template & Print Standards (`brandDocument.js`)

All documents must implement the `brandPage` shell:
1. **Header**:
   - Left: `/brand/odc-mark.svg` (height 58px) with `BRAND_CO.name` ("OdysseyPH IT Solutions"), official address (3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu), email, phone, web.
2. **Title Band**:
   - Height 64px, flex layout.
   - Left: Voyage Orange `#ff6a13` tab (width 64px).
   - Right: Navy `#16273a` bar with title in white bold Poppins (`BILLING STATEMENT`, `MEMORANDUM OF AGREEMENT`, `CERTIFICATE OF ACCEPTANCE`, `ACKNOWLEDGEMENT RECEIPT`), right-aligned tracking number (`SOA-...`, `MOA-...`, `COA-...`, `AR-...`).
3. **Dimensions & Print**:
   - Container: US Letter `816px × 1056px`, zero-margin `@page { size: letter; margin: 0; }`.
   - Typography: Poppins for headings, Inter for body and metadata, Great Vibes for signatures.
4. **Metadata Grid**:
   - Two-column or four-column `dl.kv` / `.inc-grid` with 10px uppercase tracking labels, navy bold values.
5. **Status Watermark Stamp**:
   - Diagonal 110px bold Poppins watermark: `PAID`, `EXECUTED`, `ACCEPTED`, `ISSUED`, `DRAFT`, `REVOKED`.
6. **Footer Bar**:
   - Left: Verification link (`Verify: odysseyph.com/...`).
   - Right: Document reference and tracking number.
   - Bottom accent line: 64px orange bar + navy bar.

---

## 4. Standard Electronic Signing Workflow

Each document type defines its signature slots. Public pages (`/invoice/:id`, `/moa/:id`, `/acceptance/:id`, `/receipt/:id`) share the unified split layout:
1. **Top Bar**:
   - ODC logo mark, document category label, tracking number, status pill (`Draft`, `Issued / Pending`, `Accepted / Paid / Executed`, `Revoked`).
   - Action buttons: **Copy Verification Link**, **Print / Save PDF**.
2. **Left Column**: Live branded US Letter document rendered via embedded iframe.
3. **Right Column (Sticky Action Sidebar)**:
   - Summary metadata box.
   - **Electronic Signature Section**:
     - Status badges for each signer slot (Signed with timestamp vs Pending).
     - Signature slot selector (dropdown if multiple lines are pending).
     - Full name input with exact-match validation against the target signer name.
     - Live cursive signature preview rendered in `'Great Vibes'`.
     - Legal acknowledgement checkbox ("I confirm... and agree that typing my name constitutes my electronic signature").
     - "Sign Document" button with async loading state.
4. **Signature Storage**:
   - Subcollections: `{docCollection}/{docId}/signatures/{slotId}` containing `{ name, signedAt, signedByUid, userAgent }`.
   - Backwards compatibility: Read both legacy doc-level signature fields (`preparedSigned`, `clientSigned`, etc.) and subcollection signatures so historical documents remain fully intact.

---

## 5. Security & Verification Rules (`firestore.rules`)
- **Public Read Access**: Allow `get` on `/invoices/{id}`, `/moas/{id}`, `/certificates/{id}`, and `/receipts/{id}` regardless of paid/accepted status so legitimate parties can verify and print.
- **Subcollection Write Access**: Allow creating signatures in `{docCollection}/{id}/signatures/{slotId}` if the document is in an active/issued state, the slot exists, the name matches the assigned signer, and rate-limits are honored.

