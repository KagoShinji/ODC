import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import '../admin-responsive.css';
import { db, auth } from '../lib/firebase';
import { ALL_ADMIN_NAVIGATIONS, getAllActionIds, getActionsForTabs } from '../utils/navigationConfig';
import { normalizeAuthIdentifier, formatDisplayIdentifier } from '../utils/authHelpers';
import { useAllowanceContext } from '../hooks/useAllowanceContext';
import { useDemoContext } from '../hooks/useDemoContext';
import { PortalLogin } from '../components/ui/PortalLogin';
import { useSystemModal } from '../components/ui/SystemModalContext';
import LoadingButton from '../components/ui/LoadingButton';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
} from 'firebase/auth';
import {
    collection,
    getDocs,
    query,
    orderBy,
    where,
    deleteDoc,
    doc,
    Timestamp,
} from 'firebase/firestore';
import {
    LogOut,
    Users,
    Mail,
    Building2,
    MessageSquare,
    Trash2,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldAlert,
    Calendar,
    Globe,
    ChevronDown,
    ChevronUp,
    Download,
    Menu,
    X,
} from 'lucide-react';

const AdminInvoices = lazy(() => import('./AdminInvoices'));
const AdminMOA = lazy(() => import('./AdminMOA'));
const AdminAcceptance = lazy(() => import('./AdminAcceptance'));
const AdminTickets = lazy(() => import('./AdminTickets'));
const AdminClients = lazy(() => import('./AdminClients'));
const AdminMaintenance = lazy(() => import('./AdminMaintenance'));
const AdminInquiries = lazy(() => import('./AdminInquiries'));
const AdminInventory = lazy(() => import('./AdminInventory'));
const AdminSalaries = lazy(() => import('./AdminSalaries'));
const AdminDomains = lazy(() => import('./AdminDomains'));
const AdminStaff = lazy(() => import('./AdminStaff'));
const AdminAllowances = lazy(() => import('./AdminAllowances'));
const AdminDemos = lazy(() => import('./AdminDemos'));

/* ─── Superadmin emails (comma-separated in .env) ─── */
const SUPERADMIN_EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAIL || '')
    .split(',')
    .map((e) => normalizeAuthIdentifier(e.trim()))
    .filter(Boolean);

const isSuperAdminEmail = (email) => {
    if (!email) return false;
    const normalized = normalizeAuthIdentifier(email);
    return SUPERADMIN_EMAILS.includes(normalized) || SUPERADMIN_EMAILS.includes(email.trim().toLowerCase());
};

