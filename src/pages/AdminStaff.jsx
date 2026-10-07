import { useState, useEffect, useCallback } from 'react';
import { db, auth, secondaryAuth } from '../lib/firebase';
import { useSystemModal } from '../components/ui/SystemModalContext';
import LoadingButton from '../components/ui/LoadingButton';
import {
  ALL_ADMIN_NAVIGATIONS,
  getAllActionIds,
  getActionsForTabs,
} from '../utils/navigationConfig';
import { normalizeAuthIdentifier, formatDisplayIdentifier } from '../utils/authHelpers';
import { getStaffModulePermissions, saveStaffModulePermissions, registerStaffLoginIdentity } from '../services/staffPermissionService';
import { TRUSTED_STAFF_MODULES, hydrateStaffPermissions, staffModuleChanges } from '../utils/staffModulePermissions';
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
    desc: 'Invoices, Payroll, Allowances, MOA & Acceptance (No Deletion)',
    tabs: ['invoices', 'salaries', 'moa', 'acceptance', 'clients', 'allowances'],
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
      'allowances:meeting',
      'allowances:liquidate',
      'allowances:request',
      'allowances:review',
      'allowances:approve',
      'allowances:release',
      'allowances:reports',
    ],
  },
  {
    name: 'Sales',
    desc: 'Client demonstrations and personal meeting expenses',
    tabs: ['clients', 'demos', 'allowances'],
    actions: ['clients:create', 'demos:book', 'allowances:meeting', 'allowances:liquidate', 'allowances:request'],
  },
  {
    name: 'Demo Presenter',
    desc: 'Publish available hours and manage assigned demonstrations',
    tabs: ['demos'],
    actions: ['demos:present'],
  },
  {
    name: 'Minimal / Read Only',
    desc: 'Contacts tab view-only (No actions enabled)',
    tabs: ['contacts'],
    actions: [],
  },
];

