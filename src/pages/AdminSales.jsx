import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { formatDisplayIdentifier } from '../utils/authHelpers';
import { loadSalesConfig, listSalesStaff } from '../services/salesService';
import { errorText } from '../utils/salesFormat';
import { SalesDialog, Empty } from '../components/sales/SalesUi';
import SalesDashboard from '../components/sales/SalesDashboard';
import SalesPipeline from '../components/sales/SalesPipeline';
import SalesLeads from '../components/sales/SalesLeads';
import SalesConversions from '../components/sales/SalesConversions';
import SalesReports from '../components/sales/SalesReports';
import SalesTargets from '../components/sales/SalesTargets';
import LeadForm from '../components/sales/LeadForm';
import LeadDetail from '../components/sales/LeadDetail';
import AdminTasks from './AdminTasks';
import './AdminTasks.css';
import './AdminSales.css';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pipeline', label: 'Sales pipeline' },
  { id: 'leads', label: 'Leads' },
  { id: 'tasks', label: 'My sales tasks' },
  { id: 'conversions', label: 'Conversions' },
  { id: 'reports', label: 'Sales reports' },
  { id: 'targets', label: 'Sales targets', requires: 'canTargets' },
];

export default function AdminSales({ firebaseUser, can, initialSection, onSectionChange }) {
  const role = useMemo(() => {
    const isAssociate = can('sales:associate');
    const isManager = can('sales:manage') || can('sales:confirm');
    const canTargets = can('sales:targets');
    return { isAssociate, isManager, canConfirm: can('sales:confirm'), canTargets, viewAll: isManager || canTargets, canAddLeads: isAssociate || isManager };
  }, [can]);
  const [config, setConfig] = useState(null);
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');
  const [localSection, setLocalSection] = useState('dashboard');
  const [dialog, setDialog] = useState(null); // { type: 'add' } | { type: 'lead', id }
  const [refreshKey, setRefreshKey] = useState(0);

  const sections = SECTIONS.filter(s => !s.requires || role[s.requires]);
  const section = sections.some(s => s.id === initialSection) ? initialSection : sections.some(s => s.id === localSection) ? localSection : 'dashboard';
  const selectSection = id => { setLocalSection(id); onSectionChange?.(id); };
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const reloadConfig = useCallback(() => loadSalesConfig().then(setConfig).catch(err => setError(errorText(err))), []);
  useEffect(() => { reloadConfig(); }, [reloadConfig]);
  useEffect(() => { listSalesStaff().then(setStaff).catch(err => setError(errorText(err))); }, []);

  const myEmail = (firebaseUser.email || '').toLowerCase();
  const ctx = useMemo(() => config && staff && {
    user: firebaseUser, role, staff, settings: config.settings, targets: config.targets,
    myEmail, myName: firebaseUser.displayName || formatDisplayIdentifier(firebaseUser.email),
  }, [config, staff, firebaseUser, role, myEmail]);

  const openLead = useCallback(id => setDialog({ type: 'lead', id }), []);
  const hasAccess = role.isAssociate || role.viewAll;

  return (
    <div className="task-module sales-module">
      <header className="task-heading">
        <div>
          <p className="task-eyebrow">Sales management</p>
          <h2>{sections.find(s => s.id === section)?.label || 'Sales'}</h2>
          <p>{role.viewAll ? 'Team leads, pipeline, KPIs and conversions — all figures come from recorded activity.' : 'Your leads, follow-ups and KPI progress.'}</p>
        </div>
        {role.canAddLeads && ctx && section !== 'tasks' && section !== 'targets' && (
          <button type="button" className="task-primary task-heading-action" onClick={() => setDialog({ type: 'add' })}><Plus size={16} /> Add lead</button>
        )}
      </header>

      <nav className="task-tabs" aria-label="Sales views">
        {sections.map(s => <button type="button" key={s.id} aria-current={section === s.id ? 'page' : undefined} onClick={() => selectSection(s.id)}>{s.label}</button>)}
      </nav>

      {error && <p className="task-error" role="alert">{error}</p>}
      {!hasAccess ? (
        <Empty icon={ShieldAlert} title="No sales permissions">Ask an administrator to grant a Sales action (Associate, Manage, Confirm or Targets) in Staff Management.</Empty>
      ) : !ctx ? (
        !error && <div className="task-skeleton" role="status" aria-label="Loading sales module" />
      ) : (
        <>
          {section === 'dashboard' && <SalesDashboard ctx={ctx} refreshKey={refreshKey} onOpenLead={openLead} onOpenReports={() => selectSection('reports')} />}
          {section === 'pipeline' && <SalesPipeline ctx={ctx} refreshKey={refreshKey} onOpenLead={openLead} onChanged={refresh} />}
          {section === 'leads' && <SalesLeads ctx={ctx} refreshKey={refreshKey} onOpenLead={openLead} onAddLead={() => setDialog({ type: 'add' })} />}
          {section === 'tasks' && (
            <AdminTasks firebaseUser={firebaseUser} can={can} category="sales" onlyMine={!role.viewAll} canCreateInCategory={role.canAddLeads}
              heading="Sales tasks from the shared task board: lead follow-ups, consultations, quotations and the weekly schedule. They also appear on the Task Board with a Sales label." />
          )}
          {section === 'conversions' && <SalesConversions ctx={ctx} onOpenLead={openLead} onChanged={refresh} />}
          {section === 'reports' && <SalesReports ctx={ctx} refreshKey={refreshKey} />}
          {section === 'targets' && role.canTargets && <SalesTargets ctx={ctx} onSaved={reloadConfig} />}
        </>
      )}

      {dialog?.type === 'add' && ctx && (
        <SalesDialog title="Add lead" onClose={() => setDialog(null)}>
          <LeadForm ctx={ctx} onCancel={() => setDialog(null)} onSaved={({ id, message }) => {
            refresh();
            setDialog({ type: 'lead', id, notice: message });
          }} />
        </SalesDialog>
      )}
      {dialog?.type === 'lead' && ctx && (
        <SalesDialog title="Lead record" wide onClose={() => { setDialog(null); refresh(); }}>
          <LeadDetail ctx={ctx} leadId={dialog.id} initialNotice={dialog.notice} onChanged={refresh} />
        </SalesDialog>
      )}
    </div>
  );
}
