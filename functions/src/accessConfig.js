import { defineString } from 'firebase-functions/params';

const allowanceAdmins = defineString('ALLOWANCE_ADMIN_UIDS', { default: '', description: 'Comma-separated Firebase Auth UIDs authorized to bootstrap allowance administration.' });
const demoAdmins = defineString('DEMO_ADMIN_UIDS', { default: '', description: 'Comma-separated Firebase Auth UIDs that administer demo scheduling.' });
const contains = (parameter, uid) => parameter.value().split(',').some(value => value.trim() === uid);
export const isAllowanceAdmin = uid => contains(allowanceAdmins, uid);
export const isDemoAdmin = uid => contains(demoAdmins, uid);
export const featureOptions = { region: 'asia-southeast1', enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true', maxInstances: 10 };