const ALLOWANCE_ROLE_BADGES = {
  Staff: { color: '#8ed0ff', background: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' },
  Operations: { color: '#f4c878', background: 'rgba(217, 166, 106, 0.12)', border: 'rgba(217, 166, 106, 0.3)' },
  Finance: { color: '#7ee2b8', background: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)' },
  Administrator: { color: '#d5b6ff', background: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.3)' },
};

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

export default function AdminStaff({ firebaseUser, isSuperAdmin, can, onOpenAllowances, onOpenDemos }) {
  const modal = useSystemModal();
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
  const [modulePermissions, setModulePermissions] = useState(null);
  const [modulePermissionError, setModulePermissionError] = useState('');
  const [modulePermissionLoading, setModulePermissionLoading] = useState(true);
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
    demoPresenterEnabled: false,
  });

  const canCreateStaff = can ? can('staff:create') : isSuperAdmin;
  const canEditStaff = can ? can('staff:edit') : isSuperAdmin;
  const canToggleStaffStatus = can ? can('staff:status') : isSuperAdmin;
  const canDeleteStaff = can ? can('staff:delete') : isSuperAdmin;
  const canEditModule = (module) => !TRUSTED_STAFF_MODULES.includes(module) || modulePermissions?.[module]?.editable === true;
  const loadModulePermissions = useCallback(async () => {
    setModulePermissionLoading(true);
    setModulePermissionError('');
    try {
      const context = await getStaffModulePermissions();
      setModulePermissions(context);
      return context;
    } catch (error) {
      setModulePermissions(null);
      setModulePermissionError(error.code === 'functions/not-found' || error.code === 'functions/unavailable'
        ? 'Demo and allowance permissions are unavailable. Check the connection and feature setup, then retry.'
        : error.message || 'Unable to load demo and allowance permissions.');
      return null;
    } finally {
      setModulePermissionLoading(false);
    }
  }, []);

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
    loadModulePermissions();
  }, [loadStaff, loadModulePermissions]);

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
      demoPresenterEnabled: false,
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (member) => {
    const context = await loadModulePermissions();
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
      ...hydrateStaffPermissions(tabs, actions, context, member.id),
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Checkbox Toggle for Navigations (Parent Tab)
  const handleToggleTab = (tabId) => {
    if (!canEditModule(tabId) || saving) return;
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
          demoPresenterEnabled: tabId === 'demos' ? false : prev.demoPresenterEnabled,
        };
      } else {
        // Checking parent tab adds the tab AND enables all its sub-actions by default
        return {
          ...prev,
          allowedTabs: [...currentTabs, tabId],
          allowedActions: Array.from(new Set([...currentActions, ...tabActions])),
          demoPresenterEnabled: tabId === 'demos' ? true : prev.demoPresenterEnabled,
        };
      }
    });
  };

  // Checkbox Toggle for Granular Actions
  const handleToggleAction = (actionId, tabId) => {
    if (!canEditModule(tabId) || saving) return;
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
        demoPresenterEnabled: actionId === 'demos:present' ? !isActionChecked : prev.demoPresenterEnabled,
      };
    });
  };

  // Select all actions for a specific module
  const handleSelectAllActionsForTab = (tabId) => {
    if (!canEditModule(tabId) || saving) return;
    setForm((prev) => {
      const currentTabs = prev.allowedTabs || [];
      const currentActions = prev.allowedActions || [];
      const tabActions = getActionsForTabs([tabId]);

      return {
        ...prev,
        allowedTabs: currentTabs.includes(tabId) ? currentTabs : [...currentTabs, tabId],
        allowedActions: Array.from(new Set([...currentActions, ...tabActions])),
        demoPresenterEnabled: tabId === 'demos' ? true : prev.demoPresenterEnabled,
      };
    });
  };

  // Clear all actions for a specific module (read-only access)
  const handleClearAllActionsForTab = (tabId) => {
    if (!canEditModule(tabId) || saving) return;
    setForm((prev) => {
      const currentActions = prev.allowedActions || [];
      const tabActions = getActionsForTabs([tabId]);

      return {
        ...prev,
        allowedActions: currentActions.filter((actId) => !tabActions.includes(actId)),
        demoPresenterEnabled: tabId === 'demos' ? false : prev.demoPresenterEnabled,
      };
    });
  };

  // Select / Deselect All Navigations & Actions
  const handleApplyPreset = (preset) => {
    if (saving) return;
    setForm(prev => ({
      ...prev,
      allowedTabs: [...preset.tabs.filter(canEditModule), ...prev.allowedTabs.filter(tab => !canEditModule(tab))],
      allowedActions: [...preset.actions.filter(action => canEditModule(action.split(':')[0])), ...prev.allowedActions.filter(action => !canEditModule(action.split(':')[0]))],
      demoPresenterEnabled: canEditModule('demos') ? preset.actions.includes('demos:present') : prev.demoPresenterEnabled,
    }));
  };
  const handleSelectAllTabs = () => handleApplyPreset(PRESETS[0]);
  const handleClearAllTabs = () => handleApplyPreset({ tabs: [], actions: [] });

  // Trigger Password Reset Email
  const handleSendResetEmail = async (targetEmail) => {
    const raw = targetEmail || form.email || '';
    const emailToReset = normalizeAuthIdentifier(raw);
    if (!emailToReset) {
      modal.error({ title: 'Valid identifier required', message: 'Enter a valid username or email address before sending a reset link.' });
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
    let detailsSaved = false;
    try {
      // Normalize username or non-standard email to a valid Firebase email
      const normalizedEmail = normalizeAuthIdentifier(form.email);
      const displayUser = formatDisplayIdentifier(normalizedEmail);
      const existingMember = staffList.find((s) => s.id === editingStaffId);
      let verifiedLogin;
      if (modulePermissionError && form.allowedTabs.some(tab => TRUSTED_STAFF_MODULES.includes(tab))) {
        throw new Error('Demo and allowance permissions could not be verified. Reopen the editor after the permission service is available.');
      }

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
          verifiedLogin = { uid: userCred.user.uid, email: userCred.user.email };
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
              verifiedLogin = { uid: secondaryAuth.currentUser.uid, email: secondaryAuth.currentUser.email };
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

      let savedStaffId = editingStaffId;
      if (savedStaffId) {
        await updateDoc(doc(db, 'staff', editingStaffId), payload);
      } else {
        const created = await addDoc(collection(db, 'staff'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
        savedStaffId = created.id;
        // Keep this record on a permission-service failure so retry cannot create a duplicate.
        setEditingStaffId(savedStaffId);
      }
      detailsSaved = true;
      if (verifiedLogin && Object.values(modulePermissions).some(module => module.editable)) await registerStaffLoginIdentity(savedStaffId, verifiedLogin);
      const changes = staffModuleChanges(form, modulePermissions, savedStaffId);
      if (Object.keys(changes).length) {
        let grants;
        try {
          grants = await saveStaffModulePermissions(savedStaffId, changes);
        } catch (permissionError) {
          // Older accounts can predate the immutable Firebase UID link.
          // Verify their existing login before registering it; email alone is insufficient.
          const canLinkExisting = permissionError.code === 'staff/login-not-linked'
            && !verifiedLogin && typeof existingMember?.password === 'string' && existingMember.password
            && normalizeAuthIdentifier(existingMember.email) === normalizedEmail;
          if (!canLinkExisting) throw permissionError;
          let identity;
          try {
            const credential = await signInWithEmailAndPassword(secondaryAuth, normalizedEmail, existingMember.password);
            identity = { uid: credential.user.uid, email: credential.user.email };
          } catch (loginError) {
            if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/user-disabled'].includes(loginError.code)) {
              throw new Error('The existing staff login could not be verified automatically. Have the staff member sign out and sign back in at /odc, then reopen this record and save the permissions again.');
            }
            throw loginError;
          } finally {
            await secondarySignOut(secondaryAuth);
          }
          await registerStaffLoginIdentity(savedStaffId, identity);
          grants = await saveStaffModulePermissions(savedStaffId, changes);
        }
        setModulePermissions(previous => {
          const next = { ...previous };
          for (const [module, grant] of Object.entries(grants)) next[module] = { ...previous[module], grants: { ...previous[module].grants, [savedStaffId]: grant } };
          return next;
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
      setErrorMsg(detailsSaved ? `Staff details were saved, but demo/allowance permissions were not saved. ${friendlyMsg} Retry Save, or reopen the editor if access changed elsewhere.` : friendlyMsg);
      if (detailsSaved) loadStaff(false);
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
      modal.error('We could not update the staff status. Please try again.');
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (member) => {
    const confirmed = await modal.confirm({
      title: 'Remove staff access?',
      message: `${member.name} (${formatDisplayIdentifier(member.email)}) will be removed and lose access immediately.`,
      confirmLabel: 'Remove access',
    });
    if (!confirmed) return;
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
      modal.success({ title: 'Staff access removed', message: `${member.name} can no longer access the admin system.` });
    } catch (err) {
      console.error('Error deleting staff:', err);
      modal.error('We could not remove the staff member. Please try again.');
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
  const totalInactive = staffList.length - totalActive;

  return (
    <div className="mx-auto w-full max-w-[1480px] text-[#f6f7f9]">
      <header className="mb-6 flex items-end justify-between gap-7 max-[1080px]:items-start max-md:flex-col max-md:items-stretch max-md:gap-[18px]">
        <div className="min-w-0">
          <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.11em] text-[#ffad73]">
            <ShieldCheck size={13} /> Team access
          </span>
          <h1 className="m-0 text-[clamp(26px,2.8vw,38px)] font-[720] leading-[1.05] tracking-[-0.045em] text-white">
            Staff management
          </h1>
          <p className="mt-[9px] max-w-[560px] text-[13px] leading-[1.55] text-white/48">
            Manage staff profiles, login access, and system permissions.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 max-[1080px]:flex-col-reverse max-[1080px]:items-end max-md:items-stretch">
          {(onOpenAllowances || onOpenDemos) && (
            <div className="flex items-center gap-1 rounded-[10px] border border-white/7 bg-white/[0.035] p-1 max-md:flex-wrap" aria-label="Related tools">
              <span className="px-[7px] text-[10px] font-semibold uppercase tracking-[0.06em] text-white/32 max-md:w-full max-md:pt-[5px]">
                Related tools
              </span>
              {onOpenAllowances && (
                <button
                  type="button"
                  onClick={onOpenAllowances}
                  className="min-h-8 rounded-[7px] border-0 bg-transparent px-2.5 text-[11px] font-medium text-white/65 transition-colors duration-200 hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
                >
                  Allowances
                </button>
              )}
              {onOpenDemos && (
                <button
                  type="button"
                  onClick={onOpenDemos}
                  className="min-h-8 rounded-[7px] border-0 bg-transparent px-2.5 text-[11px] font-medium text-white/65 transition-colors duration-200 hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
                >
                  Demo scheduling
                </button>
              )}
            </div>
          )}
          {canCreateStaff && (
            <button
              id="add-staff-btn"
              className="inline-flex min-h-[42px] items-center justify-center gap-[7px] rounded-[10px] border border-[#f17b3b] bg-[#ee6b24] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(167,65,14,0.22)] transition-all duration-200 hover:-translate-y-px hover:bg-[#f27937] hover:shadow-[0_10px_28px_rgba(167,65,14,0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
              onClick={handleOpenCreate}
            >
              <UserPlus size={16} /> Add staff
            </button>
          )}
        </div>
      </header>
      {/* ─── Toast Notification Banner ─── */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
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
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
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

      <section className="mb-[22px] grid grid-cols-4 overflow-hidden rounded-[14px] border border-white/[0.075] bg-white/[0.032] shadow-[0_18px_50px_rgba(1,4,12,0.12)] max-[1080px]:grid-cols-2 max-[480px]:grid-cols-1" aria-label="Staff overview">
        {[
          { label: 'Team members', value: staffList.length, icon: <Users size={20} /> },
          {
            label: 'Active accounts',
            value: totalActive,
            icon: <CheckCircle2 size={20} />,
          },
          {
            label: 'Login enabled',
            value: totalWithLogin,
            icon: <KeyRound size={20} />,
          },
          {
            label: 'Inactive accounts',
            value: totalInactive,
            icon: <AlertCircle size={20} />,
          },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-3 border-l border-white/[0.065] px-5 py-[17px] first:border-l-0 max-[1080px]:nth-[3]:border-l-0 max-[1080px]:nth-[n+3]:border-t max-[480px]:border-l-0 max-[480px]:border-t max-[480px]:first:border-t-0"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#ee6b24]/9 text-[#f29356]" aria-hidden="true">
              {icon}
            </div>
            <div className="flex min-w-0 flex-col">
              <strong className="text-[21px] font-semibold leading-[1.15] tracking-[-0.025em] text-white tabular-nums">
                {value}
              </strong>
              <span className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-white/40">
                {label}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ─── Control Bar ─── */}
      <div className="mb-[14px] grid grid-cols-[minmax(260px,520px)_auto_1fr] items-center gap-2.5 max-[1080px]:grid-cols-[minmax(260px,1fr)_auto] max-md:grid-cols-1">
        <div className="relative min-w-0">
            <Search className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 text-white/35" size={16} aria-hidden="true" />
            <input
              type="text"
              aria-label="Search staff"
              placeholder="Search by name, login, role, or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-[42px] w-full rounded-[10px] border border-white/9 bg-white/[0.045] pr-10 pl-10 text-xs text-white outline-none transition-all duration-200 placeholder:text-white/30 hover:border-white/14 hover:bg-white/6 focus:border-[#f29356]/65 focus:shadow-[0_0_0_3px_rgba(238,107,36,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-[7px] border-0 bg-transparent p-0 text-white/40 hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356]"
              >
                <X size={14} />
              </button>
            )}
        </div>

        <div className="flex items-center gap-2 max-md:grid max-md:grid-cols-[1fr_auto]">
          <select
            aria-label="Filter staff by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-[42px] min-w-[142px] cursor-pointer rounded-[10px] border border-white/9 bg-white/[0.045] px-3 pr-[34px] text-xs text-white outline-none transition-all duration-200 hover:border-white/14 hover:bg-white/6 focus:border-[#f29356]/65 focus:shadow-[0_0_0_3px_rgba(238,107,36,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] max-md:w-full"
          >
            <option value="all" style={{ background: '#111827' }}>
              All staff ({staffList.length})
            </option>
            <option value="active" style={{ background: '#111827' }}>
              Active ({totalActive})
            </option>
            <option value="inactive" style={{ background: '#111827' }}>
              Inactive ({totalInactive})
            </option>
          </select>

          <LoadingButton
            className="inline-flex h-[42px] items-center justify-center gap-[7px] rounded-[10px] border border-transparent bg-transparent px-[13px] text-xs text-white/65 transition-all duration-200 hover:border-white/8 hover:bg-white/[0.055] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
            onClick={() => loadStaff(true)}
            loading={refreshing}
            loadingLabel="Refreshing…"
          >
            <RefreshCw size={14} />
            Refresh
          </LoadingButton>
        </div>
        <span className="justify-self-end text-[11px] text-white/35 tabular-nums max-[1080px]:hidden" aria-live="polite">
          {filteredStaff.length} {filteredStaff.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      {/* ─── Staff List / Cards ─── */}
      {loading ? (
        <div className="flex flex-col gap-2.5" aria-label="Loading staff records" aria-busy="true">
          {[0, 1, 2].map((item) => <div className="h-[132px] animate-pulse rounded-[14px] border border-white/5 bg-white/[0.025] motion-reduce:animate-none" key={item} />)}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center rounded-[14px] border border-dashed border-white/10 bg-white/[0.022] px-6 pt-16 pb-[70px] text-center">
          <div className="mb-[14px] grid size-12 place-items-center rounded-[13px] bg-white/4 text-white/30"><Users size={24} /></div>
          <h3 className="m-0 text-base font-semibold text-white/90">{search || statusFilter !== 'all' ? 'No matching staff' : 'No staff members yet'}</h3>
          <p className="mx-auto mt-[7px] mb-[18px] max-w-[430px] text-xs leading-[1.55] text-white/40">
            {search || statusFilter !== 'all'
              ? 'Clear the search and status filter to see the full team.'
              : 'Add a team member, create their login, and choose what they can access.'}
          </p>
          {search || statusFilter !== 'all' ? (
            <button type="button" className="inline-flex min-h-[42px] items-center justify-center gap-[7px] rounded-[10px] border border-white/10 bg-white/6 px-4 text-[13px] font-semibold text-white/80 transition-all duration-200 hover:bg-white/9 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              Clear filters
            </button>
          ) : canCreateStaff ? (
            <button type="button" className="inline-flex min-h-[42px] items-center justify-center gap-[7px] rounded-[10px] border border-[#f17b3b] bg-[#ee6b24] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(167,65,14,0.22)] transition-all duration-200 hover:-translate-y-px hover:bg-[#f27937] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]" onClick={handleOpenCreate}>
              <UserPlus size={14} /> Add first staff member
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredStaff.map((member) => {
            const allowed = member.allowedTabs || [];
            const userActions = Array.isArray(member.allowedActions)
              ? member.allowedActions
              : getActionsForTabs(allowed);
            const isActive = member.status === 'active';
            const displayUser = formatDisplayIdentifier(member.email);
            const isInternalHandle = member.email && member.email.endsWith('@odc.internal');
            const isExpanded = expandedDetailsId === member.id;
            const visibleTabs = isExpanded ? allowed : allowed.slice(0, 4);
            const hiddenTabCount = allowed.length - visibleTabs.length;

            return (
              <article
                key={member.id}
                className={`relative flex flex-col gap-[15px] rounded-[14px] border px-5 pt-[18px] pb-4 transition-all duration-200 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:scale-y-50 before:rounded-r-full before:opacity-0 before:transition-all before:duration-200 hover:border-white/11 hover:bg-white/[0.043] hover:shadow-[0_16px_36px_rgba(1,4,12,0.12)] hover:before:scale-y-100 hover:before:opacity-100 max-md:p-4 ${
                  isActive
                    ? 'border-white/7 bg-white/[0.028] before:bg-[#ee6b24]'
                    : 'border-[#e26565]/14 bg-[#b04141]/[0.035] before:bg-[#e36c6c]'
                }`}
              >
                {/* Top Row: Info + Status + Actions */}
                <div className="flex items-center justify-between gap-5 max-[1080px]:flex-col max-[1080px]:items-start">
                  <div className="flex min-w-[220px] items-center gap-[13px]">
                    {/* Avatar */}
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-xl border text-[15px] font-bold ${
                        isActive
                          ? 'border-[#ee6b24]/22 bg-[#ee6b24]/10 text-[#ffad73]'
                          : 'border-[#e26565]/18 bg-[#d65454]/8 text-[#e58b8b]'
                      }`}
                      aria-hidden="true"
                    >
                      {(member.name || '?')[0].toUpperCase()}
                    </div>

                    {/* Meta */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-[7px] max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-1">
                        <h2 className="m-0 text-[15px] font-semibold tracking-[-0.012em] text-white/95">{member.name}</h2>
                        <span className="rounded-[5px] bg-white/5 px-[7px] py-0.5 text-[10px] font-medium text-white/50">{member.role || 'Staff'}</span>
                        <span className={`inline-flex items-center gap-[5px] text-[10px] font-semibold ${isActive ? 'text-[#66c99a]' : 'text-[#e08585]'}`}>
                          <span className="size-[5px] rounded-full bg-current" aria-hidden="true" /> {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="mt-[5px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40 max-[480px]:flex-col max-[480px]:items-start">
                        <div className="inline-flex min-w-0 items-center gap-[5px] text-white/60">
                          {isInternalHandle ? (
                            <User size={13} />
                          ) : (
                            <Mail size={13} />
                          )}
                          <span className="overflow-hidden text-ellipsis">
                            {displayUser}
                            {isInternalHandle && (
                              <small className="ml-1.5 text-[9px] text-white/30 max-[480px]:hidden">login username</small>
                            )}
                          </span>
                        </div>
                        {member.phone && (
                          <div className="inline-flex min-w-0 items-center gap-[5px]">
                            <Phone size={13} />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 max-[1080px]:w-full max-[1080px]:justify-start max-md:grid max-md:grid-cols-2 max-[480px]:grid-cols-1">
                    {!isInternalHandle && canEditStaff && (
                      <LoadingButton
                        type="button"
                        className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-[11px] font-medium text-white/60 transition-all duration-200 hover:border-white/9 hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
                        onClick={() => handleSendResetEmail(member.email)}
                        loadingLabel="Sending…"
                        title="Send password reset link to email"
                      >
                        <KeyRound size={14} /> Reset password
                      </LoadingButton>
                    )}

                    {canEditStaff && (
                      <LoadingButton
                        type="button"
                        className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-[#ee6b24]/20 bg-[#ee6b24]/10 px-2.5 text-[11px] font-medium text-[#ffd0b1] transition-all duration-200 hover:border-[#ee6b24]/35 hover:bg-[#ee6b24]/17 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985]"
                        onClick={() => handleOpenEdit(member)}
                        loadingLabel="Opening…"
                      >
                        <Edit2 size={14} /> Edit access
                      </LoadingButton>
                    )}

                    {canToggleStaffStatus && (
                      <LoadingButton
                        className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-[11px] font-medium text-white/60 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985] ${
                          isActive
                            ? 'hover:border-[#dc4a4a]/16 hover:bg-[#dc4a4a]/8 hover:text-[#f4a0a0]'
                            : 'hover:border-[#4abb7f]/16 hover:bg-[#4abb7f]/8 hover:text-[#81d3aa]'
                        }`}
                        onClick={() => handleToggleStatus(member)}
                        loadingLabel="Updating…"
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </LoadingButton>
                    )}

                    {canDeleteStaff && (
                      <LoadingButton
                        className="inline-flex size-[34px] min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent p-0 text-[11px] font-medium text-white/60 transition-all duration-200 hover:border-[#dc4a4a]/16 hover:bg-[#dc4a4a]/8 hover:text-[#f4a0a0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985] max-md:w-full"
                        onClick={() => handleDeleteStaff(member)}
                        loadingLabel="Removing staff"
                        spinnerOnly
                        title={`Delete ${member.name}`}
                        aria-label={`Delete ${member.name}`}
                      >
                        <Trash2 size={14} />
                      </LoadingButton>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Permitted Tabs & Granular Actions */}
                <div className="flex flex-col gap-2.5 border-t border-white/[0.055] pt-3">
                  <div className="flex items-center justify-between gap-[14px] max-md:flex-col max-md:items-start">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-white/60">
                        <Lock size={13} /> Access
                      </span>
                      <span className="text-[10px] text-white/30 tabular-nums">
                        {allowed.length} {allowed.length === 1 ? 'system' : 'systems'} · {userActions.length} actions
                      </span>

                      {allowed.length === 0 ? (
                        <span className="text-[11px] text-[#df8d8d]">
                          No systems assigned
                        </span>
                      ) : (
                        <div className="ml-[3px] flex min-w-0 flex-wrap items-center gap-[5px] max-[480px]:ml-0 max-[480px]:w-full">
                          {visibleTabs.map((tabId) => {
                            const navInfo = ALL_ADMIN_NAVIGATIONS.find((n) => n.id === tabId);
                            const NavIcon = navInfo?.icon || Layers;
                            const label = navInfo?.label || tabId;
                            const tabTotalActions = (navInfo?.actions || []).length;
                            const tabEnabledActions = (navInfo?.actions || []).filter((a) =>
                              userActions.includes(a.id)
                            ).length;

                            return (
                              <span key={tabId} className="inline-flex min-h-[25px] items-center gap-[5px] rounded-[7px] border border-white/[0.065] bg-white/4 px-[7px] text-[10px] font-medium text-white/65">
                                <NavIcon className="text-[#da8a55]" size={12} />
                                <span>{label}</span>
                                <span className={`border-l border-white/10 pl-[5px] text-[9px] font-bold ${tabEnabledActions === 0 ? 'text-white/35' : 'text-[#d89a71]'}`}>
                                  {tabEnabledActions === tabTotalActions
                                    ? 'Full'
                                    : tabEnabledActions === 0
                                    ? 'View only'
                                    : `${tabEnabledActions}/${tabTotalActions}`}
                                </span>
                              </span>
                            );
                          })}
                          {hiddenTabCount > 0 && (
                            <span className="inline-flex min-h-[25px] items-center rounded-[7px] border border-dashed border-white/[0.065] px-[7px] text-[10px] font-medium text-white/35">+{hiddenTabCount} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {allowed.length > 0 && (
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-[5px] rounded-md border-0 bg-transparent py-[5px] pr-0.5 pl-2 text-[10px] font-medium text-white/45 transition-colors duration-200 hover:text-[#ffad73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f29356] active:translate-y-px active:scale-[0.985] max-md:self-end"
                        onClick={() => setExpandedDetailsId(isExpanded ? null : member.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`staff-access-${member.id}`}
                      >
                        {isExpanded ? 'Hide details' : 'Review access'}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Granular Action Details */}
                  {isExpanded && allowed.length > 0 && (
                    <div
                      id={`staff-access-${member.id}`}
                      className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2 rounded-[10px] border border-white/[0.055] bg-[#04070d]/27 p-3"
                    >
                      {allowed.map((tabId) => {
                        const navInfo = ALL_ADMIN_NAVIGATIONS.find((n) => n.id === tabId);
                        if (!navInfo) return null;
                        const actions = navInfo.actions || [];
                        const enabledForThis = actions.filter((a) => userActions.includes(a.id));

                        return (
                          <div key={tabId} className="rounded-[7px] bg-white/[0.022] px-2.5 py-[9px]">
                            <div className="mb-[7px] flex items-center gap-1.5 text-[11px] font-semibold text-[#e49a69]">
                              <navInfo.icon size={13} /> {navInfo.label}
                            </div>
                            {actions.length === 0 ? (
                              <div className="text-[10px] text-white/30">
                                No sub-actions configured.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-[5px]">
                                {actions.map((act) => {
                                  const isActEnabled = enabledForThis.some(
                                    (ea) => ea.id === act.id
                                  );
                                  return (
                                    <div
                                      key={act.id}
                                      className={`flex items-center gap-[5px] text-[10px] ${isActEnabled ? 'font-medium text-white/70 [&>svg]:text-[#66c99a]' : 'text-white/30'}`}
                                    >
                                      {isActEnabled ? <Check size={11} /> : <X size={11} />}
                                      <span>{act.label}</span>
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
              </article>
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
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close staff form"
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
                      <LoadingButton
                        type="button"
                        onClick={() => handleSendResetEmail(form.email)}
                        loading={resetSending}
                        loadingLabel="Sending link…"
                        style={{
                          ...S.btn,
                          background: 'rgba(56,189,248,0.12)',
                          border: '1px solid rgba(56,189,248,0.3)',
                          color: '#38bdf8',
                          fontSize: 12,
                          padding: '6px 12px',
                        }}
                      >
                        <Send size={12} /> Send Password Reset Email
                      </LoadingButton>
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

                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: '0 0 12px' }}>
                  Demo Scheduling and Allowances &amp; Requisitions are saved here with the other permissions. Staff need an active account and portal login to use them.
                </p>
                {modulePermissionLoading && <p role="status" style={{ color: '#d9a66a', fontSize: 12 }}>Checking demo and allowance permissions…</p>}
                {modulePermissionError && <p role="alert" style={{ color: '#fca5a5', fontSize: 12 }}>{modulePermissionError} Other staff permissions can still be edited.</p>}

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
                    const locked = !canEditModule(nav.id) || saving;
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
                            role="checkbox"
                            aria-label={nav.label}
                            aria-checked={isTabChecked}
                            aria-disabled={locked}
                            tabIndex={locked ? -1 : 0}
                            onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); handleToggleTab(nav.id); } }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              cursor: locked ? 'not-allowed' : 'pointer',
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
                                {TRUSTED_STAFF_MODULES.includes(nav.id) && !canEditModule(nav.id) && <span style={{ display: 'block', marginTop: 4, color: '#d9a66a' }}>{modulePermissionLoading ? 'Checking access…' : modulePermissionError ? 'Permission service unavailable' : 'A module administrator can edit these permissions.'}</span>}
                              </p>
                            </div>
                          </div>

                          {/* Quick Actions Toggles for this Module */}
                          {isTabChecked && actions.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleSelectAllActionsForTab(nav.id)}
                                disabled={locked}
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
                                disabled={locked}
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

                        {nav.id === 'demos' && isTabChecked && form.allowedActions.includes('demos:present') && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#ddd', marginTop: 12 }}>
                          <input type="checkbox" style={{ flexShrink: 0, marginTop: 2 }} checked={form.demoPresenterEnabled === true} disabled={locked} onChange={event => setForm(previous => ({ ...previous, demoPresenterEnabled: event.target.checked }))} />
                          <span>Available for sales bookings<small style={{ display: 'block', color: '#aaa', marginTop: 3 }}>Publish available hours in Demo Scheduling.</small></span>
                        </label>}

                        {nav.id === 'allowances' && isTabChecked && (
                          <div style={{ marginTop: 12, padding: '9px 10px', borderRadius: 8, background: 'rgba(217,166,106,0.07)', border: '1px solid rgba(217,166,106,0.18)', fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.63)' }}>
                            <strong style={{ color: '#f4c878' }}>Role guide: </strong>
                            <strong>Staff</strong> records meetings, submits liquidations, and requests replenishment.{' '}
                            <strong>Operations</strong> reviews liquidations.{' '}
                            <strong>Finance</strong> approves requests, records releases, reports, and corrections.{' '}
                            <strong>Administrator</strong> manages allowance policy and accounts.
                          </div>
                        )}

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
                              const roleBadge = ALLOWANCE_ROLE_BADGES[act.accessRole];

                              return (
                                <div
                                  key={act.id}
                                  onClick={() => handleToggleAction(act.id, nav.id)}
                                  role="checkbox"
                                  aria-label={act.label}
                                  aria-checked={isActionChecked}
                                  aria-disabled={locked}
                                  tabIndex={locked ? -1 : 0}
                                  onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); handleToggleAction(act.id, nav.id); } }}
                                  style={{
                                    background: isActionChecked
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.15)',
                                    border: isActionChecked
                                      ? `1px solid ${nav.color}50`
                                      : '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: 8,
                                    padding: '7px 10px',
                                    cursor: locked ? 'not-allowed' : 'pointer',
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
                                      {roleBadge && (
                                        <span
                                          style={{
                                            marginLeft: 'auto',
                                            padding: '1px 5px',
                                            borderRadius: 999,
                                            border: `1px solid ${roleBadge.border}`,
                                            background: roleBadge.background,
                                            color: roleBadge.color,
                                            fontSize: 9,
                                            fontWeight: 600,
                                            lineHeight: 1.4,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {act.accessRole}
                                        </span>
                                      )}
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
                <LoadingButton
                  type="submit"
                  loading={saving}
                  loadingLabel="Saving…"
                  disabled={modulePermissionLoading}
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
                  <Check size={15} />
                  {editingStaffId ? 'Save Changes' : 'Create Staff Member'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
