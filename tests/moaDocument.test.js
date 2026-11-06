import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moaNumberFor,
  buildMoaHtml,
  normalizeSignerName,
} from '../src/utils/moaDocument.js';

test('moaNumberFor generates tracking number with MOA prefix', () => {
  assert.equal(moaNumberFor({ moaNumber: 'MOA-2026-11-001' }), 'MOA-2026-11-001');
  assert.equal(moaNumberFor({ id: 'moa_xyz789' }), 'MOA-XYZ789');
  assert.equal(moaNumberFor({}), 'MOA-DRAFT');
});

test('buildMoaHtml generates official branded multi-page MOA document', () => {
  const moa = {
    id: 'moa_123',
    moaNumber: 'MOA-2026-11-001',
    clientBusiness: 'Nickleball Avenue Corp.',
    clientName: 'Kharyl Simolde',
    clientAddress: 'Lawaan 3, Talisay City, Cebu',
    providerBusiness: 'OdysseyPH IT Solutions',
    providerName: 'Jetch Merald S. Madaya',
    purpose: 'Development and deployment of a multi-tenant court booking and POS platform.',
    scope: [
      {
        id: 'scope1',
        title: 'Core Platform & Booking Engine',
        items: ['Dynamic calendar with real-time slot locking', 'PostgreSQL RPC concurrency protection'],
      },
      {
        id: 'scope2',
        title: 'Security & Verification Gateway',
        items: ['Cloudflare Turnstile token validation', 'SMS booking alerts'],
      },
    ],
    projectCost: 65000,
    timeline: 'November 1 to November 30, 2026',
    status: 'Executed',
  };

  const signatures = {
    provider: { name: 'Jetch Merald S. Madaya', signedAt: '2026-11-06T10:00:00.000Z' },
    client: { name: 'Kharyl Simolde', signedAt: '2026-11-06T11:00:00.000Z' },
  };

  const html = buildMoaHtml(moa, signatures, { origin: 'https://odysseyph.com' });

  // Brand Bible checks
  assert.match(html, /brand\/odc-mark\.svg/);
  assert.match(html, /OdysseyPH IT Solutions/);
  assert.match(html, /MEMORANDUM OF AGREEMENT/);
  assert.match(html, /MOA-2026-11-001/);
  assert.match(html, /Nickleball Avenue Corp\./);
  assert.match(html, /Kharyl Simolde/);
  assert.match(html, /Jetch Merald S\. Madaya/);
  assert.match(html, /65,000\.00/);
  assert.match(html, /Core Platform &amp; Booking Engine/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /Signed electronically/);
  assert.match(html, /Verify: odysseyph\.com\/moa\/moa_123/);
  assert.match(html, /EXECUTED/);
});

test('buildMoaHtml formats freeform text contracts properly', () => {
  const moa = {
    id: 'moa_freeform',
    moaNumber: 'MOA-2026-11-002',
    isFreeform: true,
    freeformContent: '## 1. Engagement Terms\nOdyssey agrees to provide maintenance.\n\n## 2. Compensation\nClient agrees to pay on the 1st of every month.',
    clientName: 'Jane Doe',
    clientBusiness: 'Acme Corp',
    providerName: 'Jetch Merald S. Madaya',
    status: 'Pending',
  };

  const html = buildMoaHtml(moa, {}, { origin: 'https://odysseyph.com' });
  assert.match(html, /Engagement Terms/);
  assert.match(html, /Compensation/);
  assert.match(html, /Acme Corp/);
});

