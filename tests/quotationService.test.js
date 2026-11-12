import test from 'node:test';
import assert from 'node:assert';
import {
  quotationFields,
  normalizeSignerName,
} from '../src/services/quotationService.js';

test('quotationFields validates required project and client fields', () => {
  const validForm = {
    projectName: 'Fintech Portal',
    clientBusiness: 'Alpha Corp',
    clientName: 'John Smith',
    clientAddress: 'Cebu IT Park',
    clientEmail: 'john@alpha.com',
    clientPhone: '09123456789',
    date: '2026-11-12',
    validUntil: '2026-12-12',
    paymentTerms: '50% Downpayment, 50% Final',
    items: [{ id: '1', description: 'Platform Build', quantity: 1, unitPrice: 80000, amount: 80000 }],
    discountPercent: 5,
    taxPercent: 0,
    scopeText: '## Scope\nPlatform features.',
    scopeJson: '{}',
    signers: [
      { id: 's1', kind: 'prepared', name: 'Jetch Madaya', title: 'Founder' },
      { id: 's2', kind: 'accepted', name: 'John Smith', title: 'Director' },
    ],
  };

  const fields = quotationFields(validForm);
  assert.strictEqual(fields.projectName, 'Fintech Portal');
  assert.strictEqual(fields.clientBusiness, 'Alpha Corp');
  assert.strictEqual(fields.subtotal, 80000);
  assert.strictEqual(fields.discountPercent, 5);
  assert.strictEqual(fields.discountAmount, 4000);
  assert.strictEqual(fields.total, 76000);
  assert.ok(fields.signers.s1, 'prepared signer mapped');
  assert.ok(fields.signers.s2, 'accepted signer mapped');
});

test('quotationFields rejects missing project name or client name', () => {
  assert.throws(() => {
    quotationFields({
      projectName: '',
      clientBusiness: 'Alpha Corp',
      items: [{ quantity: 1, unitPrice: 100 }],
      signers: [{ id: 's1', kind: 'prepared', name: 'Jetch' }],
    });
  }, /project name/i);

  assert.throws(() => {
    quotationFields({
      projectName: 'Fintech',
      clientBusiness: '',
      items: [{ quantity: 1, unitPrice: 100 }],
      signers: [{ id: 's1', kind: 'prepared', name: 'Jetch' }],
    });
  }, /client business/i);
});

test('normalizeSignerName collapses multiple whitespace characters', () => {
  assert.strictEqual(normalizeSignerName('  Jane   M.   Doe  '), 'Jane M. Doe');
});
