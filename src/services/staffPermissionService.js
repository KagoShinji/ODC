import { operationsBackend } from './operations/backend';

export const getStaffModulePermissions = () => operationsBackend().staffPermissionContext();
export const saveStaffModulePermissions = (staffId, changes) => operationsBackend().saveStaffPermissions(staffId, changes);
export const registerStaffLoginIdentity = (staffId, identity) => operationsBackend().registerStaffIdentity(staffId, identity);
