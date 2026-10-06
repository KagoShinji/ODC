export const TRUSTED_STAFF_MODULES = ['demos', 'allowances'];

export function hydrateStaffPermissions(tabs, actions, context, staffId) {
  const allowedTabs = tabs.filter(tab => !TRUSTED_STAFF_MODULES.includes(tab));
  const allowedActions = actions.filter(action => !TRUSTED_STAFF_MODULES.some(module => action.startsWith(`${module}:`)));
  for (const module of TRUSTED_STAFF_MODULES) {
    const grant = context?.[module]?.grants?.[staffId];
    if (grant?.active) {
      allowedTabs.push(module);
      allowedActions.push(...grant.actions);
    }
  }
  return { allowedTabs, allowedActions, demoPresenterEnabled: context?.demos?.grants?.[staffId]?.presenterEnabled === true };
}

export function staffModuleChanges(form, context, staffId) {
  const changes = {};
  for (const module of TRUSTED_STAFF_MODULES) {
    if (!context?.[module]?.editable) continue;
    const previous = context[module].grants[staffId];
    const active = form.status === 'active' && form.allowedTabs.includes(module);
    const actions = active ? form.allowedActions.filter(action => action.startsWith(`${module}:`)) : [];
    const sameActions = JSON.stringify([...actions].sort()) === JSON.stringify([...(previous?.actions || [])].sort());
    const presenterEnabled = module === 'demos' && active && actions.includes('demos:present') && form.demoPresenterEnabled === true;
    if (active === (previous?.active === true) && sameActions && presenterEnabled === (previous?.presenterEnabled === true)) continue;
    changes[module] = { active, actions, expectedRevision: previous?.revision || 'none' };
    if (module === 'demos') changes[module].presenterEnabled = presenterEnabled;
  }
  return changes;
}
