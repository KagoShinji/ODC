import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statementNumberFor,
  buildBillingStatementHtml,
  normalizeSignerName,
  ODC_BANK_INFO,
  copyTextToClipboard,
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

test('buildBillingStatementHtml renders copy buttons for Metrobank account details in interactive mode', () => {
  const html = buildBillingStatementHtml(
    { id: 'inv_copy_1', billTo: 'Acme Corp', items: [{ service: 'Web App', amount: 10000 }] },
    {},
    { origin: 'https://odysseyph.com', autoPrint: false }
  );

  assert.match(html, new RegExp(`data-copy="${ODC_BANK_INFO.bankAccount}"`));
  assert.match(html, new RegExp(`data-copy="${ODC_BANK_INFO.bankAccountName}"`));
  assert.match(html, /@media print\s*\{[^}]*\.soa-copy-btn\s*\{\s*display:\s*none\s*!important/);
});

test('buildBillingStatementHtml omits copy buttons when autoPrint is true', () => {
  const html = buildBillingStatementHtml(
    { id: 'inv_copy_2', billTo: 'Acme Corp', items: [{ service: 'Web App', amount: 10000 }] },
    {},
    { origin: 'https://odysseyph.com', autoPrint: true }
  );

  assert.doesNotMatch(html, /data-copy=/);
  assert.match(html, new RegExp(ODC_BANK_INFO.bankName));
  assert.match(html, new RegExp(ODC_BANK_INFO.bankAccount));
  assert.match(html, new RegExp(ODC_BANK_INFO.bankAccountName));
});

test('copyTextToClipboard writes exact text via clipboard API', async () => {
  let written = '';
  const ok = await copyTextToClipboard(ODC_BANK_INFO.bankAccount, {
    clipboard: { writeText: async text => { written = text; } },
  });

  assert.equal(ok, true);
  assert.equal(written, '1723925339319');
});

test('copyTextToClipboard falls back to execCommand when clipboard API rejects', async () => {
  let selectedValue = '';
  let removed = false;
  const fakeDoc = {
    createElement: () => ({
      value: '',
      style: {},
      setAttribute() {},
      select() { selectedValue = this.value; },
    }),
    body: {
      appendChild() {},
      removeChild() { removed = true; },
    },
    execCommand: cmd => cmd === 'copy',
  };

  const ok = await copyTextToClipboard(
    ODC_BANK_INFO.bankAccountName,
    { clipboard: { writeText: async () => { throw new Error('blocked'); } } },
    fakeDoc
  );

  assert.equal(ok, true);
  assert.equal(selectedValue, 'ODYSSEYPH IT SOLUTIONS');
  assert.equal(removed, true);
});


