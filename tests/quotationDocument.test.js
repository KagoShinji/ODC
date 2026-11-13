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
  editorContentOf,
  markdownToHtml,
  normalizeScopeHtml,
} from '../src/utils/quotationDocument.js';

test('formatControlNumber formats with QT prefix and 3-digit sequence', () => {
  assert.strictEqual(formatControlNumber('2026-11', 1), 'QT-2026-11-001');
  assert.strictEqual(formatControlNumber('2026-11', 42), 'QT-2026-11-042');
});

test('controlMonthOf extracts YYYY-MM correctly', () => {
  const d = new Date('2026-11-12T00:00:00Z');
  assert.strictEqual(controlMonthOf(d), '2026-11');
});

test('calcLineAmount computes quantity * unit price safely', () => {
  assert.strictEqual(calcLineAmount(2, 5000), 10000);
  assert.strictEqual(calcLineAmount(-1, 5000), 0);
  assert.strictEqual(calcLineAmount('foo', 5000), 0);
  assert.strictEqual(calcLineAmount(2, -100), 0);
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

test('calcQuotationTotals handles 0% discount and 0% tax cleanly', () => {
  const items = [{ quantity: 3, unitPrice: 1000 }];
  const res = calcQuotationTotals(items, 0, 0);
  assert.strictEqual(res.subtotal, 3000);
  assert.strictEqual(res.discountAmount, 0);
  assert.strictEqual(res.taxAmount, 0);
  assert.strictEqual(res.total, 3000);
  assert.match(res.totalWords, /THREE THOUSAND PESOS/i);
});

test('calcQuotationTotals clamps negative discounts to 0 and excessive discounts to 100', () => {
  const items = [{ quantity: 1, unitPrice: 10000 }];
  const resNegative = calcQuotationTotals(items, -15, 0);
  assert.strictEqual(resNegative.discountPercent, 0);
  assert.strictEqual(resNegative.discountAmount, 0);
  assert.strictEqual(resNegative.total, 10000);

  const resExcessive = calcQuotationTotals(items, 150, 0);
  assert.strictEqual(resExcessive.discountPercent, 100);
  assert.strictEqual(resExcessive.discountAmount, 10000);
  assert.strictEqual(resExcessive.total, 0);
});


test('emptyQuotationSigners provides prepared and accepted signers', () => {
  const signers = emptyQuotationSigners();
  assert.ok(signers.s1, 'prepared signer slot exists');
  assert.ok(signers.s2, 'accepted signer slot exists');
  assert.strictEqual(signers.s1.kind, 'prepared');
  assert.strictEqual(signers.s2.kind, 'accepted');
});

test('parseQuotationText extracts fields, table items, and scope from pasted draft', () => {
  const sample = `
PROJECT: Odyssey Cloud Portal
CLIENT BUSINESS: Nexus Inc
CLIENT NAME: Alice Walker
DATE: November 12, 2026
PAYMENT TERMS: 50% mobilization

ITEMS:
| Item & Description | Qty | Unit Price |
| Cloud Migration | 1 | 45000 |

## 1. Project Objectives
Deliver enterprise cloud infrastructure.
  `;
  const parsed = parseQuotationText(sample);
  assert.strictEqual(parsed.fields.projectName, 'Odyssey Cloud Portal');
  assert.strictEqual(parsed.fields.clientBusiness, 'Nexus Inc');
  assert.strictEqual(parsed.fields.clientName, 'Alice Walker');
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].description, 'Cloud Migration');
  assert.strictEqual(parsed.items[0].amount, 45000);
  assert.match(parsed.scope, /Project Objectives/);
});

test('editorContentOf extracts parsed JSON or falls back to text', () => {
  const jsonQuote = { scopeJson: '{"type":"doc","content":[{"type":"paragraph"}]}', scopeText: 'sample' };
  assert.deepStrictEqual(editorContentOf(jsonQuote), { type: 'doc', content: [{ type: 'paragraph' }] });

  const textQuote = { scopeText: 'Plain scope text' };
  assert.strictEqual(editorContentOf(textQuote), '<p>Plain scope text</p>');

  assert.strictEqual(editorContentOf(null), '');
});

test('buildQuotationHtml produces complete OdysseyPH branded document HTML', () => {
  const quotation = {
    controlNumber: 'QT-2026-11-001',
    projectName: 'Enterprise Portal',
    clientBusiness: 'Acme Corp',
    clientName: 'Jane Doe',
    date: '2026-11-12',
    validUntil: '2026-12-12',
    paymentTerms: '50% Upon signing, 50% upon deployment',
    items: [{ id: '1', description: 'Core Platform Development', quantity: 1, unitPrice: 50000, amount: 50000 }],
    subtotal: 50000,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 50000,
    totalWords: 'FIFTY THOUSAND PESOS AND 00/100',
    scopeText: '## 1. Scope of Work\nDelivery of portal.',
    signers: emptyQuotationSigners(),
  };
  const html = buildQuotationHtml(quotation);
  assert.match(html, /PRICE QUOTATION/);
  assert.match(html, /QT-2026-11-001/);
  assert.match(html, /Acme Corp/);
  assert.match(html, /Enterprise Portal/);
  assert.match(html, /Core Platform Development/);
  assert.match(html, /Scope of Work/);
});

test('markdownToHtml converts markdown table into HTML table structure for TipTap', () => {
  const md = `
| Milestone | Timeline | Deliverables |
| Phase 1 | 2 Weeks | Design and Architecture |
| Phase 2 | 4 Weeks | MVP Deployment |
  `.trim();
  const html = markdownToHtml(md);
  assert.match(html, /<table>/);
  assert.match(html, /<th><p>Milestone<\/p><\/th>/);
  assert.match(html, /<th><p>Timeline<\/p><\/th>/);
  assert.match(html, /<td><p>Phase 1<\/p><\/td>/);
  assert.match(html, /<td><p>MVP Deployment<\/p><\/td>/);
  assert.match(html, /<\/table>/);
});

