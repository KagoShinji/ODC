import { getBlob, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { operationsBackend, operationsCapabilities } from './operations/backend';
import { FILE_TYPES, DEFAULT_POLICY } from '../../functions/src/domain.js';

export const getAllowanceContext = () => operationsBackend().allowanceContext();
export const newAllowanceId = () => crypto.randomUUID();
export const runAllowanceCommand = (command, payload, commandId = newAllowanceId()) => operationsBackend().allowanceCommand(command, payload, commandId);
export const allowanceCapabilities = operationsCapabilities;
export const registerAllowanceReference = async (accountId, liquidationId, reference, name, referenceUri, purchaseCentavos = 0) => {
  const id = newAllowanceId();
  await runAllowanceCommand('registerEvidenceReference', { accountId, liquidationId, id, reference, name, referenceUri, purchaseCentavos });
  return { id, name: name || reference, reference: reference.toUpperCase(), referenceUri, purchaseCentavos, finalized: true, kind: 'reference' };
};

export function allowanceError(error, { checkingAccess = false } = {}) {
  if (error?.code === 'permission-denied') return 'Your allowance access could not be verified. Ask an administrator to check your permissions and the deployed Firestore rules.';
  if (error?.code === 'functions/not-found' && checkingAccess) return 'The allowance service was not found. An administrator must check its deployment and configured region.';
  if (error?.code === 'functions/unavailable') return 'The allowance service could not be reached. Check your connection and retry.';
  if (error?.code === 'functions/internal') return 'The allowance service could not complete this request. Retry, or ask an administrator to check feature setup.';
  if (error?.code === 'functions/unauthenticated') return 'Your session or access verification has expired. Sign in again.';
  return error?.message?.replace(/^Firebase:\s*/, '') || 'Unable to complete this operation. Please retry.';
}

export async function uploadAllowanceEvidence(accountId, liquidationId, file, onProgress, policy = DEFAULT_POLICY, purchaseCentavos = 0) {
  if (!operationsCapabilities.evidenceUploads) throw new Error('Use a receipt or voucher reference in this version.');
  if (!FILE_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, or PDF.');
  if (file.size <= 0 || file.size > policy.maxFileBytes) throw new Error(`Files must be smaller than ${policy.maxFileBytes / 1048576} MB.`);
  const id = newAllowanceId();
  const prepared = await runAllowanceCommand('prepareAttachment', { accountId, liquidationId, id, name: file.name, contentType: file.type, size: file.size, purchaseCentavos });
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, prepared.objectPath), file, { contentType: file.type });
    task.on('state_changed', snapshot => onProgress?.(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, resolve);
  });
  await runAllowanceCommand('finalizeAttachment', { accountId, id });
  return { id, name: file.name, objectPath: prepared.objectPath, contentType: file.type, size: file.size, purchaseCentavos, finalized: true };
}

export async function openAllowanceEvidence(file) {
  if (file.kind === 'reference') {
    if (!file.referenceUri) throw new Error(`Review receipt or voucher ${file.reference} using your team’s existing evidence records.`);
    const url = new URL(file.referenceUri);
    if (url.protocol !== 'https:') throw new Error('Evidence links must use HTTPS.');
    window.open(url.href, '_blank', 'noopener,noreferrer'); return;
  }
  // Authenticated Storage download; never publish a persistent download-token URL.
  const blob = await getBlob(ref(storage, file.objectPath), DEFAULT_POLICY.maxFileBytes);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
