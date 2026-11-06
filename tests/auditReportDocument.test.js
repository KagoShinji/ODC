import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_REPORT_PREFIX,
  formatControlNumber,
  parseAuditReportText,
  buildAuditReportHtml,
  emptyAuditSigners,
  toIsoDate,
} from '../src/utils/auditReportDocument.js';

test('formatControlNumber formats sequence with AR prefix and 3 digits', () => {
  assert.equal(AUDIT_REPORT_PREFIX, 'AR');
  assert.equal(formatControlNumber('2026-11', 1), 'AR-2026-11-001');
  assert.equal(formatControlNumber('2026-11', 42), 'AR-2026-11-042');
});

test('toIsoDate converts variations of dates to YYYY-MM-DD', () => {
  assert.equal(toIsoDate('2026-11-06'), '2026-11-06');
  assert.equal(toIsoDate('November 6, 2026'), '2026-11-06');
  assert.equal(toIsoDate('Friday, Nov 6, 2026'), '2026-11-06');
});

test('parseAuditReportText extracts metadata headers, sections, and 4-tier signers', () => {
  const sample = `
TITLE: Q4 2026 Infrastructure & Security Audit
CATEGORY: IT & Security
RATING: Satisfactory
PERIOD COVERED: 2026-10-01 to 2026-10-31
DATE CONDUCTED: 2026-11-02
DATE ISSUED: 2026-11-06
LEAD AUDITOR: Jane Doe, Senior Security Auditor
AUDITEE: Engineering & DevOps Team
AUDIT TEAM: John Smith, Mark Taylor

## 1. Executive Summary & Audit Objectives
Comprehensive evaluation of access policies and server firewall logs.

## 2. Scope & Methodology
Covered AWS, Cloudflare, and internal bastion hosts.

Audited by:
Jane Doe
Senior Security Auditor

Reviewed by:
Alex Vance
Compliance Manager

Approved by:
Jetch Merald S. Madaya
Founder

Acknowledged by:
DevOps Lead
Systems Head
`;

  const parsed = parseAuditReportText(sample);
  assert.equal(parsed.fields.title, 'Q4 2026 Infrastructure & Security Audit');
  assert.equal(parsed.fields.category, 'it_security');
  assert.equal(parsed.fields.rating, 'satisfactory');
  assert.equal(parsed.fields.auditPeriodStart, '2026-10-01');
  assert.equal(parsed.fields.auditPeriodEnd, '2026-10-31');
  assert.equal(parsed.fields.leadAuditorName, 'Jane Doe');
  assert.equal(parsed.fields.leadAuditorTitle, 'Senior Security Auditor');
  assert.equal(parsed.fields.auditeeEntity, 'Engineering & DevOps Team');
  assert.ok(parsed.body.includes('Comprehensive evaluation of access policies'));
  assert.equal(Object.keys(parsed.signers).length, 4);
});

test('buildAuditReportHtml produces valid Brand Bible HTML with rating badge and signatures', () => {
  const report = {
    controlNumber: 'AR-2026-11-001',
    title: 'Q4 2026 Infrastructure & Security Audit',
    category: 'it_security',
    rating: 'satisfactory',
    auditPeriodStart: '2026-10-01',
    auditPeriodEnd: '2026-10-31',
    auditDate: '2026-11-02',
    dateIssued: '2026-11-06',
    leadAuditorName: 'Jane Doe',
    leadAuditorTitle: 'Senior Security Auditor',
    auditeeEntity: 'Engineering',
    body: '## 1. Executive Summary\nAll controls passed.',
    signers: emptyAuditSigners(),
    status: 'issued',
  };

  const html = buildAuditReportHtml(report, {
    s1: { name: 'Jane Doe', signedAt: '2026-11-06T10:00:00.000Z' }
  }, { origin: 'https://odysseyph.com' });

  assert.match(html, /AR-2026-11-001/);
  assert.match(html, /AUDIT REPORT/);
  assert.match(html, /satisfactory/i);
  assert.match(html, /Jane Doe/);
  assert.match(html, /brand\/odc-mark\.svg/);
});
