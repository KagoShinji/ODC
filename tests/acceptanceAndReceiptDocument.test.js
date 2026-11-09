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

test('formatControlNumber formats sequence with COA prefix and 3 digits', async () => {
  const { formatControlNumber, controlMonthOf } = await import('../src/utils/acceptanceDocument.js');
  assert.equal(formatControlNumber('2026-11', 1), 'COA-2026-11-001');
  assert.equal(formatControlNumber('2026-11', 18), 'COA-2026-11-018');
  assert.match(controlMonthOf(new Date('2026-11-09')), /2026-11/);
});

test('parseAcceptanceText extracts project name, client details, turnover date, and deliverables', async () => {
  const { parseAcceptanceText } = await import('../src/utils/acceptanceDocument.js');
  const sample = `
PROJECT NAME: Enterprise Payroll & Timekeeping System
CLIENT NAME: Kharyl Simolde
BUSINESS NAME: Nickleball Avenue Corp.
TURNOVER DATE: November 9, 2026
REPRESENTATIVE: Kharyl Simolde, Managing Director

## Verified Project Deliverables & System Scope
- Biometric clock-in synchronization daemon
- Real-time statutory deductions calculation (SSS, PhilHealth, Pag-IBIG)
- Self-service payslip export with PDF and PNG formats

Turned Over by:
Jetch Merald S. Madaya
Engineering & Executive Lead

Accepted by:
Kharyl Simolde
Managing Director
`;

  const parsed = parseAcceptanceText(sample);
  assert.equal(parsed.fields.projectName, 'Enterprise Payroll & Timekeeping System');
  assert.equal(parsed.fields.clientName, 'Kharyl Simolde');
  assert.equal(parsed.fields.clientBusiness, 'Nickleball Avenue Corp.');
  assert.equal(parsed.fields.turnoverDate, '2026-11-09');
  assert.match(parsed.body, /Biometric clock-in synchronization/);
  assert.ok(parsed.signers.s1);
  assert.equal(parsed.signers.s1.name, 'Jetch Merald S. Madaya');
  assert.ok(parsed.signers.s2);
  assert.equal(parsed.signers.s2.name, 'Kharyl Simolde');
});

test('buildAcceptanceCertificateHtml renders TipTap JSON document structure and multi-signers', () => {
  const coa = {
    id: 'coa_tiptap',
    controlNumber: 'COA-2026-11-002',
    projectName: 'Cloud POS Integration',
    clientBusiness: 'Alpha Retailers',
    clientName: 'Jane Smith',
    turnoverDate: '2026-11-09',
    bodyJson: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '1. Handover Modules' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'All point-of-sale terminals and barcode scanners have been tested and accepted.' }],
        },
      ],
    }),
    signers: {
      s1: { kind: 'turnover', name: 'Jetch Merald S. Madaya', title: 'Lead Architect', order: 1 },
      s2: { kind: 'acceptor', name: 'Jane Smith', title: 'Chief Operations Officer', order: 2 },
      s3: { kind: 'inspector', name: 'Bob Lee', title: 'Lead QA Inspector', order: 3 },
    },
    status: 'issued',
  };

  const signatures = {
    s1: { name: 'Jetch Merald S. Madaya', signedAt: '2026-11-09T09:00:00.000Z' },
  };

  const html = buildAcceptanceCertificateHtml(coa, signatures, { origin: 'https://odysseyph.com' });
  assert.match(html, /COA-2026-11-002/);
  assert.match(html, /<span>1<\/span>Handover Modules/);
  assert.match(html, /All point-of-sale terminals and barcode scanners/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /Jetch Merald S\. Madaya/);
  assert.match(html, /Jane Smith/);
  assert.match(html, /Bob Lee/);
  assert.match(html, /Signed electronically/);
  assert.match(html, /Date: ____________/);
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