test('editorContentOf converts markdown scope to HTML when scopeJson is missing', () => {
  const quoteWithMd = {
    scopeText: '## Scope\n| Item | Spec |\n| Laptop | Apple M3 |',
  };
  const content = editorContentOf(quoteWithMd);
  assert.match(content, /<h2>Scope<\/h2>/);
  assert.match(content, /<table>/);
  assert.match(content, /<th><p>Item<\/p><\/th>/);
  assert.match(content, /<td><p>Laptop<\/p><\/td>/);
});

test('buildQuotationHtml renders both itemized pricing table and scope tables with brand CSS', () => {
  const quote = {
    controlNumber: 'QT-2026-11-002',
    projectName: 'E-Commerce System',
    clientBusiness: 'Retail Corp',
    items: [
      { id: '1', description: 'Product Catalog', quantity: 1, unitPrice: 20000, amount: 20000 },
      { id: '2', description: 'Payment Gateway', quantity: 2, unitPrice: 15000, amount: 30000 },
    ],
    scopeText: `
## Milestones
| Milestone | Target |
| Sprint 1 | Checkout flow |
| Sprint 2 | Automated tests |
    `.trim(),
    signers: emptyQuotationSigners(),
  };

  const html = buildQuotationHtml(quote);

  // Line items pricing table
  assert.match(html, /<table class="qt-table">/);
  assert.match(html, /Product Catalog/);
  assert.match(html, /Payment Gateway/);
  assert.match(html, /₱ 20,000\.00/);
  assert.match(html, /₱ 30,000\.00/);

  // Scope section rendered table
  assert.match(html, /<div class="qt-scope-section">/);
  assert.match(html, /<div class="tbl"><table><thead><tr><th>Milestone<\/th>/);
  assert.match(html, /<td>Checkout flow<\/td>/);

  // CSS table rules check
  assert.match(html, /\.qt-scope-section table/);
  assert.match(html, /\.qt-scope-section th/);
  assert.match(html, /\.qt-scope-section td/);
  assert.match(html, /\.qt-table-wrap/);
});

test('normalizeScopeHtml lifts TipTap leading <th> row into <thead> for multi-page print header repeat', () => {
  const tiptapTable = '<table><tbody><tr><th><p>Module</p></th><th><p>Deliverables</p></th></tr><tr><td><p>Portal</p></td><td><p>Login</p></td></tr></tbody></table>';
  const normalized = normalizeScopeHtml(tiptapTable);
  assert.match(normalized, /^<table><thead><tr><th><p>Module<\/p><\/th><th><p>Deliverables<\/p><\/th><\/tr><\/thead><tbody><tr><td><p>Portal<\/p>/);

  // Tables without header rows remain untouched
  const noHeaderTable = '<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>';
  assert.strictEqual(normalizeScopeHtml(noHeaderTable), noHeaderTable);
});

test('buildQuotationHtml keeps header clean without escaped HTML tags, prevents trailing dots, and supports signatures & print pagination', () => {
  const issuedQuote = {
    controlNumber: 'QT-2026-11-001',
    status: 'issued',
    projectName: 'Scan Portal',
    clientBusiness: 'Mud Hound',
    clientName: 'John Judilla',
    clientEmail: '09177706982',
    clientPhone: '',
    date: '2026-11-13',
    validUntil: '',
    items: [{ id: '1', description: 'Setup', quantity: 0, unitPrice: 0, amount: 0 }],
    scopeText: '<h2>1. Scope</h2><p>Summary</p><ul><li>Item A</li></ul><table><tbody><tr><th><p>Col 1</p></th></tr><tr><td><p>Val 1</p></td></tr></tbody></table>',
    signers: emptyQuotationSigners(),
  };

  const signatures = {
    s1: { name: 'Escalante Tiffany Marapao', signedAt: '2026-11-13T05:00:00Z' },
  };

  const html = buildQuotationHtml(issuedQuote, signatures);

  // Title band must be pure text (no escaped &lt;span...)
  assert.match(html, /<h1>PRICE QUOTATION<\/h1>/);
  assert.doesNotMatch(html, /&lt;span/);
  assert.match(html, /<span class="qt-status-tag qt-status-issued">ISSUED<\/span>/);

  // Contact line must not end with trailing middle dot when only clientEmail is present
  assert.doesNotMatch(html, /09177706982\s*·/);
  assert.match(html, /09177706982/);

  // Footer must not have dangling "Valid Until " when empty
  assert.doesNotMatch(html, /Valid Until\s*<\/span>/);

  // TipTap HTML tags styled & table normalized to <thead>
  assert.match(html, /\.qt-scope-section h2/);
  assert.match(html, /\.qt-scope-section ul/);
  assert.match(html, /<table><thead><tr><th><p>Col 1<\/p><\/th><\/tr><\/thead><tbody><tr><td><p>Val 1<\/p><\/td><\/tr><\/tbody><\/table>/);

  // Digital signature mark and Great Vibes cursive font loaded
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /<div class="sig-mark">Escalante Tiffany Marapao<\/div>/);
  assert.match(html, /<div class="sig-mark empty"><\/div>/);

  // Desktop 816px scale preservation + print pagination rules
  assert.match(html, /\.docno\{flex-shrink:0;white-space:nowrap\}/);
  assert.match(html, /@page :first\{margin-top:0;margin-bottom:12mm\}/);
});
