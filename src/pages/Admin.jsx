import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import AdminInvoices from './AdminInvoices';
import AdminMOA from './AdminMOA';
import AdminAcceptance from './AdminAcceptance';
import AdminTickets from './AdminTickets';
import AdminClients from './AdminClients';
import AdminMaintenance from './AdminMaintenance';
import AdminInquiries from './AdminInquiries';
import AdminInventory from './AdminInventory';
import { PortalLogin } from '../components/ui/PortalLogin';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import {
    collection,
    getDocs,
    query,
    orderBy,
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
    Calendar,
    Globe,
    ChevronDown,
    ChevronUp,
    Download,
    FileText,
    LayoutList,
    FileSignature,
    Hammer,
    Settings,
    MailSearch,
    TrendingUp,
    Package,
    Award,
} from 'lucide-react';

/* ─── Superadmin emails (comma-separated in .env) ─── */
const SUPERADMIN_EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isSuperAdminEmail = (email) =>
    SUPERADMIN_EMAILS.includes((email || '').toLowerCase());

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

/* ─── Shared input style (inline, no Tailwind needed) ─── */
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged in the parent will handle the transition
        } catch (err) {
            const msgs = {
                'auth/user-not-found': 'No account found with that email.',
                'auth/wrong-password': 'Incorrect password.',
                'auth/invalid-email': 'Please enter a valid email address.',
                'auth/invalid-credential': 'Incorrect email or password.',
                'auth/too-many-requests': 'Too many attempts. Try again later.',
            };
            setError(msgs[err.code] || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PortalLogin
            variant="admin"
            eyebrow="ODC admin"
            title="Operations access for the team behind the builds."
            subtitle="Review inquiries, manage client work, and keep support moving inside a calmer console."
            sideTitle="Admin portal"
            sideCopy="Protected Firebase sign-in for ODC internal workflows."
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
            error={error}
            loading={loading}
            submitLabel="Sign in"
            loadingLabel="Signing in"
            emailPlaceholder="admin@odc.com"
        />
    );
}

function SubmissionRow({ sub, isSuperAdmin, onDelete }) {
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
                        <span style={{ color: '#ff6a1a', fontSize: 13 }}>{sub.email}</span>
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
                    {isSuperAdmin && (
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
    const superAdmin = isSuperAdminEmail(firebaseUser.email);
    const [activeTab, setActiveTab] = useState('contacts');
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const fetchSubmissions = useCallback(async (showSpinner = true) => {
        if (showSpinner) setRefreshing(true);
        try {
            const q = query(collection(db, 'contactSubmissions'), orderBy('submittedAt', 'desc'));
            const snap = await getDocs(q);
            setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Firestore read error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchSubmissions(false); }, [fetchSubmissions]);

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
                <div style={{
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
                                {superAdmin ? '⚡ Superadmin' : 'Admin'}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                            {firebaseUser.email}
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

            {/* Tab bar */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,13,20,0.6)', backdropFilter: 'blur(10px)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4 }}>
                    {[
                      { id: 'contacts', label: 'Contacts', Icon: LayoutList }, 
                      ...(superAdmin ? [
                        { id: 'inventory', label: 'Inventory', Icon: Package },
                        { id: 'invoices', label: 'Invoices & Finance', Icon: TrendingUp }, 
                        { id: 'moa', label: 'MOA', Icon: FileSignature }, 
                        { id: 'acceptance', label: 'Acceptance', Icon: Award }, 
                        { id: 'tickets', label: 'Tickets', Icon: MessageSquare }, 
                        { id: 'clients', label: 'Clients', Icon: Users },
                        { id: 'maintenance', label: 'Maintenance', Icon: Hammer },
                        { id: 'inquiries', label: 'Inquiries', Icon: MailSearch }
                      ] : [])
                    // eslint-disable-next-line no-unused-vars
                    ].map(({ id, label, Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === id ? '#ff6a1a' : 'transparent'}`, color: activeTab === id ? '#ff9a4a' : 'rgba(255,255,255,0.45)', fontWeight: activeTab === id ? 600 : 400, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', marginBottom: -1 }}>
                            <Icon size={15} />{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

                {activeTab === 'contacts' && <>
                {/* Stats */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 16, marginBottom: 32,
                }}>
                    {[
                        { label: 'Total Submissions', value: submissions.length, Icon: Users, color: '#ff6a1a' },
                        { label: 'Search Results', value: filtered.length, Icon: Search, color: '#60a5fa' },
                        {
                            label: 'Unique Companies',
                            value: new Set(submissions.map((s) => s.company).filter(Boolean)).size,
                            Icon: Building2, color: '#34d399',
                        },
                    // eslint-disable-next-line no-unused-vars
                    ].map(({ label, value, Icon, color }) => (
                        <div key={label} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16, padding: '20px 24px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <Icon size={16} color={color} />
                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>{label}</span>
                            </div>
                            <span style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{value}</span>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
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

                    {superAdmin && submissions.length > 0 && (
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
                {loading ? (
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
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
                </> }

                {activeTab === 'inventory' && superAdmin && (
                    <AdminInventory firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'invoices' && superAdmin && (
                    <AdminInvoices firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'moa' && superAdmin && (
                    <AdminMOA firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'acceptance' && superAdmin && (
                    <AdminAcceptance firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'tickets' && superAdmin && (
                    <AdminTickets firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'clients' && superAdmin && (
                    <AdminClients firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'maintenance' && superAdmin && (
                    <AdminMaintenance firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}

                {activeTab === 'inquiries' && superAdmin && (
                    <AdminInquiries firebaseUser={firebaseUser} isSuperAdmin={superAdmin} />
                )}
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
