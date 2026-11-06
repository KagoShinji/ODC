import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statementNumberFor,
  buildBillingStatementHtml,
  normalizeSignerName,
} from '../src/utils/billingStatementDocument.js';

test('statementNumberFor transforms INV prefix to SOA', () => {
  assert.equal(statementNumberFor({ invoiceNumber: 'INV-2026-11-001' }), 'SOA-2026-11-001');
  assert.equal(statementNumberFor({ invoiceNumber: 'SOA-2026-11-042' }), 'SOA-2026-11-042');
  assert.equal(statementNumberFor({ id: 'abc12345', invoiceNumber: '' }), 'SOA-ABC12345');
});

test('buildBillingStatementHtml generates official branded US Letter statement', () => {
  const invoice = {
    id: 'inv_test_123',
    invoiceNumber: 'SOA-2026-11-001',
    date: '2026-11-06',
    billTo: 'Nickleball Avenue Corp.',
    project: 'Court Booking & Reservation System',
    paymentTerms: 'Due upon receipt',
    status: 'sent',
    items: [
      { service: 'Turnover & Multi-Court Slot Engine Module', amount: 35000 },
      { service: 'Cloudflare Turnstile & Cryptographic Bot Defense Gate', amount: 15000 },
    ],
    qrCodes: ['gotyme', 'maribank'],
    preparedBy: 'Johnjosefir Roca',
    approvedBy: 'Jetch Merald S. Madaya',
  };

  const signatures = {
    prepared: { name: 'Johnjosefir Roca', signedAt: '2026-11-06T10:00:00.000Z' },
    approved: { name: 'Jetch Merald S. Madaya', signedAt: '2026-11-06T10:30:00.000Z' },
  };

  const html = buildBillingStatementHtml(invoice, signatures, { origin: 'https://odysseyph.com' });

  // Brand Bible checks
  assert.match(html, /brand\/odc-mark\.svg/);
  assert.match(html, /OdysseyPH IT Solutions/);
  assert.match(html, /BILLING STATEMENT/);
  assert.match(html, /SOA-2026-11-001/);
  assert.match(html, /Nickleball Avenue Corp\./);
  assert.match(html, /Turnover &amp; Multi-Court Slot Engine Module/);
  assert.match(html, /50,000\.00/);
  assert.match(html, /GoTyme/);
  assert.match(html, /MariBank/);
  assert.match(html, /Johnjosefir Roca/);
  assert.match(html, /Jetch Merald S\. Madaya/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /Signed electronically/);
  assert.match(html, /Verify: odysseyph\.com\/invoice\/inv_test_123/);
});

test('buildBillingStatementHtml renders PAID status stamp when settled', () => {
  const invoice = {
    id: 'inv_paid_456',
    invoiceNumber: 'SOA-2026-11-002',
    date: '2026-11-06',
    billTo: 'Chibs & Dink',
    status: 'paid',
    items: [{ service: 'Web Maintenance', amount: 5000 }],
  };

  const html = buildBillingStatementHtml(invoice, {}, { origin: 'https://odysseyph.com' });
  assert.match(html, /stamp paid/);
  assert.match(html, />PAID</);
});

test('normalizeSignerName cleans extra whitespace', () => {
  assert.equal(normalizeSignerName('  Jetch   Merald  S.   Madaya '), 'Jetch Merald S. Madaya');
});

