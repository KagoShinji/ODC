import { useState, useEffect, useCallback } from 'react';
import { db, auth, secondaryAuth } from '../lib/firebase';
import {
  ALL_ADMIN_NAVIGATIONS,
  getAllActionIds,
  getActionsForTabs,
} from '../utils/navigationConfig';
import { normalizeAuthIdentifier, formatDisplayIdentifier } from '../utils/authHelpers';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signInWithEmailAndPassword,
  signOut as secondarySignOut,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  KeyRound,
  Check,
  X,
  Lock,
  Mail,
  Phone,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
  User,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

/* ─── Presets for Rapid Setup ─── */
const PRESETS = [
  {
    name: 'Full Access',
    desc: 'All available navigations & all actions',
    tabs: ALL_ADMIN_NAVIGATIONS.map((n) => n.id),
    actions: getAllActionIds(),
  },
  {
    name: 'Developer',
    desc: 'Tickets, Maintenance, Domains & Inventory',
    tabs: ['tickets', 'maintenance', 'domains', 'inventory', 'contacts'],
    actions: getActionsForTabs(['tickets', 'maintenance', 'domains', 'inventory', 'contacts']),
  },
  {
    name: 'Support Specialist',
    desc: 'Tickets, Contacts, Inquiries & Clients (Reply & View)',
    tabs: ['contacts', 'tickets', 'inquiries', 'clients'],
    actions: [
      'contacts:export',
      'tickets:create',
      'tickets:reply',
      'tickets:status',
      'inquiries:status',
      'clients:billing',
    ],
  },
  {
    name: 'Finance & Operations',
    desc: 'Invoices, Payroll, MOA & Acceptance (No Deletion)',
    tabs: ['invoices', 'salaries', 'moa', 'acceptance', 'clients'],
    actions: [
      'invoices:create',
      'invoices:edit',
      'invoices:pay',
      'invoices:sign_prepared',
      'invoices:expenses',
      'invoices:reports',
      'moa:create',
      'moa:edit',
      'acceptance:create',
      'acceptance:edit',
      'clients:create',
      'clients:billing',
      'clients:invoice',
      'salaries:payout',
    ],
  },
  {
    name: 'Minimal / Read Only',
    desc: 'Contacts tab view-only (No actions enabled)',
    tabs: ['contacts'],
    actions: [],
  },
];

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 24px',
  },
  btn: {
    cursor: 'pointer',
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  inp: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
  },
  lbl: {
    display: 'block',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
};