/* ─── Helpers ─── */
function formatDate(ts) {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function exportCSV(rows) {
    const headers = ['Name', 'Email', 'Company', 'Goal', 'Submitted At', 'Referrer', 'User Agent'];
    const lines = rows.map((r) => [
        r.name, r.email, r.company || '', r.goal,
        formatDate(r.submittedAt), r.referrer || '', r.userAgent || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odc-contacts-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ─── Shared input style ─── */
const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
};

/* ─── Login Screen ─── */
function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetNotice, setResetNotice] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResetNotice('');
        setLoading(true);
        const normalizedIdentifier = normalizeAuthIdentifier(email);
        try {
            await signInWithEmailAndPassword(auth, normalizedIdentifier, password);
        } catch (err) {
            let autoLoggedIn = false;
            // Auto-heal / sync: If user was saved in staff database with this password
            try {
                const q = query(
                    collection(db, 'staff'),
                    where('email', 'in', [normalizedIdentifier, (email || '').toLowerCase().trim()])
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const staffData = snap.docs[0].data();
                    if (staffData.status === 'active' && staffData.password && staffData.password === password) {
                        try {
                            const cred = await createUserWithEmailAndPassword(auth, normalizedIdentifier, password);
                            await updateProfile(cred.user, { displayName: staffData.name || '' });
                            autoLoggedIn = true;
                        } catch (createErr) {
                            console.warn('Auto provision notice:', createErr);
                        }
                    }
                }
            } catch (queryErr) {
                console.warn('Fallback auth check:', queryErr);
            }

            if (!autoLoggedIn) {
                const msgs = {
                    'auth/user-not-found': `No account found for "${formatDisplayIdentifier(normalizedIdentifier)}".`,
                    'auth/wrong-password': 'Incorrect password.',
                    'auth/invalid-email': 'Invalid username or email format.',
                    'auth/invalid-credential': 'Incorrect username/email or password.',
                    'auth/too-many-requests': 'Too many attempts. Try again later.',
                };
                setError(msgs[err.code] || 'Login failed. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendReset = async () => {
        const normalizedIdentifier = normalizeAuthIdentifier(email);
        if (!normalizedIdentifier) {
            setError('Please enter your username or email address first.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, normalizedIdentifier);
            setResetNotice(`Password reset email sent for ${formatDisplayIdentifier(normalizedIdentifier)}! Please check your inbox or spam folder.`);
            setError('');
        } catch (err) {
            setError(err.message || 'Failed to send password reset email.');
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <PortalLogin
                variant="admin"
                eyebrow="ODC admin"
                title="Operations access for the team behind the builds."
                subtitle="Review inquiries, manage client work, and keep support moving inside a calmer console."
                sideTitle="Admin portal"
                sideCopy="Protected sign-in for ODC internal workflows. Use your username or email."
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={handleSubmit}
                error={error}
                loading={loading}
                submitLabel="Sign in"
                loadingLabel="Signing in"
                emailPlaceholder="username or email@odc.com"
            />
            {/* Quick Password Reset Link / Notice */}
            <div style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                textAlign: 'center',
                maxWidth: 420,
                padding: '0 16px'
            }}>
                {resetNotice ? (
                    <div style={{
                        background: 'rgba(52,211,153,0.15)',
                        border: '1px solid rgba(52,211,153,0.4)',
                        color: '#34d399',
                        padding: '10px 16px',
                        borderRadius: 10,
                        fontSize: 13,
                        backdropFilter: 'blur(8px)',
                    }}>
                        {resetNotice}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleSendReset}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: 13,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontFamily: 'inherit',
                        }}
                    >
                        Forgot password or need to reset? Send reset email
                    </button>
                )}
            </div>
        </div>
    );
}

function SubmissionRow({ sub, isSuperAdmin, canDelete, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const modal = useSystemModal();

    const handleDelete = async () => {
        const confirmed = await modal.confirm({
            title: 'Delete contact submission?',
            message: `The submission from ${sub.name} will be permanently removed.`,
            confirmLabel: 'Delete submission',
        });
        if (!confirmed) return;
        setDeleting(true);
        try {
            await onDelete(sub.id);
            modal.success({ title: 'Submission deleted', message: `The submission from ${sub.name} was removed.` });
        } catch (error) {
            console.error('Error deleting submission:', error);
            setDeleting(false);
            modal.error('We could not delete the submission. Please try again.');
        }
    };

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '20px 24px',
            opacity: deleting ? 0.4 : 1,
            transition: 'opacity 0.3s',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(255,106,26,0.3), rgba(255,106,26,0.1))',
                    border: '1px solid rgba(255,106,26,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ff6a1a', fontWeight: 700, fontSize: 17,
                }}>
                    {(sub.name || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{sub.name}</span>
                        {sub.company && (
                            <span style={{
                                background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                                padding: '2px 8px', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500,
                            }}>{sub.company}</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Mail size={12} color="rgba(255,255,255,0.4)" />
                        <span style={{ color: '#ff6a1a', fontSize: 13 }}>{formatDisplayIdentifier(sub.email)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Calendar size={12} color="rgba(255,255,255,0.4)" />
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(sub.submittedAt)}</span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        style={{
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '7px 12px',
                            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit',
                        }}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expanded ? 'Less' : 'More'}
                    </button>
                    {canDelete && (
                        <LoadingButton
                            onClick={handleDelete}
                            loading={deleting}
                            loadingLabel="Deleting…"
                            style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 10, padding: '7px 12px',
                                color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit',
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </LoadingButton>
                    )}
                </div>
            </div>

            {/* Goal */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Goal:{' '}
                    </span>
                    {sub.goal}
                </p>
            </div>

            {/* Expanded metadata — superadmin only */}
            {expanded && isSuperAdmin && (
                <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                    {sub.referrer && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <Globe size={12} color="rgba(255,255,255,0.3)" style={{ marginTop: 2 }} />
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, wordBreak: 'break-all' }}>
                                <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Referrer:</strong> {sub.referrer}
                            </span>
                        </div>
                    )}
                    {sub.userAgent && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <Globe size={12} color="rgba(255,255,255,0.3)" style={{ marginTop: 2 }} />
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, wordBreak: 'break-all' }}>
                                <strong style={{ color: 'rgba(255,255,255,0.45)' }}>User Agent:</strong> {sub.userAgent}
                            </span>
                        </div>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                        <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Doc ID:</strong> {sub.id}
                    </span>
                </div>
            )}
        </div>
    );
}

