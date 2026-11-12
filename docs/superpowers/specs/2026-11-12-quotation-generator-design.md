# Design Specification: Quotation Generator Subsystem

**Date:** 2026-11-12  
**Document Code:** QT  
**Target:** OdysseyPH IT Solutions Platform  
**Status:** Approved Design Spec  

---

## 1. Overview & Business Intent

OdysseyPH IT Solutions requires a specialized, high-fidelity **Quotation Generator** modeled directly after the existing document systems: Office Orders (`OO`), Incident Reports (`IR`), and Certificate of Acceptance (`COA`). 

The Quotation Generator enables company leadership and project managers to create, manage, issue, and digitally sign professional project quotations and commercial price proposals. Quotations adhere strictly to the corporate brand bible (`brandDocument.js`), featuring automated sequential tracking numbers (`QT-YYYY-MM-XXX`), real-time itemized price calculations in Philippine Pesos (`₱`), customizable discounts and VAT options, rich-text scope and milestone deliverables via TipTap, and an interactive digital Conforme approval workflow for clients.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          OdysseyPH Admin App                           │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ navigationConfig.js   │             │ AdminQuotations.jsx        │  │
│  │ staffModulePermissions│ ──────────> │ (Table, Search, Status,    │  │
│  │ Admin.jsx (Tab)       │             │  Preview, Actions)         │  │
│  └───────────────────────┘             └─────────────┬──────────────┘  │
│                                                      │                 │
│                                                      ▼                 │
│                                        ┌────────────────────────────┐  │
│                                        │ QuotationEditor.jsx        │  │
│                                        │ • Header & Client Meta     │  │
│                                        │ • Dynamic Pricing Table    │  │
│                                        │ • TipTap Scope & Terms     │  │
│                                        │ • Smart AI / Paste Parser  │  │
│                                        └─────────────┬──────────────┘  │
│                                                      │                 │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │
                      ┌────────────────────────────────┴────────────────┐
                      │                                                 │
                      ▼                                                 ▼
      ┌───────────────────────────────┐                 ┌───────────────────────────────┐
      │ quotationDocument.js          │                 │ quotationService.js           │
      │ • HTML Builder (brandPage)    │                 │ • subscribeQuotations()       │
      │ • Control No (QT-YYYY-MM-XXX) │                 │ • createQuotation()           │
      │ • Calculation & Text Helpers  │                 │ • updateQuotation()           │
      │ • QuotationFrame.jsx          │                 │ • issueQuotation()            │
      │   (Print PDF / Save PNG)      │                 │ • revokeQuotation()           │
      └───────────────┬───────────────┘                 │ • signQuotation()             │
                      │                                 └───────────────┬───────────────┘
                      │                                                 │
                      ▼                                                 ▼
      ┌───────────────────────────────┐                 ┌───────────────────────────────┐
      │ QuotationPage.jsx             │                 │ Firestore Database            │
      │ Route: /quotation/:id         │                 │ • /quotations/{id}            │
      │ • Public Client Review        │ ──────────────> │ • /quotationCounters/{month}  │
      │ • Print / PDF                 │                 │ • .../signatures/{slotId}     │
      │ • Client Conforme Signing     │                 │ Rules: firestore.rules        │
      └───────────────────────────────┘                 └───────────────────────────────┘
