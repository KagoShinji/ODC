import {
  LayoutList,
  Package,
  TrendingUp,
  FileSignature,
  Award,
  MessageSquare,
  Users,
  Wallet,
  Globe,
  Hammer,
  MailSearch,
  ShieldCheck,
} from 'lucide-react';

export const ALL_ADMIN_NAVIGATIONS = [
  {
    id: 'allowances', label: 'Allowances & Requisitions', desc: 'Meeting expenses, liquidation & replenishment', icon: Wallet, color: '#d9a66a',
    actions: [
      { id: 'allowances:manage', label: 'Manage Allowances', desc: 'Configure policy, staff grants and accounts' },
      { id: 'allowances:meeting', label: 'Record Meetings', desc: 'Record your demos and client meetings' },
      { id: 'allowances:liquidate', label: 'Submit Liquidation', desc: 'Submit your receipts and vouchers' },
      { id: 'allowances:review', label: 'Review Liquidations', desc: 'Check receipts for other staff' },
      { id: 'allowances:request', label: 'Request Replenishment', desc: 'Submit your replenishment requisitions' },
      { id: 'allowances:approve', label: 'Approve Requisitions', desc: 'Approve requests from other staff' },
      { id: 'allowances:release', label: 'Record Releases', desc: 'Record actual funding and cash returns' },
      { id: 'allowances:reports', label: 'Allowance Reports', desc: 'View staff ledgers and export history' },
      { id: 'allowances:reverse', label: 'Correct Expenses', desc: 'Record audited reductions and recovered cash' },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    desc: 'Form leads & submissions',
    icon: LayoutList,
    color: '#ff6a1a',
    actions: [
      { id: 'contacts:delete', label: 'Delete Submissions', desc: 'Permanently remove contact leads' },
      { id: 'contacts:export', label: 'Export Data', desc: 'Download submissions in CSV format' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    desc: 'Hardware & assets',
    icon: Package,
    color: '#38bdf8',
    actions: [
      { id: 'inventory:create', label: 'Add Catalog Items', desc: 'Create new hardware & assets' },
      { id: 'inventory:action', label: 'Custody Actions', desc: 'Issue, return, transfer, waste, or sell assets' },
      { id: 'inventory:delete', label: 'Delete Catalog Items', desc: 'Remove hardware items from catalog' },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices & Finance',
    desc: 'Billing & revenue',
    icon: TrendingUp,
    color: '#34d399',
    actions: [
      { id: 'invoices:create', label: 'Create Invoices', desc: 'Draft and issue new client invoices' },
      { id: 'invoices:edit', label: 'Edit Invoices', desc: 'Modify invoice line items and totals' },
      { id: 'invoices:pay', label: 'Mark as Paid', desc: 'Record payment and receipt info' },
      { id: 'invoices:sign_prepared', label: 'Sign Prepared', desc: 'Affix preparer signature on invoice' },
      { id: 'invoices:sign_approved', label: 'Approve & Sign', desc: 'Authorize executive approval signature' },
      { id: 'invoices:expenses', label: 'Manage Expenses', desc: 'Record company expense receipts' },
      { id: 'invoices:reports', label: 'Financial Reports', desc: 'Generate & print shareholder reports' },
      { id: 'invoices:delete', label: 'Delete Invoices & Expenses', desc: 'Permanently remove invoices or expenses' },
    ],
  },
  {
    id: 'moa',
    label: 'MOA',
    desc: 'Agreements & contracts',
    icon: FileSignature,
    color: '#a78bfa',
    actions: [
      { id: 'moa:create', label: 'Draft MOA', desc: 'Create contracts & use AI paste' },
      { id: 'moa:edit', label: 'Edit MOA', desc: 'Update agreement terms and clauses' },
      { id: 'moa:sign', label: 'Sign as Provider', desc: 'Affix provider signature on agreement' },
      { id: 'moa:delete', label: 'Delete MOA', desc: 'Permanently remove agreement documents' },
    ],
  },
  {
    id: 'acceptance',
    label: 'Acceptance',
    desc: 'Project signoffs',
    icon: Award,
    color: '#f59e0b',
    actions: [
      { id: 'acceptance:create', label: 'Create Certificates', desc: 'Generate project acceptance certificates' },
      { id: 'acceptance:edit', label: 'Edit Certificates', desc: 'Modify turnover details and items' },
      { id: 'acceptance:delete', label: 'Delete Certificates', desc: 'Remove acceptance certificates' },
    ],
  },
  {
    id: 'tickets',
    label: 'Tickets',
    desc: 'Client support tickets',
    icon: MessageSquare,
    color: '#ec4899',
    actions: [
      { id: 'tickets:create', label: 'Create Tickets', desc: 'Submit new internal and support tickets' },
      { id: 'tickets:reply', label: 'Reply to Messages', desc: 'Send chat replies to clients' },
      { id: 'tickets:assign', label: 'Assign Tickets', desc: 'Assign tickets to team members' },
      { id: 'tickets:status', label: 'Update Status', desc: 'Change ticket priority & state' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    desc: 'Client accounts & billing',
    icon: Users,
    color: '#6366f1',
    actions: [
      { id: 'clients:create', label: 'Create Clients', desc: 'Register new client accounts & portals' },
      { id: 'clients:billing', label: 'Configure Billing', desc: 'Setup monthly retainers and billing cycles' },
      { id: 'clients:invoice', label: 'Generate Invoices', desc: 'Generate invoices and adjust booking counts' },
      { id: 'clients:delete', label: 'Delete Clients & Feedback', desc: 'Remove clients and client feedback' },
    ],
  },
  {
    id: 'salaries',
    label: 'Salary Tracker',
    desc: 'Payroll & payouts',
    icon: Wallet,
    color: '#10b981',
    actions: [
      { id: 'salaries:manage_staff', label: 'Manage Staff Roster', desc: 'Add / edit staff salary configurations' },
      { id: 'salaries:payout', label: 'Record Payouts', desc: 'Process and record monthly payroll' },
      { id: 'salaries:delete', label: 'Delete Payouts & Staff', desc: 'Remove salary payouts or staff records' },
    ],
  },
  {
    id: 'domains',
    label: 'Domain Tracker',
    desc: 'Domains, DNS & SSL',
    icon: Globe,
    color: '#06b6d4',
    actions: [
      { id: 'domains:create', label: 'Add Domains', desc: 'Register new domains for monitoring' },
      { id: 'domains:edit', label: 'Edit & Renew', desc: 'Update DNS, SSL, and renewal cycles' },
      { id: 'domains:delete', label: 'Delete Domains', desc: 'Remove domains from tracker' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    desc: 'System mode & notices',
    icon: Hammer,
    color: '#f97316',
    actions: [
      { id: 'maintenance:save', label: 'Configure Maintenance', desc: 'Toggle system maintenance mode and banner' },
    ],
  },
  {
    id: 'inquiries',
    label: 'Inquiries',
    desc: 'Service requests',
    icon: MailSearch,
    color: '#8b5cf6',
    actions: [
      { id: 'inquiries:status', label: 'Update Status', desc: 'Change inquiry processing status' },
      { id: 'inquiries:delete', label: 'Delete Inquiries', desc: 'Permanently remove inquiry records' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    desc: 'Manage team & permissions',
    icon: ShieldCheck,
    color: '#ef4444',
    actions: [
      { id: 'staff:create', label: 'Add Staff', desc: 'Create new staff accounts and set credentials' },
      { id: 'staff:edit', label: 'Edit Staff & Permissions', desc: 'Update roles, passwords, and permissions' },
      { id: 'staff:status', label: 'Toggle Status', desc: 'Activate or suspend staff accounts' },
      { id: 'staff:delete', label: 'Delete Staff', desc: 'Permanently remove staff members' },
    ],
  },
];

/**
 * Returns all action IDs across all modules
 */
export const getAllActionIds = () => {
  return ALL_ADMIN_NAVIGATIONS.flatMap((nav) => (nav.actions || []).map((a) => a.id));
};

/**
 * Returns all action IDs for a given list of tab IDs
 */
export const getActionsForTabs = (tabIds = []) => {
  return ALL_ADMIN_NAVIGATIONS
    .filter((nav) => tabIds.includes(nav.id))
    .flatMap((nav) => (nav.actions || []).map((a) => a.id));
};

