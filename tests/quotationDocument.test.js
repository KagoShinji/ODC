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

test('emptyQuotationSigners provides prepared and accepted signers', () => {
  const signers = emptyQuotationSigners();
  assert.ok(signers.s1, 'prepared signer slot exists');
  assert.ok(signers.s2, 'accepted signer slot exists');
  assert.strictEqual(signers.s1.kind, 'prepared');
  assert.strictEqual(signers.s2.kind, 'accepted');
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