/* ─── Main Admin Dashboard ─── */
function AdminDashboard({ firebaseUser }) {
    const allowanceState = useAllowanceContext(firebaseUser.uid);
    const demoState = useDemoContext(firebaseUser.uid);
    const superAdmin = isSuperAdminEmail(firebaseUser.email);
    const [staffProfile, setStaffProfile] = useState(null);
    const [staffLoading, setStaffLoading] = useState(true);
    const [userAllowedTabs, setUserAllowedTabs] = useState([]);
    const [userAllowedActions, setUserAllowedActions] = useState([]);
    const [activeTab, setActiveTab] = useState('contacts');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [expandedSystems, setExpandedSystems] = useState([]);
    const [activeSubTabs, setActiveSubTabs] = useState({
        demos: 'calendar',
        allowances: 'overview',
        invoices: 'invoices',
        clients: 'masterlist',
        salaries: 'payroll',
    });

    // Contacts data state
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // 1. Resolve Staff Permissions from Firestore
    useEffect(() => {
        let isMounted = true;
        const resolvePermissions = async () => {
            if (superAdmin) {
                if (isMounted) {
                    setStaffProfile({ role: 'Superadmin', name: 'Superadmin', status: 'active' });
                    setUserAllowedTabs(ALL_ADMIN_NAVIGATIONS.map(t => t.id));
                    setUserAllowedActions(getAllActionIds());
                    setStaffLoading(false);
                }
                return;
            }

            try {
                const normalized = normalizeAuthIdentifier(firebaseUser.email);
                const rawEmail = (firebaseUser.email || '').toLowerCase();
                const displayUser = formatDisplayIdentifier(normalized).toLowerCase();

                // Check staff matching email or username
                const q = query(collection(db, 'staff'), where('email', 'in', [normalized, rawEmail]));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    if (isMounted) {
                        setStaffProfile(data);
                        if (data.status === 'active') {
                            const tabs = Array.isArray(data.allowedTabs) ? data.allowedTabs : ['contacts'];
                            const actions = Array.isArray(data.allowedActions)
                                ? data.allowedActions
                                : getActionsForTabs(tabs);
                            setUserAllowedTabs(tabs);
                            setUserAllowedActions(actions);
                        } else {
                            setUserAllowedTabs([]);
                            setUserAllowedActions([]);
                        }
                    }
                } else {
                    // Fallback search by name/displayUsername
                    const qAll = query(collection(db, 'staff'));
                    const snapAll = await getDocs(qAll);
                    const match = snapAll.docs.find(d => {
                        const dat = d.data();
                        return (
                            (dat.email && (dat.email.toLowerCase() === normalized || dat.email.toLowerCase() === rawEmail)) ||
                            (dat.displayUsername && dat.displayUsername.toLowerCase() === displayUser)
                        );
                    });

                    if (match && isMounted) {
                        const data = match.data();
                        setStaffProfile(data);
                        if (data.status === 'active') {
                            const tabs = Array.isArray(data.allowedTabs) ? data.allowedTabs : ['contacts'];
                            const actions = Array.isArray(data.allowedActions)
                                ? data.allowedActions
                                : getActionsForTabs(tabs);
                            setUserAllowedTabs(tabs);
                            setUserAllowedActions(actions);
                        } else {
                            setUserAllowedTabs([]);
                            setUserAllowedActions([]);
                        }
                    } else if (isMounted) {
                        setStaffProfile(null);
                        setUserAllowedTabs(['contacts']);
                        setUserAllowedActions(getActionsForTabs(['contacts']));
                    }
                }
            } catch (err) {
                console.error('Error fetching staff profile:', err);
                if (isMounted) {
                    setUserAllowedTabs(['contacts']);
                    setUserAllowedActions(getActionsForTabs(['contacts']));
                }
            } finally {
                if (isMounted) setStaffLoading(false);
            }
        };

        resolvePermissions();
        return () => { isMounted = false; };
    }, [firebaseUser.email, superAdmin]);

    // Calculate visible navigation tabs for current user
    const visibleTabs = ALL_ADMIN_NAVIGATIONS.filter(tab => tab.id === 'allowances'
        ? superAdmin || allowanceState.context?.access?.active
        : tab.id === 'demos' ? superAdmin || demoState.context?.access?.active
        : superAdmin || userAllowedTabs.includes(tab.id));
    const activeSystemHasSubTabs = visibleTabs.some(tab =>
        tab.id === activeTab && tab.subTabs?.length > 0);

    // Ensure activeTab is always one of the permitted tabs
    useEffect(() => {
        if (!staffLoading && visibleTabs.length > 0) {
            const hasActiveTab = visibleTabs.some(t => t.id === activeTab);
            if (!hasActiveTab) {
                setActiveTab(visibleTabs[0].id);
            }
        }
    }, [visibleTabs, activeTab, staffLoading]);

    useEffect(() => {
        if (activeSystemHasSubTabs) {
            setExpandedSystems(current => current.includes(activeTab) ? current : [...current, activeTab]);
        }
    }, [activeTab, activeSystemHasSubTabs]);

    const selectSystem = (id, hasSubTabs = false) => {
        setActiveTab(id);
        if (hasSubTabs) {
            setExpandedSystems(current => current.includes(id) ? current : [...current, id]);
        } else {
            setSidebarOpen(false);
        }
    };

    const toggleSystem = (id) => {
        setExpandedSystems(current => current.includes(id)
            ? current.filter(systemId => systemId !== id)
            : [...current, id]);
    };

    const selectSubSystem = (systemId, subTabId) => {
        setActiveTab(systemId);
        setActiveSubTabs(current => ({ ...current, [systemId]: subTabId }));
        setExpandedSystems(current => current.includes(systemId) ? current : [...current, systemId]);
        setSidebarOpen(false);
    };

    const syncSubSystem = (systemId, subTabId) => {
        setActiveSubTabs(current => current[systemId] === subTabId
            ? current
            : { ...current, [systemId]: subTabId });
    };

    // Fetch Contact Submissions
    const fetchSubmissions = useCallback(async (showSpinner = true) => {
        if (showSpinner) setRefreshing(true);
        try {
            const q = query(collection(db, 'contactSubmissions'), orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);
            setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Firestore read error:', err);
        } finally {
            setLoadingSubmissions(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (superAdmin || userAllowedTabs.includes('contacts')) {
            fetchSubmissions(false);
        }
    }, [fetchSubmissions, superAdmin, userAllowedTabs]);

    const handleDelete = async (id) => {
        await deleteDoc(doc(db, 'contactSubmissions', id));
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
    };

    const handleLogout = () => signOut(auth);

    const filtered = submissions.filter((s) => {
        const q = search.toLowerCase();
        return (
            s.name?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q) ||
            s.company?.toLowerCase().includes(q) ||
            s.goal?.toLowerCase().includes(q)
        );
    });

    const hasPermission = (tabId) => tabId === 'allowances' ? superAdmin || allowanceState.context?.access?.active : tabId === 'demos' ? superAdmin || demoState.context?.access?.active : superAdmin || userAllowedTabs.includes(tabId);

    // Permission checker function passed down to child components
    const can = useCallback((actionId) => {
        if (actionId?.startsWith('demos:')) return demoState.context?.access?.active === true && demoState.context.access.actions?.includes(actionId) && (actionId !== 'demos:present' || demoState.context.access.presenterEnabled);
        if (actionId?.startsWith('allowances:')) return allowanceState.context?.access?.active === true && allowanceState.context.access.actions?.includes(actionId);
        if (superAdmin) return true;
        if (!actionId) return false;
        const [tabId] = actionId.split(':');
        if (!userAllowedTabs.includes(tabId)) return false;
        if (Array.isArray(userAllowedActions) && userAllowedActions.length > 0) {
            return userAllowedActions.includes(actionId);
        }
        return true;
    }, [superAdmin, userAllowedTabs, userAllowedActions, allowanceState.context, demoState.context]);

    const visibleSubTabs = (tab) => (tab.subTabs || []).filter(subTab =>
        !subTab.requiresAction || can(subTab.requiresAction));

    // If still resolving staff permissions
    if (staffLoading) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0a0d14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                color: '#fff'
            }}>
                <RefreshCw size={32} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // If inactive account or no permissions granted
    if (!superAdmin && visibleTabs.length === 0) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0a0d14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                padding: 24,
                color: '#fff'
            }}>
                <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 20,
                    padding: '40px 32px',
                    maxWidth: 460,
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#f87171', margin: '0 auto 20px'
                    }}>
                        <ShieldAlert size={28} />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
                        {staffProfile?.status === 'inactive' ? 'Account Suspended' : 'Access Restricted'}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
                        {staffProfile?.status === 'inactive'
                            ? 'Your staff account is currently marked as inactive. Please reach out to an administrator to reactivate your access.'
                            : `The account (${formatDisplayIdentifier(firebaseUser.email)}) does not currently have permissions for any system navigations. Please contact a superadmin to configure your access.`}
                    </p>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 12,
                            padding: '12px 24px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'inherit',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <LogOut size={16} /> Sign out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh', background: '#0a0d14',
            fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#fff',
        }}>
            {/* Sticky topbar */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(10,13,20,0.85)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                padding: '0 24px',
            }}>
                <div className="admin-header" style={{
                    width: '100%', margin: '0 auto',
                    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <button
                            type="button"
                            className="admin-nav-toggle"
                            onClick={() => setSidebarOpen((open) => !open)}
                            aria-label={sidebarOpen ? 'Close systems navigation' : 'Open systems navigation'}
                            aria-expanded={sidebarOpen}
                            aria-controls="admin-system-navigation"
                        >
                            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(255,106,26,0.35)',
                        }}>
                            <ShieldCheck size={18} color="#fff" />
                        </div>
                        <div>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>ODC Admin</span>
                            <span style={{
                                marginLeft: 10, fontSize: 11, fontWeight: 600,
                                background: superAdmin
                                    ? 'linear-gradient(90deg,rgba(255,106,26,0.2),rgba(255,154,74,0.2))'
                                    : 'rgba(255,255,255,0.07)',
                                border: `1px solid ${superAdmin ? 'rgba(255,106,26,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 6, padding: '2px 8px',
                                color: superAdmin ? '#ff9a4a' : 'rgba(255,255,255,0.5)',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                {superAdmin ? '⚡ Superadmin' : (staffProfile?.role || 'Staff')}
                            </span>
                        </div>
                    </div>

                    <div className="admin-account" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="admin-account-email" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                            {formatDisplayIdentifier(firebaseUser.email)}
                        </span>
                        <button
                            id="admin-logout-btn"
                            onClick={handleLogout}
                            style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10, padding: '7px 14px', color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 13, fontFamily: 'inherit',
                            }}
                        >
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="admin-shell">
                <button
                    type="button"
                    className={`admin-sidebar-scrim ${sidebarOpen ? 'is-open' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close systems navigation"
                    tabIndex={sidebarOpen ? 0 : -1}
                />

                <aside
                    id="admin-system-navigation"
                    className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}
                    aria-label="Systems navigation"
                >
                    <div className="admin-sidebar-heading">
                        <div>
                            <span className="admin-sidebar-eyebrow">Workspace</span>
                            <h2>Systems</h2>
                        </div>
                        <span className="admin-sidebar-count" aria-label={`${visibleTabs.length} available systems`}>
                            {visibleTabs.length}
                        </span>
                    </div>

                    <nav className="admin-sidebar-nav">
                        {visibleTabs.map((tab) => {
                            const { id, label, icon: TabIcon } = tab;
                            const selected = activeTab === id;
                            const subTabs = visibleSubTabs(tab);
                            const hasSubTabs = subTabs.length > 0;
                            const expanded = hasSubTabs && expandedSystems.includes(id);
                            return (
                                <div className={`admin-sidebar-item ${hasSubTabs ? 'has-children' : ''}`} key={id}>
                                    <div className="admin-sidebar-row">
                                        <button
                                            type="button"
                                            className={`admin-sidebar-link ${selected ? 'is-active' : ''}`}
                                            onClick={() => selectSystem(id, hasSubTabs)}
                                            aria-current={selected ? 'page' : undefined}
                                        >
                                            <span className="admin-sidebar-icon"><TabIcon size={17} /></span>
                                            <span>{label}</span>
                                            {id === 'demos' && demoState.unread > 0 && <span aria-label={`${demoState.unread} unread scheduling notifications`} style={{ color: '#d9a66a', fontSize: 11 }}>{demoState.unread}</span>}
                                            <span className="admin-sidebar-indicator" aria-hidden="true" />
                                        </button>
                                        {hasSubTabs && (
                                            <button
                                                type="button"
                                                className="admin-sidebar-expander"
                                                onClick={() => toggleSystem(id)}
                                                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label} sections`}
                                                aria-expanded={expanded}
                                                aria-controls={`admin-subnav-${id}`}
                                            >
                                                <ChevronDown size={15} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>

                                    {hasSubTabs && (
                                        <div
                                            id={`admin-subnav-${id}`}
                                            className={`admin-sidebar-subnav ${expanded ? 'is-open' : ''}`}
                                            aria-hidden={!expanded}
                                        >
                                            <div className="admin-sidebar-subnav-inner">
                                                {subTabs.map(subTab => {
                                                    const subSelected = selected && activeSubTabs[id] === subTab.id;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={subTab.id}
                                                            className={`admin-sidebar-sublink ${subSelected ? 'is-active' : ''}`}
                                                            onClick={() => selectSubSystem(id, subTab.id)}
                                                            aria-current={subSelected ? 'page' : undefined}
                                                            tabIndex={expanded ? 0 : -1}
                                                        >
                                                            <span aria-hidden="true" />
                                                            {subTab.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    <div className="admin-sidebar-footer">
                        <span>Signed in as</span>
                        <strong>{formatDisplayIdentifier(firebaseUser.email)}</strong>
                    </div>
                </aside>

                {/* Main content */}
                <main className="admin-main">
                <Suspense key={activeTab} fallback={<p role="status">Loading module…</p>}>

                {activeTab === 'contacts' && hasPermission('contacts') && (
                    <>
                        {/* Stats */}
                        <div className="admin-metrics-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 16, marginBottom: 32,
                        }}>
                            {[
                                { label: 'Total Submissions', value: submissions.length, icon: Users, color: '#ff6a1a' },
                                { label: 'Search Results', value: filtered.length, icon: Search, color: '#60a5fa' },
                                {
                                    label: 'Unique Companies',
                                    value: new Set(submissions.map((s) => s.company).filter(Boolean)).size,
                                    icon: Building2, color: '#34d399',
                                },
                            // eslint-disable-next-line no-unused-vars
                            ].map(({ label, value, icon: StatIcon, color }) => (
                                <div key={label} style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 16, padding: '20px 24px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <StatIcon size={16} color={color} />
                                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>{label}</span>
                                    </div>
                                    <span style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="admin-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                                <Search size={15} color="rgba(255,255,255,0.3)" style={{
                                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                }} />
                                <input
                                    id="admin-search"
                                    type="text"
                                    placeholder="Search by name, email, company, or goal…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{
                                        ...inputStyle,
                                        padding: '11px 14px 11px 40px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 12,
                                    }}
                                />
                            </div>

                            <LoadingButton
                                id="admin-refresh-btn"
                                onClick={() => fetchSubmissions()}
                                loading={refreshing}
                                loadingLabel="Refreshing…"
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, padding: '10px 16px', color: 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 13, fontFamily: 'inherit',
                                }}
                            >
                                <RefreshCw size={14} />
                                Refresh
                            </LoadingButton>

                            {can('contacts:export') && submissions.length > 0 && (
                                <button
                                    id="admin-export-btn"
                                    onClick={() => exportCSV(filtered.length > 0 ? filtered : submissions)}
                                    style={{
                                        background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.3)',
                                        borderRadius: 12, padding: '10px 16px', color: '#ff9a4a',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        fontSize: 13, fontFamily: 'inherit',
                                    }}
                                >
                                    <Download size={14} /> Export CSV
                                </button>
                            )}
                        </div>

                        {/* Submissions list */}
                        {loadingSubmissions ? (
                            <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
                                <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                                <p>Loading submissions…</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                                <MessageSquare size={48} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 16px' }} />
                                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                                    {search ? 'No results match your search.' : 'No contact submissions yet.'}
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {filtered.map((sub) => (
                                    <SubmissionRow
                                        key={sub.id}
                                        sub={sub}
                                        isSuperAdmin={superAdmin}
                                        canDelete={can('contacts:delete')}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'inventory' && hasPermission('inventory') && (
                    <AdminInventory firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'invoices' && hasPermission('invoices') && (
                    <AdminInvoices firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} initialSubTab={activeSubTabs.invoices} onSubTabChange={(id) => syncSubSystem('invoices', id)} />
                )}

                {activeTab === 'moa' && hasPermission('moa') && (
                    <AdminMOA firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'acceptance' && hasPermission('acceptance') && (
                    <AdminAcceptance firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'tickets' && hasPermission('tickets') && (
                    <AdminTickets firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'clients' && hasPermission('clients') && (
                    <AdminClients firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} initialSubTab={activeSubTabs.clients} onSubTabChange={(id) => syncSubSystem('clients', id)} />
                )}

                {activeTab === 'maintenance' && hasPermission('maintenance') && (
                    <AdminMaintenance firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'inquiries' && hasPermission('inquiries') && (
                    <AdminInquiries firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'salaries' && hasPermission('salaries') && (
                    <AdminSalaries firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} initialSubTab={activeSubTabs.salaries} onSubTabChange={(id) => syncSubSystem('salaries', id)} />
                )}

                {activeTab === 'domains' && hasPermission('domains') && (
                    <AdminDomains firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'staff' && hasPermission('staff') && (
                    <AdminStaff firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} onOpenAllowances={hasPermission('allowances') ? () => selectSubSystem('allowances', 'overview') : undefined} onOpenDemos={hasPermission('demos') ? () => selectSubSystem('demos', 'settings') : undefined} />
                )}
                {activeTab === 'allowances' && hasPermission('allowances') && (
                    <AdminAllowances firebaseUser={firebaseUser} allowanceState={allowanceState} isSuperAdmin={superAdmin} initialSection={activeSubTabs.allowances} onSectionChange={(id) => syncSubSystem('allowances', id)} onOpenStaff={hasPermission('staff') ? () => selectSystem('staff') : undefined} />
                )}
                {activeTab === 'demos' && hasPermission('demos') && (
                    <AdminDemos firebaseUser={firebaseUser} demoState={demoState} initialSection={activeSubTabs.demos} onSectionChange={(id) => syncSubSystem('demos', id)} onOpenStaff={hasPermission('staff') ? () => selectSystem('staff') : undefined} />
                )}
                </Suspense>
                </main>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

/* ─── Root: listens to Firebase Auth state ─── */
export default function AdminPage() {
    const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = checking

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setFirebaseUser(u ?? null));
        return unsubscribe;
    }, []);

    // Still resolving auth state
    if (firebaseUser === undefined) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0a0d14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}>
                <RefreshCw size={32} color="rgba(255,255,255,0.3)"
                    style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!firebaseUser) return <LoginScreen />;
    return <AdminDashboard firebaseUser={firebaseUser} />;
}
