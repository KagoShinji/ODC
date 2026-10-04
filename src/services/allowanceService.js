import { httpsCallable } from 'firebase/functions';
import { getBlob, ref, uploadBytesResumable } from 'firebase/storage';
import { functions, storage } from '../lib/firebase';
import { FILE_TYPES, DEFAULT_POLICY } from '../../functions/src/domain.js';

const contextCall = httpsCallable(functions, 'allowanceContext');
const commandCall = httpsCallable(functions, 'allowanceCommand');
export const getAllowanceContext = async () => (await contextCall()).data;
export const newAllowanceId = () => crypto.randomUUID();
export const runAllowanceCommand = async (command, payload, commandId = newAllowanceId()) => (await commandCall({ command, payload, commandId })).data;

export function allowanceError(error, { checkingAccess = false } = {}) {
  if (error?.code === 'functions/not-found' && checkingAccess) return 'The allowance service was not found. An administrator must check its deployment and configured region.';
  if (error?.code === 'functions/unavailable') return 'The allowance service could not be reached. Check your connection and retry.';
  if (error?.code === 'functions/internal') return 'The allowance service could not complete this request. Retry, or ask an administrator to check feature setup.';
  if (error?.code === 'functions/unauthenticated') return 'Your session or access verification has expired. Sign in again.';
  return error?.message?.replace(/^Firebase:\s*/, '') || 'Unable to complete this operation. Please retry.';
}

export async function uploadAllowanceEvidence(accountId, liquidationId, file, onProgress, policy = DEFAULT_POLICY, purchaseCentavos = 0) {
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
  // Authenticated Storage download; never publish a persistent download-token URL.
  const blob = await getBlob(ref(storage, file.objectPath), DEFAULT_POLICY.maxFileBytes);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
