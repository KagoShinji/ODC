import test from 'node:test';
import assert from 'node:assert/strict';
import {
  certificateNumberFor,
  buildAcceptanceCertificateHtml,
} from '../src/utils/acceptanceDocument.js';
import {
  buildReceiptHtml,
  receiptNumberFor,
} from '../src/utils/acknowledgementReceipt.js';

test('certificateNumberFor generates COA prefix', () => {
  assert.equal(certificateNumberFor({ certificateNumber: 'COA-2026-11-001' }), 'COA-2026-11-001');
  assert.equal(certificateNumberFor({ id: 'cert_abc123' }), 'COA-ABC123');
  assert.equal(certificateNumberFor({}), 'COA-DRAFT');
});

test('buildAcceptanceCertificateHtml generates branded US Letter certificate with cursive signatures', () => {
  const coa = {
    id: 'coa_123',
    certificateNumber: 'COA-2026-11-001',
    projectName: 'Multi-Tenant Court Reservation Platform',
    clientBusiness: 'Nickleball Avenue Corp.',
    clientName: 'Kharyl Simolde',
    turnoverDate: '2026-11-06',
    scope: [
      'Core Court 1 & 2 Booking Engine and Real-Time Calendar',
      'Cryptographic Turnstile Challenge and PostgREST RPC Protection',
      'Production Deployment to Custom Domain and Database Hosting',
    ],
    status: 'Accepted',
    signeeName: 'Kharyl Simolde',
    signeeTitle: 'Managing Director',
    acceptedAt: '2026-11-06T10:30:00.000Z',
  };

  const signatures = {
    issuer: { name: 'Jetch Merald S. Madaya', signedAt: '2026-11-06T09:00:00.000Z' },
    acceptor: { name: 'Kharyl Simolde', signedAt: '2026-11-06T10:30:00.000Z' },
  };

  const html = buildAcceptanceCertificateHtml(coa, signatures, { origin: 'https://odysseyph.com' });

  // Brand Bible checks
  assert.match(html, /brand\/odc-mark\.svg/);
  assert.match(html, /OdysseyPH IT Solutions/);
  assert.match(html, /CERTIFICATE OF ACCEPTANCE/);
  assert.match(html, /COA-2026-11-001/);
  assert.match(html, /Nickleball Avenue Corp\./);
  assert.match(html, /Multi-Tenant Court Reservation Platform/);
  assert.match(html, /Cryptographic Turnstile Challenge/);
  assert.match(html, /Kharyl Simolde/);
  assert.match(html, /Jetch Merald S\. Madaya/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /Signed electronically/);
  assert.match(html, /ACCEPTED/);
  assert.match(html, /Verify: odysseyph\.com\/acceptance\/coa_123/);
});

test('buildReceiptHtml renders cursive electronic signatures and audit timestamps', () => {
  const receipt = {
    receiptNumber: 'AR-2026-11-001',
    invoiceNumber: 'SOA-2026-11-001',
    billTo: 'Nickleball Avenue Corp.',
    project: 'Court Booking System',
    billingDate: '2026-11-06',
    paymentDate: '2026-11-06',
    paymentTerms: 'Due upon receipt',
    paymentMethod: 'gotyme',
    referenceNumber: 'REF987654321',
    accountName: 'Johnjosefir Roca',
    items: [{ service: 'Platform Setup Fee', amount: 50000 }],
    total: 50000,
    preparedBy: 'Johnjosefir Roca',
    approvedBy: 'Jetch Merald S. Madaya',
  };

  const signatures = {
    prepared: { name: 'Johnjosefir Roca', signedAt: '2026-11-06T10:00:00.000Z' },
    approved: { name: 'Jetch Merald S. Madaya', signedAt: '2026-11-06T10:30:00.000Z' },
  };

  const html = buildReceiptHtml(receipt, { signatures, origin: 'https://odysseyph.com' });
  assert.match(html, /ACKNOWLEDGEMENT RECEIPT/);
  assert.match(html, /AR-2026-11-001/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /sig-mark/);
  assert.match(html, /Johnjosefir Roca/);
  assert.match(html, /Jetch Merald S\. Madaya/);
});
