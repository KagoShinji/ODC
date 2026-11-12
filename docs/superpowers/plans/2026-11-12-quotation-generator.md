# Quotation Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Quotation Generator subsystem for OdysseyPH IT Solutions following the exact visual template, architecture, and signing workflow of Office Orders and Incident Reports, featuring an interactive itemized calculator, rich-text scope editor, and public digital Conforme signing.

**Architecture:** A full-stack frontend subsystem comprising a document calculation and HTML rendering engine (`src/utils/quotationDocument.js`), Firestore service layer (`src/services/quotationService.js`), an isolated iframe frame (`src/components/quotations/QuotationFrame.jsx`), a dual-panel editor (`src/components/quotations/QuotationEditor.jsx`), an admin management interface (`src/pages/AdminQuotations.jsx`), and a public client Conforme signing page (`src/pages/QuotationPage.jsx`) backed by updated Firestore security rules.

**Tech Stack:** React 19, Vite 7, TipTap React (StarterKit, TableKit, TextAlign), Firebase Firestore 12, Lucide React, html-to-image.

**Spec:** [docs/superpowers/specs/2026-11-12-quotation-generator-design.md](file:///Users/jetchmerald/Documents/jetch/ODC/docs/superpowers/specs/2026-11-12-quotation-generator-design.md)

---

## Global Constraints

- Document prefix is strictly `QT` with tracking number formatted as `QT-YYYY-MM-XXX` (3-digit zero-padded sequence).
- Visual branding must strictly match `src/utils/brandDocument.js` (`BRAND_CO`, Navy `#16273a`, Orange `#ff6a13`, Poppins & Inter typography, letter-size printable page).
- All amounts must format to Philippine Pesos (`₱`) with 2 decimal places, and grand total must render verbal amount in words via `amountInWords()`.
- Public routes must live at `/quotation/:id`.
- Iframe rendering must be isolated so print styles never bleed into the host application.

---

## Review Focus

1. **Negative / Zero Price Inputs:** Quantity or unit price set to 0, negative values, or non-numeric strings must be sanitized to 0 to prevent NaN or corrupted totals.
2. **Discount Clamping:** Discount percentage must be clamped between 0% and 100% so discount amount never exceeds subtotal.
3. **Draft Lock on Issuance:** An issued quotation must not be editable or deletable; only revoke action is permitted.
4. **Anonymous Client Sign-off Validation:** Client signature on `/quotation/:id` must require a non-empty name matching the slot constraint, updating status to `accepted`.
5. **Print & PNG Export Stability:** Inlining of Google Fonts in `QuotationFrame` must gracefully fallback to system fonts if network access is restricted.

---

### Task 1: Core Document Utilities & Price Calculation Engine

**Files:**
- Create: `src/utils/quotationDocument.js`
- Test: `tests/quotationDocument.test.js`

**Interfaces:**
- Consumes: `BRAND_CO`, `esc`, `longDate`, `money`, `amountInWords`, `brandPage` from `src/utils/brandDocument.js`.
- Produces:
  - `QUOTATION_PREFIX = 'QT'`
  - `formatControlNumber(month: string, seq: number): string`
  - `controlMonthOf(date?: Date): string`
  - `calcLineAmount(quantity: number, unitPrice: number): number`
  - `calcQuotationTotals(items: Array<{ quantity: number, unitPrice: number }>, discountPercent?: number, taxPercent?: number): { subtotal: number, discountAmount: number, taxAmount: number, total: number, totalWords: string }`
  - `emptyQuotationSigners(): Record<string, any>`
  - `parseQuotationText(raw: string): { fields: Record<string, string>, items: Array<any>, scope: string, signers: Array<any> }`
  - `buildQuotationHtml(quotation: any, signatures?: Record<string, any>): string`
  - `quotationLink(id: string, origin?: string): string`

- [ ] **Step 1: Write the failing test**

Create `tests/quotationDocument.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import {
  formatControlNumber,
  controlMonthOf,
  calcLineAmount,
  calcQuotationTotals,
  emptyQuotationSigners,
  parseQuotationText,
  buildQuotationHtml,
} from '../src/utils/quotationDocument.js';

test('formatControlNumber formats with QT prefix and 3-digit sequence', () => {
  assert.strictEqual(formatControlNumber('2026-11', 1), 'QT-2026-11-001');
  assert.strictEqual(formatControlNumber('2026-11', 42), 'QT-2026-11-042');
});

test('calcLineAmount computes quantity * unit price safely', () => {
  assert.strictEqual(calcLineAmount(2, 5000), 10000);
  assert.strictEqual(calcLineAmount(-1, 5000), 0);
  assert.strictEqual(calcLineAmount('foo', 5000), 0);
});

test('calcQuotationTotals calculates subtotal, discount, VAT, and words', () => {
  const items = [
    { quantity: 2, unitPrice: 25000 }, // 50,000
    { quantity: 1, unitPrice: 10000 }, // 10,000
  ];
  // Subtotal = 60,000. 10% discount = 6,000. Taxable = 54,000. 12% VAT = 6,480. Total = 60,480.
  const res = calcQuotationTotals(items, 10, 12);
  assert.strictEqual(res.subtotal, 60000);
  assert.strictEqual(res.discountAmount, 6000);
  assert.strictEqual(res.taxAmount, 6480);
  assert.strictEqual(res.total, 60480);
  assert.match(res.totalWords, /SIXTY THOUSAND FOUR HUNDRED EIGHTY PESOS/i);
});

test('buildQuotationHtml produces complete OdysseyPH branded document HTML', () => {
  const quotation = {
    controlNumber: 'QT-2026-11-001',
    projectName: 'Enterprise Portal',
    clientBusiness: 'Acme Corp',
    clientName: 'Jane Doe',
    date: '2026-11-12',
    validUntil: '2026-12-12',
    items: [{ id: '1', description: 'Development', quantity: 1, unitPrice: 50000, amount: 50000 }],
    subtotal: 50000,
    total: 50000,
    totalWords: 'FIFTY THOUSAND PESOS AND 00/100',
    scopeText: '## 1. Scope\nDelivery of portal.',
    signers: emptyQuotationSigners(),
  };
  const html = buildQuotationHtml(quotation);
  assert.match(html, /PRICE QUOTATION/);
  assert.match(html, /QT-2026-11-001/);
  assert.match(html, /Acme Corp/);
  assert.match(html, /Enterprise Portal/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quotationDocument.test.js`  
Expected: FAIL with "Cannot find module '../src/utils/quotationDocument.js'"

- [ ] **Step 3: Implement `src/utils/quotationDocument.js`**

Implement the constants, date/number formatting, calculation logic, parser, AI prompt string, and `buildQuotationHtml` using `brandDocument.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/quotationDocument.test.js`  
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/quotationDocument.js tests/quotationDocument.test.js
git commit -m "feat(quotation): implement core document calculations and branded HTML builder"
```

---

### Task 2: Firestore Service & Security Rules

**Files:**
- Create: `src/services/quotationService.js`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: Firebase `db` from `src/firebase.js`, `formatControlNumber`, `controlMonthOf`, `emptyQuotationSigners` from `src/utils/quotationDocument.js`.
- Produces:
  - `subscribeQuotations(onData: (quotes: any[]) => void, onError?: (err: any) => void): () => void`
  - `subscribeQuotation(id: string, onData: (quote: any) => void, onError?: (err: any) => void): () => void`
  - `subscribeQuotationSignatures(id: string, onData: (sigs: Record<string, any>) => void): () => void`
  - `createQuotation(user: any, form: any): Promise<string>`
  - `updateQuotation(user: any, id: string, form: any): Promise<void>`
  - `issueQuotation(user: any, id: string, quotation: any): Promise<void>`
  - `revokeQuotation(user: any, id: string, reason: string): Promise<void>`
  - `deleteQuotationDraft(id: string): Promise<void>`
  - `signQuotation(id: string, slotId: string, signatureData: { name: string, title?: string, signatureImage?: string, userAgent?: string }): Promise<void>`

- [ ] **Step 1: Write integration verification script**

Create `tests/quotationService.test.js` verifying module exports and calculation/state transformations.

- [ ] **Step 2: Run verification script**

Run: `node --test tests/quotationService.test.js`  
Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/services/quotationService.js` and update `firestore.rules`**

1. Implement `quotationService.js` mirroring `officeOrderService.js` and `acceptanceService.js`, managing atomic sequences in `quotationCounters` transactionally.
2. Update `firestore.rules` adding `quotationCounters`, `quotations`, and `/signatures` rules alongside `officeOrders`.

- [ ] **Step 4: Run verification script**

Run: `node --test tests/quotationService.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/quotationService.js firestore.rules tests/quotationService.test.js
git commit -m "feat(quotation): implement firestore service and security rules"
```

---

### Task 3: Quotation Branded Frame Component

**Files:**
- Create: `src/components/quotations/QuotationFrame.jsx`
- Create: `src/components/quotations/QuotationFrame.css`

**Interfaces:**
- Consumes: `buildQuotationHtml` from `src/utils/quotationDocument.js`, `toPng` from `html-to-image`.
- Produces: `QuotationFrame` forwardRef component exposing:
  - `ref.current.print()`
  - `ref.current.savePng(filename: string)`

- [ ] **Step 1: Create `QuotationFrame.css`**

Add styling matching `OfficeOrderFrame.css` with responsive scaling and print container isolation.

- [ ] **Step 2: Implement `QuotationFrame.jsx`**

Implement isolated iframe rendering with font inlining and `useImperativeHandle` for `print()` and `savePng()`.

- [ ] **Step 3: Verify syntax and lint**

Run: `npm run lint`  
Expected: Clean pass with no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/quotations/QuotationFrame.jsx src/components/quotations/QuotationFrame.css
git commit -m "feat(quotation): implement QuotationFrame iframe renderer with PDF and PNG export"
```

---

### Task 4: Interactive Quotation Editor Component

**Files:**
- Create: `src/components/quotations/QuotationEditor.jsx`
- Create: `src/components/quotations/QuotationEditor.css`

**Interfaces:**
- Consumes: TipTap hooks and extensions (`@tiptap/react`, `StarterKit`, `TableKit`), `calcQuotationTotals`, `calcLineAmount`, `AI_QUOTATION_PROMPT`, `parseQuotationText`.
- Produces: `QuotationEditor` component:
  - Props: `form`, `controlNumber`, `onField(key, value)`, `onItemsChange(items)`, `onDoc(json, text)`, `onParsed(parsed)`

- [ ] **Step 1: Create `QuotationEditor.css`**

Style the two-column editor layout, itemizer rows, financial summary pill, and TipTap toolbar.

- [ ] **Step 2: Implement `QuotationEditor.jsx`**

1. Build Client and Project information inputs (Project Name, Client Business, Representative, Address, Contact, Valid Until, Payment Terms).
2. Build Dynamic Line Item Table:
   - Item row with description, quantity, unit price, and auto-computed line total.
   - Add Item button and Remove Item button.
   - Subtotal, Discount %, VAT toggle, Grand Total display, and Amount in words.
3. Build TipTap rich-text editor with default sections (Scope, Deliverables, Implementation, Terms).
4. Integrate Copy AI Prompt modal and Smart Paste detection.

- [ ] **Step 3: Run lint to verify clean component code**

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/quotations/QuotationEditor.jsx src/components/quotations/QuotationEditor.css
git commit -m "feat(quotation): implement dynamic line-item pricing and rich-text QuotationEditor"
```

---

### Task 5: Admin Management Dashboard

**Files:**
- Create: `src/pages/AdminQuotations.jsx`
- Create: `src/pages/AdminQuotations.css`

**Interfaces:**
- Consumes: `quotationService.js`, `QuotationFrame.jsx`, `QuotationEditor.jsx`, `SystemModalContext`.
- Produces: `AdminQuotations` component (rendered inside Admin tab).

- [ ] **Step 1: Create `AdminQuotations.css`**

Style the search bar, status tabs (`all`, `draft`, `issued`, `accepted`, `revoked`), quotation card layout, and preview modal.

- [ ] **Step 2: Implement `AdminQuotations.jsx`**

1. Subscribe to quotations list with status filtering and text search.
2. Render quotation cards / list with control number, project, client company, total ₱, and status badge.
3. Handle actions: New Quotation, Edit Draft, Preview/Print in `QuotationFrame`, Copy Public Link, Issue Quotation, Revoke Quotation, Delete Draft.

- [ ] **Step 3: Run lint to verify**

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminQuotations.jsx src/pages/AdminQuotations.css
git commit -m "feat(quotation): implement AdminQuotations management dashboard"
```

---

### Task 6: Public Client Portal & Conforme Signing

**Files:**
- Create: `src/pages/QuotationPage.jsx`
- Create: `src/pages/QuotationPage.css`

**Interfaces:**
- Consumes: `subscribeQuotation`, `subscribeQuotationSignatures`, `signQuotation` from `quotationService.js`, `QuotationFrame.jsx`.
- Produces: `QuotationPage` component (mounted at `/quotation/:id`).

- [ ] **Step 1: Create `QuotationPage.css`**

Style the client view bar, branding banner, Conforme modal, and printable layout.

- [ ] **Step 2: Implement `QuotationPage.jsx`**

1. Extract `id` from URL params via `useParams()`.
2. Subscribe to quotation and signatures real-time.
3. Top action bar with Status pill, "Print / Save as PDF" button, and "Accept Quotation & Conforme" button.
4. Conforme Signature Dialog: client inputs name, title, and confirmation stamp, invoking `signQuotation` to finalize document.

- [ ] **Step 3: Run lint to verify**

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/QuotationPage.jsx src/pages/QuotationPage.css
git commit -m "feat(quotation): implement public QuotationPage with digital Conforme acceptance"
```

---

### Task 7: System Wiring, Navigation, Routing & Full Build

**Files:**
- Modify: `src/utils/navigationConfig.js`
- Modify: `src/utils/staffModulePermissions.js`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `AdminQuotations`, `QuotationPage`.
- Produces:
  - Sidebar item `quotations` in `navigationConfig.js`
  - Permission `quotations:manage` in `staffModulePermissions.js`
  - ActiveTab `quotations` in `Admin.jsx`
  - Route `/quotation/:id` in `App.jsx`

- [ ] **Step 1: Update `src/utils/navigationConfig.js` & `src/utils/staffModulePermissions.js`**

Add `quotations` nav entry under documents with `ReceiptText` icon and actions `['quotations:manage']`.

- [ ] **Step 2: Update `src/pages/Admin.jsx`**

Lazy-load `AdminQuotations` and render when `activeTab === 'quotations' && hasPermission('quotations')`.

- [ ] **Step 3: Update `src/App.jsx`**

Import `QuotationPage` and register route:
```jsx
<Route path="/quotation/:id" element={<QuotationPage />} />
```

- [ ] **Step 4: Run full test suite & production build**

Run: `node --test tests/quotationDocument.test.js && node --test tests/quotationService.test.js && npm run build`  
Expected: All tests pass and Vite production bundle compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/utils/navigationConfig.js src/utils/staffModulePermissions.js src/pages/Admin.jsx src/App.jsx
git commit -m "feat(quotation): wire navigation, admin dashboard tab, and public routing"
```