```

---

## 3. Data Schema & State Specification

### 3.1 Firestore Collections

#### Collection: `quotationCounters/{YYYY-MM}`
Atomic sequential counters per year-month bucket:
- `last`: `number` (increments sequentially: 1, 2, 3...)

#### Collection: `quotations/{quotationId}`
Primary quotation records:
- `id`: `string` (UUID or generated doc ID)
- `controlNumber`: `string` (e.g., `QT-2026-11-001`)
- `controlMonth`: `string` (`YYYY-MM`)
- `controlSeq`: `number`
- `status`: `'draft' | 'issued' | 'accepted' | 'revoked'`
- `date`: `string` (ISO `YYYY-MM-DD`)
- `validUntil`: `string` (ISO `YYYY-MM-DD`, default 30 days from creation)

**Client & Project Particulars:**
- `projectName`: `string` (e.g., "E-Commerce Mobile Application")
- `clientBusiness`: `string` (Company / Enterprise Name)
- `clientName`: `string` (Authorized Representative / Contact Person)
- `clientAddress`: `string`
- `clientEmail`: `string`
- `clientPhone`: `string`
- `paymentTerms`: `string` (e.g., "50% Downpayment upon signing, 50% upon final acceptance")

**Financial & Line Items:**
- `items`: `Array<{ id: string, description: string, quantity: number, unitPrice: number, amount: number }>`
- `subtotal`: `number`
- `discountPercent`: `number` (0 to 100)
- `discountAmount`: `number`
- `taxPercent`: `number` (0 or 12)
- `taxAmount`: `number`
- `total`: `number`
- `totalWords`: `string` (computed via `amountInWords(total)`)

**Scope of Work & Commercial Terms:**
- `scopeJson`: `string` (serialized TipTap document JSON)
- `scopeText`: `string` (markdown / plain text fallback)

**Signatories Mapping:**
- `signers`: `Record<string, { id: string, kind: 'prepared' | 'accepted' | 'noted', name: string, title: string, order: number }>`
  - `s1`: `{ kind: 'prepared', name: BRAND_CO.approvedBy, title: 'Founder & Engineering Lead', order: 1 }`
  - `s2`: `{ kind: 'accepted', name: '', title: 'Authorized Representative', order: 2 }`

**Audit & Metadata:**
- `createdAt`: `Timestamp`
- `createdByUid`: `string`
- `createdByName`: `string`
- `updatedAt`: `Timestamp`
- `issuedAt`?: `Timestamp`
- `issuedByUid`?: `string`
- `acceptedAt`?: `Timestamp`
- `revokedAt`?: `Timestamp`
- `revokedReason`?: `string`

#### Subcollection: `quotations/{quotationId}/signatures/{slotId}`
Audit records of affixed digital signatures:
- `name`: `string`
- `signedAt`: `Timestamp`
- `signedByUid`: `string` (empty string for anonymous client sign-off)
- `signatureImage`?: `string` (PNG data URL of digital signature)
- `userAgent`: `string`

---

## 4. Document Model & Branding (`quotationDocument.js` & `QuotationFrame.jsx`)

### 4.1 Document Constants & Helpers
- Prefix: `QT`
- Format: `QT-YYYY-MM-XXX` (3-digit zero-padded sequence)
- Link helper: `quotationLink(id, origin)` &rarr; `${origin}/quotation/${id}`
- Default Signers:
  - `s1`: Prepared by (OdysseyPH Founder)
  - `s2`: Conforme / Accepted by (Client Representative)

### 4.2 Brand Bible HTML Builder (`buildQuotationHtml`)
Follows OdysseyPH `brandDocument.js` (`brandPage` shell):
1. **Header**: Official logo, contact numbers, email, physical address, and web portal.
2. **Navy Bar (`#16273a`)**:
   - Left: `PRICE QUOTATION`
   - Right: Tracking No. `QT-YYYY-MM-XXX` with status badge.
3. **Quotation & Client Meta**:
   - Left: **QUOTED TO** (Client Company, Attn, Address, Contact).
   - Right: **QUOTATION DETAILS** (Date, Valid Until, Project Name, Terms).
4. **Itemized Table**:
   - Clean bordered table with headers: `#`, `ITEM & DESCRIPTION`, `QTY`, `UNIT PRICE (PHP)`, `TOTAL (PHP)`.
   - Summary footer: Subtotal, Discount, VAT (if enabled), Total in PHP, and Total in words.
5. **Scope & Deliverables Section**:
   - Formatted HTML rendered from TipTap editor containing project scope, phases, deliverables, warranties, and special terms.
6. **Signatures Section**:
   - Prepared by OdysseyPH on left.
   - Accepted & Conforme by Client on right with digital signature stamp and timestamp once signed.
7. **Document Footer**:
   - Company contact line, page indicator, and the signature navy & orange bottom stripe.

### 4.3 Iframe Renderer (`QuotationFrame.jsx`)
- Renders the generated document in an isolated `<iframe>`.
- Imperative handles:
  - `print()`: Native browser printing for Save as PDF.
  - `savePng(filename)`: Converts DOM to high-res PNG using `html-to-image` with inlined Google fonts.

---

## 5. Quotation Editor (`QuotationEditor.jsx` & `.css`)

