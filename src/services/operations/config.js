// Public identity, verified against Firebase Auth. Authority is enforced independently in rules.
export const OPERATIONS_ROOT_UID = 'USkc70WnqpUV4Oq0ppPpdm2E4Fa2';
export const FIRESTORE_CAPABILITIES = Object.freeze({ backgroundReminders: false, evidenceUploads: false, evidenceReferences: true, maxExpenseLines: 3 });
export const SERVER_CAPABILITIES = Object.freeze({ backgroundReminders: true, evidenceUploads: true, evidenceReferences: true, maxExpenseLines: 30 });
