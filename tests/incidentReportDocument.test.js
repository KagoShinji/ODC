import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INCIDENT_REPORT_PREFIX,
  formatControlNumber,
  controlMonthOf,
  incidentReportLink,
  SEVERITIES,
  CATEGORIES,
  SIGNER_KINDS,
  emptyIncidentSigners,
  AI_INCIDENT_PROMPT,
  parseIncidentReportText,
  buildIncidentReportHtml,
  toIsoDate,
  splitAnnexes,
} from '../src/utils/incidentReportDocument.js';

test('INCIDENT_REPORT_PREFIX is IR', () => {
  assert.equal(INCIDENT_REPORT_PREFIX, 'IR');
});

test('formatControlNumber pads sequence to 3 digits', () => {
  assert.equal(formatControlNumber('2026-11', 1), 'IR-2026-11-001');
  assert.equal(formatControlNumber('2026-11', 42), 'IR-2026-11-042');
  assert.equal(formatControlNumber('2026-11', 105), 'IR-2026-11-105');
});

test('incidentReportLink generates full url', () => {
  assert.equal(incidentReportLink('abc123xyz', 'https://odysseyph.com'), 'https://odysseyph.com/incident-report/abc123xyz');
});

test('toIsoDate handles various date formats', () => {
  assert.equal(toIsoDate('2026-11-06'), '2026-11-06');
  assert.equal(toIsoDate('November 6, 2026'), '2026-11-06');
  assert.equal(toIsoDate('Friday, Nov 6, 2026'), '2026-11-06');
  assert.equal(toIsoDate('invalid-date'), '');
});

test('parseIncidentReportText extracts fields, sections, and signers', () => {
  const sample = `
TITLE: Production Database Connectivity Outage
INCIDENT DATE: November 6, 2026
TIME: 09:30 AM
DATE REPORTED: November 6, 2026
LOCATION: Cebu HQ Server Room
CATEGORY: Operational
SEVERITY: High
REPORTED BY: Alex Mercer, DevOps Lead
PERSONS INVOLVED: Devon Vance, System Admin

## 1. Incident Overview
At 09:30 AM, primary database server became unresponsive.

## 2. Immediate Actions
Switched traffic to read-replica at 09:35 AM.

## 3. Root Cause Analysis
Memory leak triggered out-of-memory kernel panic.

## 4. Corrective & Preventive Actions
Increase memory threshold alerts and patch memory driver.

Reported by:
Alex Mercer, DevOps Lead

Approved by:
Jetch Merald S. Madaya, Founder
`;

  const parsed = parseIncidentReportText(sample);
  assert.equal(parsed.title, 'Production Database Connectivity Outage');
  assert.equal(parsed.incidentDate, '2026-11-06');
  assert.equal(parsed.incidentTime, '09:30 AM');
  assert.equal(parsed.dateReported, '2026-11-06');
  assert.equal(parsed.location, 'Cebu HQ Server Room');
  assert.equal(parsed.category, 'operational');
  assert.equal(parsed.severity, 'high');
  assert.equal(parsed.reportedByName, 'Alex Mercer');
  assert.equal(parsed.reportedByTitle, 'DevOps Lead');
  assert.equal(parsed.personsInvolved, 'Devon Vance, System Admin');
  assert.match(parsed.body, /Incident Overview/);
  assert.equal(parsed.reporters.length, 1);
  assert.equal(parsed.reporters[0].name, 'Alex Mercer');
  assert.equal(parsed.approvers.length, 1);
  assert.equal(parsed.approvers[0].name, 'Jetch Merald S. Madaya');
});

test('splitAnnexes partitions document into main body and annexes', () => {
  const content = `## 1. Overview\nIncident details here.\n\n# Annex A — Server Metrics\nLog entries...`;
  const result = splitAnnexes(content);
  assert.match(result.main, /Overview/);
  assert.equal(result.annexes.length, 1);
  assert.match(result.annexes[0].title, /Annex A — Server Metrics/);
  assert.match(result.annexes[0].body, /Log entries/);
});

test('buildIncidentReportHtml generates branded document with metadata grid and signatures', () => {
  const report = {
    id: 'rep_123',
    controlNumber: 'IR-2026-11-001',
    title: 'Workplace Fiber Cable Damage',
    incidentDate: '2026-11-06',
    incidentTime: '10:15 AM',
    dateReported: '2026-11-06',
    location: '3F Talisay Office',
    category: 'equipment',
    severity: 'critical',
    reportedByName: 'Maria Santos',
    reportedByTitle: 'Office Administrator',
    personsInvolved: 'Maintenance Contractor',
    body: '## 1. Incident Overview\nFiber line was severed during renovation.\n\n# Annex A — Damage Photos\nPhotos attached.',
    signers: {
      s1: { kind: 'reporter', name: 'Maria Santos', title: 'Office Administrator', order: 1 },
      s2: { kind: 'approver', name: 'Jetch Merald S. Madaya', title: 'Founder', order: 2 },
    },
    status: 'issued',
  };

  const signatures = {
    s1: { name: 'Maria Santos', signedAt: '2026-11-06T10:30:00.000Z' },
  };

  const html = buildIncidentReportHtml(report, signatures, { origin: 'https://odysseyph.com' });

  // Brand Bible compliance assertions
  assert.match(html, /brand\/odc-mark\.svg/);
  assert.match(html, /OdysseyPH IT Solutions/);
  assert.match(html, /INCIDENT REPORT/);
  assert.match(html, /IR-2026-11-001/);
  assert.match(html, /Workplace Fiber Cable Damage/);
  assert.match(html, /3F Talisay Office/);
  assert.match(html, /CRITICAL/i);
  assert.match(html, /Maria Santos/);
  assert.match(html, /Jetch Merald S\. Madaya/);
  assert.match(html, /Signed electronically/);
  assert.match(html, /Great\+Vibes/);
  assert.match(html, /ANNEX A/);
});
