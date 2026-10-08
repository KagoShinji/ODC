import { collection, doc, getDoc, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';

export function toWire(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toWire);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toWire(item)]));
  // Typed instants are authoritative in free mode. Ignore duplicate display
  // strings supplied by a client when evaluating a later booking transition.
  if (value.startsAt instanceof Timestamp) result.startAt = result.startsAt;
  if (value.endsAt instanceof Timestamp) result.endAt = result.endsAt;
  return result;
}
const timestampKeys = new Set(['createdAt', 'updatedAt', 'submittedAt', 'reviewedAt', 'releasedAt', 'correctedAt', 'deletedAt', 'transferInitiatedAt', 'transferFailedAt', 'frozenAt']);
export function financialValue(value) {
  if (Array.isArray(value)) return value.map(financialValue);
  if (!value || typeof value !== 'object' || value instanceof Timestamp) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, timestampKeys.has(key) && typeof item === 'string' && item.includes('T') ? Timestamp.fromDate(new Date(item)) : financialValue(item)]));
}
export function firestoreRepository(db, transaction, { authorizationOutsideTransaction = false } = {}) {
  const reads = new Map(); const writes = new Map(); const deletes = new Set();
  return {
    reads, writes, deletes,
    async get(name, id) {
      const path = `${name}/${id}`;
      // Rules recheck live authorization and settings at commit. Keeping these
      // immutable/context reads out of transaction preconditions avoids spending
      // the rules budget again on every document in the command's read set.
      const contextRead = authorizationOutsideTransaction && ['staff', 'staffLoginIdentities', 'demoAccess', 'allowanceAccess', 'demoSettings', 'allowanceSettings', 'demoAvailability', 'allowanceAttachments'].includes(name);
      if (!reads.has(path)) reads.set(path, toWire((await (transaction && !contextRead ? transaction.get(doc(db, path)) : getDoc(doc(db, path)))).data()));
      return reads.get(path);
    },
    async query(name, filters, maximum = 200) {
      const page = await getDocs(query(collection(db, name), ...filters.map(filter => where(...filter)), limit(maximum)));
      // Reread the query's documents in the transaction. Presenter state locks protect phantoms.
      return Promise.all(page.docs.map(async record => ({ ...(await this.get(name, record.id)), id: record.id })));
    },
    set(name, id, value) { const path = `${name}/${id}`; deletes.delete(path); writes.set(path, value); },
    delete(name, id) { const path = `${name}/${id}`; writes.delete(path); deletes.add(path); },
  };
}