### 5.1 Dynamic Pricing Calculator
- Real-time reactivity:
  - Row calculations: `amount = quantity * unitPrice`.
  - Subtotal: `sum(amount)`.
  - Discount: `discountAmount = (subtotal * discountPercent) / 100`.
  - Taxable base & VAT: `taxAmount = ((subtotal - discountAmount) * taxPercent) / 100`.
  - Total: `subtotal - discountAmount + taxAmount`.
  - Text representation: `amountInWords(total)`.

### 5.2 TipTap Rich-Text Editor
- Configured with `StarterKit`, `TableKit`, `TextAlign`, and `Placeholder`.
- Default template structure:
  - `## 1. Project Objectives & Executive Summary`
  - `## 2. Technical Deliverables & Modules`
  - `## 3. Implementation Schedule & Milestones`
  - `## 4. Payment Terms, Warranty & Intellectual Property`

### 5.3 AI Prompt & Smart Paste Support
- **AI Prompt Generator**: Pre-formatted prompt for ChatGPT/Gemini/Claude to quickly draft proposal items and scope.
- **Smart Paste Parser**: Detects pasted proposal text and extracts Client, Project, Items, and Scope into form fields.

---

## 6. Admin Dashboard & Public Client Page

### 6.1 Admin Quotations (`AdminQuotations.jsx`)
- Header with search, status tabs (`All`, `Draft`, `Issued`, `Accepted`, `Revoked`), and "+ New Quotation" button.
- Responsive quotation cards showing Control No, Project Name, Client Business, Total (₱), Validity, and Status.
- Actions: Preview/Print, Edit Draft, Issue Quotation, Copy Public Link, Revoke, Delete Draft.

### 6.2 Public Client View (`QuotationPage.jsx`)
- Accessible at `/quotation/:id`.
- Clean full-page presentation of the branded quotation.
- Action Bar:
  - "Print / Save as PDF".
  - "Accept Quotation & Conforme" button (when status is `issued`).
- Conforme Signature Dialog:
  - Client enters representative name and title.
  - Digital signature pad / confirmation.
  - Submits signature to Firestore and marks quotation `accepted`.

---

## 7. Security Rules (`firestore.rules`)

Add matching rules for `quotations`:
- `quotationCounters/{month}`: Read, create, and update by staff with `quotationAdmin()` permission.
- `quotations/{quotationId}`:
  - `get`: Staff with `quotationAdmin()` OR status in `['issued', 'accepted', 'revoked']`.
  - `list`: Staff with `quotationAdmin()`.
  - `create`: Staff with `quotationAdmin()`, status `'draft'`, and valid counter match.
  - `update`: Staff with `quotationAdmin()`.
  - `delete`: Staff with `quotationAdmin()` and status `'draft'`.
- `quotations/{quotationId}/signatures/{slotId}`:
  - `read`: Staff with `quotationAdmin()` OR quotation status in `['issued', 'accepted', 'revoked']`.
  - `create`: Quotation status is `'issued'`, valid slot ID, non-empty signer name.

---

## 8. Integration Points & Permissions

- **`src/utils/navigationConfig.js`**: Add `quotations` item with icon `FileSpreadsheet`, label `'Quotations'`, desc `'Price estimates, scope & client conforme'`, action `'quotations:manage'`.
- **`src/utils/staffModulePermissions.js`**: Add `quotations` to module definitions.
- **`src/pages/Admin.jsx`**: Lazy load `AdminQuotations` and bind to `activeTab === 'quotations'`.
- **`src/App.jsx`**: Register route `<Route path="/quotation/:id" element={<QuotationPage />} />`.

---

## 9. Verification & Testing Plan

1. **Unit & Calculation Verification**:
   - Verify item calculation: row amounts, subtotal, discount percentage deduction, 12% VAT toggle, and grand total.
   - Verify `amountInWords` formatting for diverse currency amounts.
2. **Document & Rendering Verification**:
   - Confirm document conforms to OdysseyPH brand standards (colors, logo, typography, footer).
   - Test PDF generation via `print()` and image export via `savePng()`.
3. **Workflow & State Transitions**:
   - Test Draft creation &rarr; Control Number sequential assignment (`QT-YYYY-MM-XXX`).
   - Test Issuance & status locking.
   - Test Public Client Portal at `/quotation/:id`.
   - Test Client Conforme digital sign-off and status transition to `accepted`.
   - Test Revocation with audit reason.
4. **Security & Permissions**:
   - Test Firestore rules validation in draft, issued, accepted, and revoked states.

