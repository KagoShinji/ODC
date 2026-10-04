import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import '../admin-responsive.css';
import { db, auth } from '../lib/firebase';
import { ALL_ADMIN_NAVIGATIONS, getAllActionIds, getActionsForTabs } from '../utils/navigationConfig';
import { normalizeAuthIdentifier, formatDisplayIdentifier } from '../utils/authHelpers';
import { useAllowanceContext } from '../hooks/useAllowanceContext';
import { PortalLogin } from '../components/ui/PortalLogin';
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

    const handleDelete = async () => {
        if (!window.confirm(`Delete submission from ${sub.name}?`)) return;
        setDeleting(true);
        await onDelete(sub.id);
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
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 10, padding: '7px 12px',
                                color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit',
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
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
    const superAdmin = isSuperAdminEmail(firebaseUser.email);
    const [staffProfile, setStaffProfile] = useState(null);
    const [staffLoading, setStaffLoading] = useState(true);
    const [userAllowedTabs, setUserAllowedTabs] = useState([]);
    const [userAllowedActions, setUserAllowedActions] = useState([]);
    const [activeTab, setActiveTab] = useState('contacts');

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
        : superAdmin || userAllowedTabs.includes(tab.id));

    // Ensure activeTab is always one of the permitted tabs
    useEffect(() => {
        if (!staffLoading && visibleTabs.length > 0) {
            const hasActiveTab = visibleTabs.some(t => t.id === activeTab);
            if (!hasActiveTab) {
                setActiveTab(visibleTabs[0].id);
            }
        }
    }, [visibleTabs, activeTab, staffLoading]);

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

    const hasPermission = (tabId) => tabId === 'allowances' ? superAdmin || allowanceState.context?.access?.active : superAdmin || userAllowedTabs.includes(tabId);

    // Permission checker function passed down to child components
    const can = useCallback((actionId) => {
        if (actionId?.startsWith('allowances:')) return allowanceState.context?.access?.active === true && allowanceState.context.access.actions?.includes(actionId);
        if (superAdmin) return true;
        if (!actionId) return false;
        const [tabId] = actionId.split(':');
        if (!userAllowedTabs.includes(tabId)) return false;
        if (Array.isArray(userAllowedActions) && userAllowedActions.length > 0) {
            return userAllowedActions.includes(actionId);
        }
        return true;
    }, [superAdmin, userAllowedTabs, userAllowedActions, allowanceState.context]);

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
                    maxWidth: 1200, margin: '0 auto',
                    height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
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

            {/* Dynamic Tab bar (Displays only permitted tabs) */}
            <div className="admin-tabs-wrapper" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,13,20,0.6)', backdropFilter: 'blur(10px)' }}>
                <div className="admin-tabs-container" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
                    {/* eslint-disable-next-line no-unused-vars */}
                    {visibleTabs.map(({ id, label, icon: TabIcon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7, padding: '14px 16px',
                                background: 'none', border: 'none',
                                borderBottom: `2px solid ${activeTab === id ? '#ff6a1a' : 'transparent'}`,
                                color: activeTab === id ? '#ff9a4a' : 'rgba(255,255,255,0.45)',
                                fontWeight: activeTab === id ? 600 : 400, fontSize: 14,
                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                                marginBottom: -1, whiteSpace: 'nowrap'
                            }}
                        >
                            <TabIcon size={15} />{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <main className="admin-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
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

                            <button
                                id="admin-refresh-btn"
                                onClick={() => fetchSubmissions()}
                                disabled={refreshing}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, padding: '10px 16px', color: 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 13, fontFamily: 'inherit',
                                }}
                            >
                                <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                                Refresh
                            </button>

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
                    <AdminInvoices firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
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
                    <AdminClients firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'maintenance' && hasPermission('maintenance') && (
                    <AdminMaintenance firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'inquiries' && hasPermission('inquiries') && (
                    <AdminInquiries firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'salaries' && hasPermission('salaries') && (
                    <AdminSalaries firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'domains' && hasPermission('domains') && (
                    <AdminDomains firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} />
                )}

                {activeTab === 'staff' && hasPermission('staff') && (
                    <AdminStaff firebaseUser={firebaseUser} isSuperAdmin={superAdmin} can={can} onOpenAllowances={hasPermission('allowances') ? () => setActiveTab('allowances') : undefined} />
                )}
                {activeTab === 'allowances' && hasPermission('allowances') && (
                    <AdminAllowances firebaseUser={firebaseUser} allowanceState={allowanceState} isSuperAdmin={superAdmin} />
                )}
                </Suspense>
            </main>

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