export default function AdminStaff({ firebaseUser, isSuperAdmin, can }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [expandedDetailsId, setExpandedDetailsId] = useState(null);

  // Toast / Alert notifications
  const [toast, setToast] = useState(null); // { type: 'success' | 'info' | 'error', text: '' }

  // Modal / Drawer State
  const [showModal, setShowModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSending, setResetSending] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    monthlySalary: '',
    status: 'active',
    createLogin: true,
    password: '',
    allowedTabs: ['contacts', 'tickets'], // default minimal access
    allowedActions: getActionsForTabs(['contacts', 'tickets']),
  });

  const canCreateStaff = can ? can('staff:create') : isSuperAdmin;
  const canEditStaff = can ? can('staff:edit') : isSuperAdmin;
  const canToggleStaffStatus = can ? can('staff:status') : isSuperAdmin;
  const canDeleteStaff = can ? can('staff:delete') : isSuperAdmin;

  // Fetch Staff from Firestore
  const loadStaff = useCallback(async (showIndicator = true) => {
    if (showIndicator) setRefreshing(true);
    try {
      const q = query(collection(db, 'staff'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching staff list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStaff(false);
  }, [loadStaff]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingStaffId(null);
    const defaultTabs = ['contacts', 'tickets'];
    setForm({
      name: '',
      email: '',
      role: '',
      phone: '',
      monthlySalary: '',
      status: 'active',
      createLogin: true,
      password: '',
      allowedTabs: defaultTabs,
      allowedActions: getActionsForTabs(defaultTabs),
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (member) => {
    setEditingStaffId(member.id);
    const displayId = formatDisplayIdentifier(member.email);
    const tabs = Array.isArray(member.allowedTabs) ? member.allowedTabs : ['contacts'];
    const actions = Array.isArray(member.allowedActions)
      ? member.allowedActions
      : getActionsForTabs(tabs);

    setForm({
      name: member.name || '',
      email: displayId || member.email || '',
      role: member.role || '',
      phone: member.phone || '',
      monthlySalary: member.monthlySalary || '',
      status: member.status || 'active',
      createLogin: !member.hasLoginAccess,
      password: '',
      allowedTabs: tabs,
      allowedActions: actions,
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Checkbox Toggle for Navigations (Parent Tab)
  const handleToggleTab = (tabId) => {
    setForm((prev) => {
      const currentTabs = prev.allowedTabs || [];
      const currentActions = prev.allowedActions || [];
      const tabActions = getActionsForTabs([tabId]);

      if (currentTabs.includes(tabId)) {
        // Unchecking parent tab removes the tab AND removes all its sub-actions
        return {
          ...prev,
          allowedTabs: currentTabs.filter((id) => id !== tabId),
          allowedActions: currentActions.filter((actId) => !tabActions.includes(actId)),
        };
      } else {
        // Checking parent tab adds the tab AND enables all its sub-actions by default
        return {
          ...prev,
          allowedTabs: [...currentTabs, tabId],
          allowedActions: Array.from(new Set([...currentActions, ...tabActions])),
        };
      }
    });
  };

  // Checkbox Toggle for Granular Actions
  const handleToggleAction = (actionId, tabId) => {
    setForm((prev) => {
      const currentTabs = prev.allowedTabs || [];
      const currentActions = prev.allowedActions || [];
      const isActionChecked = currentActions.includes(actionId);

      let nextActions;
      if (isActionChecked) {
        nextActions = currentActions.filter((a) => a !== actionId);
      } else {
        nextActions = [...currentActions, actionId];
      }

      // If action is checked, make sure the parent tab is also checked in allowedTabs
      let nextTabs = currentTabs;
      if (!isActionChecked && !currentTabs.includes(tabId)) {
        nextTabs = [...currentTabs, tabId];
      }

      return {
        ...prev,
        allowedTabs: nextTabs,
        allowedActions: nextActions,
      };
    });
  };

  // Select all actions for a specific module
  const handleSelectAllActionsForTab = (tabId) => {
    setForm((prev) => {
      const currentTabs = prev.allowedTabs || [];
      const currentActions = prev.allowedActions || [];
      const tabActions = getActionsForTabs([tabId]);

      return {
        ...prev,
        allowedTabs: currentTabs.includes(tabId) ? currentTabs : [...currentTabs, tabId],
        allowedActions: Array.from(new Set([...currentActions, ...tabActions])),
      };
    });
  };

  // Clear all actions for a specific module (read-only access)
  const handleClearAllActionsForTab = (tabId) => {
    setForm((prev) => {
      const currentActions = prev.allowedActions || [];
      const tabActions = getActionsForTabs([tabId]);

      return {
        ...prev,
        allowedActions: currentActions.filter((actId) => !tabActions.includes(actId)),
      };
    });
  };

  // Select / Deselect All Navigations & Actions
  const handleSelectAllTabs = () => {
    setForm((prev) => ({
      ...prev,
      allowedTabs: ALL_ADMIN_NAVIGATIONS.map((n) => n.id),
      allowedActions: getAllActionIds(),
    }));
  };

  const handleClearAllTabs = () => {
    setForm((prev) => ({
      ...prev,
      allowedTabs: [],
      allowedActions: [],
    }));
  };

  const handleApplyPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      allowedTabs: [...preset.tabs],
      allowedActions: [...preset.actions],
    }));
  };

  // Trigger Password Reset Email
  const handleSendResetEmail = async (targetEmail) => {
    const raw = targetEmail || form.email || '';
    const emailToReset = normalizeAuthIdentifier(raw);
    if (!emailToReset) {
      alert('Please provide a valid username or email address.');
      return;
    }

    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, emailToReset);
      setToast({
        type: 'success',
        text: `Password reset link sent to ${emailToReset}! Check inbox/spam folder.`,
      });
    } catch (err) {
      console.error('Password reset email error:', err);
      const friendlyMsg =
        err.code === 'auth/user-not-found'
          ? `No account with identifier "${formatDisplayIdentifier(emailToReset)}" found in Firebase Auth.`
          : err.message || 'Failed to send password reset email.';
      setToast({ type: 'error', text: friendlyMsg });
    } finally {
      setResetSending(false);
    }
  };

  // Save Staff (Create / Update)
  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      setErrorMsg('Please enter Name, Username/Email, and Role.');
      return;
    }

    setSaving(true);
    try {
      // Normalize username or non-standard email to a valid Firebase email
      const normalizedEmail = normalizeAuthIdentifier(form.email);
      const displayUser = formatDisplayIdentifier(normalizedEmail);
      const existingMember = staffList.find((s) => s.id === editingStaffId);

      // 1. If password is provided, ensure it is set directly in Firebase Auth
      if (form.password) {
        if (form.password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        // Method A: Attempt to create Auth user directly on secondaryAuth
        try {
          const userCred = await createUserWithEmailAndPassword(
            secondaryAuth,
            normalizedEmail,
            form.password
          );
          await updateProfile(userCred.user, { displayName: form.name.trim() });
          await secondarySignOut(secondaryAuth);
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            // Method B: Account already exists in Auth!
            let signedIn = false;

            try {
              await signInWithEmailAndPassword(secondaryAuth, normalizedEmail, form.password);
              signedIn = true;
            } catch {
              // Not matching new password yet
            }

            if (!signedIn && existingMember?.password) {
              try {
                await signInWithEmailAndPassword(
                  secondaryAuth,
                  normalizedEmail,
                  existingMember.password
                );
                signedIn = true;
              } catch (oldErr) {
                console.warn('Could not sign in with stored password:', oldErr);
              }
            }

            if (signedIn && secondaryAuth.currentUser) {
              try {
                await updatePassword(secondaryAuth.currentUser, form.password);
              } catch (updateErr) {
                console.error('Failed to update password:', updateErr);
              } finally {
                await secondarySignOut(secondaryAuth);
              }
            }
          } else {
            throw authErr;
          }
        }
      }

      // 2. Prepare payload for Firestore `staff` collection
      const payload = {
        name: form.name.trim(),
        email: normalizedEmail,
        displayUsername: displayUser,
        role: form.role.trim(),
        phone: form.phone.trim(),
        monthlySalary: Number(form.monthlySalary || 0),
        status: form.status,
        allowedTabs: form.allowedTabs || [],
        allowedActions: form.allowedActions || [],
        hasLoginAccess: true,
        updatedAt: serverTimestamp(),
      };

      // Always preserve or update password in Firestore document so we can re-sync anytime
      if (form.password) {
        payload.password = form.password;
      } else if (existingMember?.password) {
        payload.password = existingMember.password;
      }

      if (editingStaffId) {
        await updateDoc(doc(db, 'staff', editingStaffId), payload);
      } else {
        await addDoc(collection(db, 'staff'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
      }

      setShowModal(false);
      loadStaff(false);

      if (form.password) {
        setToast({
          type: 'success',
          text: `Password successfully set for "${displayUser}"! Login with ID "${displayUser}" and the new password.`,
        });
      } else {
        setToast({
          type: 'success',
          text: `Staff details & permissions successfully updated for "${displayUser}".`,
        });
      }
    } catch (err) {
      console.error('Error saving staff:', err);
      const friendlyMsg =
        err.message || 'Failed to save staff member. Please check details and try again.';
      setErrorMsg(friendlyMsg);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Staff Status (Quick Action)
  const handleToggleStatus = async (member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'staff', member.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setStaffList((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, status: newStatus } : s))
      );
      setToast({
        type: 'info',
        text: `${member.name} is now ${newStatus.toUpperCase()}.`,
      });
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status.');
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (member) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${member.name} (${formatDisplayIdentifier(member.email)})? They will lose access immediately.`
      )
    )
      return;
    try {
      if (member.password && member.email) {
        try {
          await signInWithEmailAndPassword(secondaryAuth, member.email, member.password);
          if (secondaryAuth.currentUser) {
            await deleteUser(secondaryAuth.currentUser);
          }
        } catch {
          // Ignore if auth deletion fails
        } finally {
          await secondarySignOut(secondaryAuth);
        }
      }

      await deleteDoc(doc(db, 'staff', member.id));
      setStaffList((prev) => prev.filter((s) => s.id !== member.id));
      setToast({ type: 'info', text: `Removed ${member.name} from staff records.` });
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Failed to delete staff member.');
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((m) => {
    const q = search.toLowerCase();
    const display = formatDisplayIdentifier(m.email).toLowerCase();
    const matchesSearch =
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      display.includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalActive = staffList.filter((s) => s.status === 'active').length;
  const totalWithLogin = staffList.filter(
    (s) => s.hasLoginAccess || (s.allowedTabs && s.allowedTabs.length > 0)
  ).length;

  return (
    <div>
      {/* ─── Toast Notification Banner ─── */}
      {toast && (
        <div
          style={{
            background:
              toast.type === 'error'
                ? 'rgba(239,68,68,0.15)'
                : toast.type === 'info'
                ? 'rgba(56,189,248,0.15)'
                : 'rgba(52,211,153,0.15)',
            border: `1px solid ${
              toast.type === 'error'
                ? 'rgba(239,68,68,0.4)'
                : toast.type === 'info'
                ? 'rgba(56,189,248,0.4)'
                : 'rgba(52,211,153,0.4)'
            }`,
            color: '#fff',
            borderRadius: 12,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {toast.type === 'error' ? (
              <AlertCircle size={18} color="#f87171" />
            ) : toast.type === 'info' ? (
              <Info size={18} color="#38bdf8" />
            ) : (
              <CheckCircle2 size={18} color="#34d399" />
            )}
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>{toast.text}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── Header & Metrics ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          { label: 'Total Team Members', value: staffList.length, icon: Users, color: '#ff6a1a' },
          {
            label: 'Active Staff Accounts',
            value: totalActive,
            icon: CheckCircle2,
            color: '#34d399',
          },
          {
            label: 'Portal Access Enabled',
            value: totalWithLogin,
            icon: KeyRound,
            color: '#38bdf8',
          },
          {
            label: 'System Navigations',
            value: ALL_ADMIN_NAVIGATIONS.length,
            icon: Layers,
            color: '#a78bfa',
          },
          // eslint-disable-next-line no-unused-vars
        ].map(({ label, value, icon: _Icon, color }) => (
          <div key={label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                border: `1px solid ${color}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color,
                flexShrink: 0,
              }}
            >
              <_Icon size={20} />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>
                {label}
              </div>
              <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginTop: 2 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Control Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search
              size={15}
              color="rgba(255,255,255,0.35)"
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
            <input
              type="text"
              placeholder="Search staff by username, name, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...S.inp,
                paddingLeft: 38,
                borderRadius: 12,
                fontSize: 13,
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              ...S.inp,
              width: 'auto',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 13,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <option value="all" style={{ background: '#111827' }}>
              All Status
            </option>
            <option value="active" style={{ background: '#111827' }}>
              Active Only
            </option>
            <option value="inactive" style={{ background: '#111827' }}>
              Inactive
            </option>
          </select>

          <button
            onClick={() => loadStaff(true)}
            disabled={refreshing}
            style={{
              ...S.btn,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              padding: '10px 14px',
              borderRadius: 12,
            }}
          >
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>

        {canCreateStaff && (
          <button
            id="add-staff-btn"
            onClick={handleOpenCreate}
            style={{
              ...S.btn,
              background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
              color: '#fff',
              fontWeight: 600,
              padding: '11px 18px',
              borderRadius: 12,
              boxShadow: '0 4px 14px rgba(255,106,26,0.35)',
            }}
          >
            <UserPlus size={16} /> Add Staff Account
          </button>
        )}
      </div>

      {/* ─── Staff List / Cards ─── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '70px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw
            size={32}
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}
          />
          <p>Loading staff records...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
          <Users size={44} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 6px' }}>
            {search ? 'No staff matched your query' : 'No staff members found'}
          </h3>
          <p
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 13,
              maxWidth: 420,
              margin: '0 auto 18px',
            }}
          >
            {search
              ? 'Try adjusting your search terms or filters.'
              : 'Add team members with a username or email and configure navigation and action permissions.'}
          </p>
          {canCreateStaff && !search && (
            <button
              onClick={handleOpenCreate}
              style={{
                ...S.btn,
                background: 'rgba(255,106,26,0.15)',
                border: '1px solid rgba(255,106,26,0.35)',
                color: '#ff9a4a',
                margin: '0 auto',
              }}
            >
              <UserPlus size={14} /> Create First Staff Account
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredStaff.map((member) => {
            const allowed = member.allowedTabs || [];
            const userActions = Array.isArray(member.allowedActions)
              ? member.allowedActions
              : getActionsForTabs(allowed);
            const isActive = member.status === 'active';
            const displayUser = formatDisplayIdentifier(member.email);
            const isInternalHandle = member.email && member.email.endsWith('@odc.internal');
            const isExpanded = expandedDetailsId === member.id;

            return (
              <div
                key={member.id}
                style={{
                  ...S.card,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  border: isActive
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(239,68,68,0.2)',
                  background: isActive ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.03)',
                }}
              >
                {/* Top Row: Info + Status + Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240 }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(255,106,26,0.25), rgba(255,154,74,0.1))'
                          : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                        border: `1px solid ${
                          isActive ? 'rgba(255,106,26,0.35)' : 'rgba(239,68,68,0.3)'
                        }`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? '#ff9a4a' : '#f87171',
                        fontWeight: 700,
                        fontSize: 17,
                        flexShrink: 0,
                      }}
                    >
                      {(member.name || '?')[0].toUpperCase()}
                    </div>

                    {/* Meta */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                          {member.name}
                        </span>
                        <span
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {member.role || 'Staff'}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: isActive
                              ? 'rgba(52,211,153,0.12)'
                              : 'rgba(239,68,68,0.12)',
                            color: isActive ? '#34d399' : '#f87171',
                            border: `1px solid ${
                              isActive ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'
                            }`,
                          }}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          marginTop: 5,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            color: '#ff9a4a',
                            fontSize: 12,
                          }}
                        >
                          {isInternalHandle ? (
                            <User size={12} color="#ff9a4a" />
                          ) : (
                            <Mail size={12} color="rgba(255,255,255,0.4)" />
                          )}
                          <span>
                            {displayUser}
                            {isInternalHandle && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  color: 'rgba(255,255,255,0.3)',
                                  fontSize: 11,
                                }}
                              >
                                (login username)
                              </span>
                            )}
                          </span>
                        </div>
                        {member.phone && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: 12,
                            }}
                          >
                            <Phone size={12} />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {!isInternalHandle && canEditStaff && (
                      <button
                        onClick={() => handleSendResetEmail(member.email)}
                        style={{
                          ...S.btn,
                          background: 'rgba(56,189,248,0.1)',
                          border: '1px solid rgba(56,189,248,0.25)',
                          color: '#38bdf8',
                        }}
                        title="Send password reset link to email"
                      >
                        <KeyRound size={13} /> Reset Link
                      </button>
                    )}

                    {canEditStaff && (
                      <button
                        onClick={() => handleOpenEdit(member)}
                        style={{
                          ...S.btn,
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#fff',
                        }}
                      >
                        <Edit2 size={13} /> Edit Permissions
                      </button>
                    )}

                    {canToggleStaffStatus && (
                      <button
                        onClick={() => handleToggleStatus(member)}
                        style={{
                          ...S.btn,
                          background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
                          border: `1px solid ${
                            isActive ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'
                          }`,
                          color: isActive ? '#f87171' : '#34d399',
                        }}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}

                    {canDeleteStaff && (
                      <button
                        onClick={() => handleDeleteStaff(member)}
                        style={{
                          ...S.btn,
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.18)',
                          color: '#f87171',
                          padding: '8px 10px',
                        }}
                        title="Delete staff account"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Permitted Tabs & Granular Actions */}
                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Lock size={12} /> Permitted Tabs ({allowed.length}) &bull; Actions (
                        {userActions.length}):
                      </span>

                      {allowed.length === 0 ? (
                        <span style={{ color: '#f87171', fontSize: 12, fontStyle: 'italic' }}>
                          No navigations assigned (User cannot access any tabs)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {allowed.map((tabId) => {
                            const navInfo = ALL_ADMIN_NAVIGATIONS.find((n) => n.id === tabId);
                            const NavIcon = navInfo?.icon || Layers;
                            const label = navInfo?.label || tabId;
                            const color = navInfo?.color || '#ff9a4a';
                            const tabTotalActions = (navInfo?.actions || []).length;
                            const tabEnabledActions = (navInfo?.actions || []).filter((a) =>
                              userActions.includes(a.id)
                            ).length;

                            return (
                              <span
                                key={tabId}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  background: `${color}15`,
                                  border: `1px solid ${color}35`,
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 500,
                                }}
                              >
                                <NavIcon size={12} color={color} />
                                <span>{label}</span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background:
                                      tabEnabledActions === 0
                                        ? 'rgba(239,68,68,0.2)'
                                        : `${color}30`,
                                    color: tabEnabledActions === 0 ? '#fca5a5' : color,
                                    fontWeight: 700,
                                  }}
                                >
                                  {tabEnabledActions === tabTotalActions
                                    ? 'Full'
                                    : tabEnabledActions === 0
                                    ? 'View Only'
                                    : `${tabEnabledActions}/${tabTotalActions}`}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {allowed.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedDetailsId(isExpanded ? null : member.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.45)',
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: 'inherit',
                        }}
                      >
                        {isExpanded ? 'Hide Action Breakdown' : 'View Action Breakdown'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Granular Action Details */}
                  {isExpanded && allowed.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {allowed.map((tabId) => {
                        const navInfo = ALL_ADMIN_NAVIGATIONS.find((n) => n.id === tabId);
                        if (!navInfo) return null;
                        const actions = navInfo.actions || [];
                        const enabledForThis = actions.filter((a) => userActions.includes(a.id));

                        return (
                          <div
                            key={tabId}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: 8,
                              padding: '8px 12px',
                            }}
                          >
                            <div
                              style={{
                                color: navInfo.color,
                                fontSize: 12,
                                fontWeight: 700,
                                marginBottom: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <navInfo.icon size={13} /> {navInfo.label}
                            </div>
                            {actions.length === 0 ? (
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                                No sub-actions configured.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {actions.map((act) => {
                                  const isActEnabled = enabledForThis.some(
                                    (ea) => ea.id === act.id
                                  );
                                  return (
                                    <div
                                      key={act.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 11,
                                        color: isActEnabled ? '#fff' : 'rgba(255,255,255,0.35)',
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          background: isActEnabled ? '#34d399' : 'rgba(255,255,255,0.2)',
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontWeight: isActEnabled ? 600 : 400,
                                          textDecoration: isActEnabled ? 'none' : 'line-through',
                                        }}
                                      >
                                        {act.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD / EDIT STAFF MODAL / DRAWER ─── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(5, 8, 16, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0f141f',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              width: '100%',
              maxWidth: 780,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
              padding: 28,
              color: '#fff',
              fontFamily: 'inherit',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  {editingStaffId ? <Edit2 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {editingStaffId
                      ? 'Edit Staff Account & Permissions'
                      : 'Create New Staff Account'}
                  </h3>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                    Assign login credentials, configure navigation tabs, and check specific action
                    permissions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 10,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Error / Alert */}
            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                <AlertCircle size={16} flexShrink={0} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleSaveSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              {/* Basic Fields */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <label style={S.lbl}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={S.inp}
                  />
                </div>

                <div>
                  <label style={S.lbl}>Username or Email (Login ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. mark, staff01, or alex@odc.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={S.inp}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    Plain usernames (e.g. <code>staff1</code>) or standard emails work.
                  </span>
                </div>

                <div>
                  <label style={S.lbl}>Role / Position *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Support Specialist, Developer"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    style={S.inp}
                  />
                </div>

                <div>
                  <label style={S.lbl}>Phone Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="09123456789"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={S.inp}
                  />
                </div>
              </div>

              {/* Login Credentials Section */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={16} color="#ff9a4a" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {editingStaffId
                        ? 'Portal Authentication Password'
                        : 'Create Portal Sign-In Account'}
                    </span>
                  </div>

                  {editingStaffId &&
                    form.email &&
                    form.email.includes('@') &&
                    !form.email.endsWith('@odc.internal') && (
                      <button
                        type="button"
                        onClick={() => handleSendResetEmail(form.email)}
                        disabled={resetSending}
                        style={{
                          ...S.btn,
                          background: 'rgba(56,189,248,0.12)',
                          border: '1px solid rgba(56,189,248,0.3)',
                          color: '#38bdf8',
                          fontSize: 12,
                          padding: '6px 12px',
                        }}
                      >
                        <Send size={12} />{' '}
                        {resetSending ? 'Sending Link...' : 'Send Password Reset Email'}
                      </button>
                    )}
                </div>

                <p
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 12,
                    margin: '0 0 12px',
                    lineHeight: 1.4,
                  }}
                >
                  {editingStaffId
                    ? 'Enter a new password below to update their login credentials directly.'
                    : 'Set an initial password (min 6 characters) so the staff member can sign in at /odc.'}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={S.lbl}>
                      {editingStaffId
                        ? 'Set New Password (Min. 6 chars)'
                        : 'Initial Password *'}
                    </label>
                    <input
                      type="password"
                      placeholder={
                        editingStaffId
                          ? '•••••••• (Leave blank to keep current)'
                          : 'Min. 6 characters'
                      }
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      style={S.inp}
                      required={!editingStaffId && form.createLogin}
                    />
                  </div>

                  <div>
                    <label style={S.lbl}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      style={{ ...S.inp, cursor: 'pointer', background: '#111827' }}
                    >
                      <option value="active">Active (Access Enabled)</option>
                      <option value="inactive">Inactive (Access Suspended)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ─── GRANULAR NAVIGATION & ACTION PERMISSION MANAGER ─── */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ShieldCheck size={16} color="#34d399" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                        Page & Action Permissions
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                      Enable modules and toggle specific action permissions (Create, Edit, Sign,
                      Delete, etc.) for each page.
                    </p>
                  </div>

                  {/* Summary & Quick Global Toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: 11,
                        color: '#ff9a4a',
                        fontWeight: 600,
                      }}
                    >
                      {(form.allowedTabs || []).length} tabs &bull;{' '}
                      {(form.allowedActions || []).length} actions
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      style={{
                        ...S.btn,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#ff9a4a',
                        padding: '5px 10px',
                        fontSize: 11,
                      }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllTabs}
                      style={{
                        ...S.btn,
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.5)',
                        padding: '5px 10px',
                        fontSize: 11,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Preset Chips */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                    Presets:
                  </span>
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        padding: '3px 8px',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title={p.desc}
                    >
                      <Sparkles size={11} color="#ff9a4a" /> {p.name}
                    </button>
                  ))}
                </div>

                {/* Module Cards Grid with Nested Action Permissions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ALL_ADMIN_NAVIGATIONS.map((nav) => {
                    const isTabChecked = (form.allowedTabs || []).includes(nav.id);
                    const NavIcon = nav.icon;
                    const actions = nav.actions || [];
                    const activeActionCount = actions.filter((a) =>
                      (form.allowedActions || []).includes(a.id)
                    ).length;

                    return (
                      <div
                        key={nav.id}
                        style={{
                          background: isTabChecked
                            ? `${nav.color}0c`
                            : 'rgba(255,255,255,0.02)',
                          border: isTabChecked
                            ? `1px solid ${nav.color}45`
                            : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 12,
                          padding: '14px 16px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Parent Tab Row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            onClick={() => handleToggleTab(nav.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              cursor: 'pointer',
                              flex: 1,
                              userSelect: 'none',
                            }}
                          >
                            {/* Checkbox */}
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                background: isTabChecked ? nav.color : 'rgba(255,255,255,0.08)',
                                border: isTabChecked
                                  ? `1px solid ${nav.color}`
                                  : '1px solid rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isTabChecked && <Check size={14} strokeWidth={3} />}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <NavIcon
                                  size={16}
                                  color={isTabChecked ? nav.color : 'rgba(255,255,255,0.5)'}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: isTabChecked ? '#fff' : 'rgba(255,255,255,0.7)',
                                  }}
                                >
                                  {nav.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: isTabChecked
                                      ? activeActionCount === actions.length
                                        ? `${nav.color}25`
                                        : activeActionCount === 0
                                        ? 'rgba(239,68,68,0.2)'
                                        : 'rgba(255,255,255,0.08)'
                                      : 'rgba(255,255,255,0.04)',
                                    color: isTabChecked
                                      ? activeActionCount === 0
                                        ? '#fca5a5'
                                        : nav.color
                                      : 'rgba(255,255,255,0.3)',
                                    fontWeight: 600,
                                  }}
                                >
                                  {!isTabChecked
                                    ? 'Disabled'
                                    : activeActionCount === actions.length
                                    ? 'Full Control'
                                    : activeActionCount === 0
                                    ? 'View Only'
                                    : `${activeActionCount}/${actions.length} Actions`}
                                </span>
                              </div>
                              <p
                                style={{
                                  margin: '2px 0 0',
                                  fontSize: 11,
                                  color: 'rgba(255,255,255,0.4)',
                                }}
                              >
                                {nav.desc}
                              </p>
                            </div>
                          </div>

                          {/* Quick Actions Toggles for this Module */}
                          {isTabChecked && actions.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleSelectAllActionsForTab(nav.id)}
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 6,
                                  padding: '3px 8px',
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,0.8)',
                                  cursor: 'pointer',
                                }}
                              >
                                All Actions
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearAllActionsForTab(nav.id)}
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: 6,
                                  padding: '3px 8px',
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer',
                                }}
                              >
                                View Only
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Nested Sub-Actions Checkboxes */}
                        {isTabChecked && actions.length > 0 && (
                          <div
                            style={{
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                              gap: 8,
                            }}
                          >
                            {actions.map((act) => {
                              const isActionChecked = (form.allowedActions || []).includes(act.id);

                              return (
                                <div
                                  key={act.id}
                                  onClick={() => handleToggleAction(act.id, nav.id)}
                                  style={{
                                    background: isActionChecked
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.15)',
                                    border: isActionChecked
                                      ? `1px solid ${nav.color}50`
                                      : '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: 8,
                                    padding: '7px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 8,
                                    userSelect: 'none',
                                    transition: 'all 0.1s ease',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 15,
                                      height: 15,
                                      borderRadius: 4,
                                      marginTop: 2,
                                      background: isActionChecked
                                        ? nav.color
                                        : 'rgba(255,255,255,0.08)',
                                      border: isActionChecked
                                        ? `1px solid ${nav.color}`
                                        : '1px solid rgba(255,255,255,0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isActionChecked && <Check size={11} strokeWidth={3} />}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: isActionChecked ? 600 : 400,
                                        color: isActionChecked
                                          ? '#fff'
                                          : 'rgba(255,255,255,0.6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      {act.label}
                                    </div>
                                    <p
                                      style={{
                                        margin: '2px 0 0',
                                        fontSize: 10,
                                        color: 'rgba(255,255,255,0.35)',
                                        lineHeight: 1.25,
                                      }}
                                    >
                                      {act.desc}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    ...S.btn,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.7)',
                    padding: '10px 18px',
                    borderRadius: 10,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...S.btn,
                    background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
                    color: '#fff',
                    fontWeight: 600,
                    padding: '10px 22px',
                    borderRadius: 10,
                    boxShadow: '0 4px 14px rgba(255,106,26,0.3)',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      {editingStaffId ? 'Save Changes' : 'Create Staff Member'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
