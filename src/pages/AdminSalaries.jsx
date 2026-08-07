import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
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
  Wallet,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Info,
  DollarSign,
  Briefcase,
  Layers,
  Search,
  X,
  CreditCard,
  Clock,
} from 'lucide-react';

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MONTHS_LIST = (() => {
  const list = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const val = `${year}-${month}`; // YYYY-MM
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    list.push({ val, label });
  }
  return list;
})();

export default function AdminSalaries({ firebaseUser, isSuperAdmin }) {
  const [activeSubTab, setActiveSubTab] = useState('payroll'); // 'payroll' | 'roster' | 'history'
  
  // Data State
  const [staff, setStaff] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Selected Month for Payroll
  const [selectedMonth, setSelectedMonth] = useState(MONTHS_LIST[0].val);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Staff Modal / Sidebar State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffEditingId, setStaffEditingId] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    monthlySalary: '',
    status: 'active',
    startDate: today(),
  });
  
  // Payment Modal / Sidebar State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingStaff, setPayingStaff] = useState(null);
  const [payForm, setPayForm] = useState({
    baseSalary: 0,
    bonus: 0,
    deductions: 0,
    netPaid: 0,
    paidAt: today(),
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [modalAlert, setModalAlert] = useState(null);

  // Load Data from Firestore
  const loadData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setRefreshing(true);
    try {
      const qStaff = query(collection(db, 'staff'), orderBy('name', 'asc'));
      const qPayouts = query(collection(db, 'salaryPayouts'), orderBy('createdAt', 'desc'));
      
      const [snapStaff, snapPayouts] = await Promise.all([
        getDocs(qStaff),
        getDocs(qPayouts)
      ]);
      
      setStaff(snapStaff.docs.map(d => ({ id: d.id, ...d.data() })));
      setPayouts(snapPayouts.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching staff/payout data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Recalculate net payment whenever base, bonus, or deductions change
  useEffect(() => {
    const base = Number(payForm.baseSalary || 0);
    const bonus = Number(payForm.bonus || 0);
    const ded = Number(payForm.deductions || 0);
    setPayForm(prev => ({
      ...prev,
      netPaid: Math.max(0, base + bonus - ded)
    }));
  }, [payForm.baseSalary, payForm.bonus, payForm.deductions]);

  // Staff CRUD Handlers
  const handleOpenCreateStaff = () => {
    setStaffEditingId(null);
    setStaffForm({
      name: '',
      role: '',
      email: '',
      phone: '',
      monthlySalary: '',
      status: 'active',
      startDate: today(),
    });
    setModalAlert(null);
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (member) => {
    setStaffEditingId(member.id);
    setStaffForm({
      name: member.name || '',
      role: member.role || '',
      email: member.email || '',
      phone: member.phone || '',
      monthlySalary: member.monthlySalary || '',
      status: member.status || 'active',
      startDate: member.startDate || today(),
    });
    setModalAlert(null);
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.role.trim() || !staffForm.monthlySalary) {
      setModalAlert('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    const payload = {
      name: staffForm.name.trim(),
      role: staffForm.role.trim(),
      email: staffForm.email.trim(),
      phone: staffForm.phone.trim(),
      monthlySalary: Number(staffForm.monthlySalary),
      status: staffForm.status,
      startDate: staffForm.startDate,
      updatedAt: serverTimestamp(),
    };

    try {
      if (staffEditingId) {
        await updateDoc(doc(db, 'staff', staffEditingId), payload);
      } else {
        await addDoc(collection(db, 'staff'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
      }
      setShowStaffModal(false);
      loadData(false);
    } catch (err) {
      console.error('Error saving staff:', err);
      setModalAlert('Failed to save staff member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`Are you sure you want to delete ${member.name}? This will remove them from the active list, but historical payouts remain.`)) return;
    try {
      await deleteDoc(doc(db, 'staff', member.id));
      loadData(false);
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Failed to delete staff member.');
    }
  };

  // Payment Handlers
  const handleOpenPayModal = (member) => {
    setPayingStaff(member);
    const monthLabel = MONTHS_LIST.find(m => m.val === selectedMonth)?.label || selectedMonth;
    setPayForm({
      baseSalary: member.monthlySalary || 0,
      bonus: 0,
      deductions: 0,
      netPaid: member.monthlySalary || 0,
      paidAt: today(),
      paymentMethod: 'Bank Transfer',
      referenceNumber: '',
      notes: `Salary payout for ${member.name} for ${monthLabel}`,
    });
    setModalAlert(null);
    setShowPayModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payingStaff) return;
    setSaving(true);

    try {
      // 1. Create a corresponding expense record
      const expensePayload = {
        title: `Salary Payout - ${payingStaff.name} (${selectedMonth})`,
        category: 'Salaries',
        amount: Number(payForm.netPaid),
        date: payForm.paidAt,
        payee: payingStaff.name,
        referenceNumber: payForm.referenceNumber.trim(),
        status: 'paid',
        notes: payForm.notes.trim() || `Salary payout for ${payingStaff.name} (${selectedMonth})`,
        source: 'salary_tracker',
        updatedAt: serverTimestamp(),
      };

      const expenseDocRef = await addDoc(collection(db, 'expenses'), {
        ...expensePayload,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.email,
      });

      // 2. Create the salary payout record with link to expense doc
      const payoutPayload = {
        staffId: payingStaff.id,
        staffName: payingStaff.name,
        role: payingStaff.role,
        baseSalary: Number(payForm.baseSalary),
        bonus: Number(payForm.bonus),
        deductions: Number(payForm.deductions),
        netPaid: Number(payForm.netPaid),
        month: selectedMonth,
        paidAt: payForm.paidAt,
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber.trim(),
        notes: payForm.notes.trim(),
        expenseId: expenseDocRef.id,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.email,
      };

      await addDoc(collection(db, 'salaryPayouts'), payoutPayload);

      setShowPayModal(false);
      setPayingStaff(null);
      loadData(false);
    } catch (err) {
      console.error('Error recording salary payment:', err);
      setModalAlert('Failed to record payment. Please check your network and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayout = async (payout) => {
    const confirmation = window.confirm(
      `Are you sure you want to delete and roll back this payment of ₱${fmt(payout.netPaid)} to ${payout.staffName}? This will also delete the linked expense and reflect in your analytics.`
    );
    if (!confirmation) return;

    try {
      // 1. Delete linked expense if it exists
      if (payout.expenseId) {
        try {
          await deleteDoc(doc(db, 'expenses', payout.expenseId));
        } catch (expErr) {
          console.warn('Linked expense doc not found or already deleted:', expErr);
        }
      }
      // 2. Delete payout doc
      await deleteDoc(doc(db, 'salaryPayouts', payout.id));
      loadData(false);
    } catch (err) {
      console.error('Error deleting payout:', err);
      alert('Failed to delete payout record.');
    }
  };

  const getDueDay = (startDateStr) => {
    if (!startDateStr) return 1;
    const parts = startDateStr.split('-');
    if (parts.length < 3) return 1;
    return Number(parts[2]);
  };

  const isEligibleForMonth = (member, selMonth) => {
    if (!member.startDate) return true;
    const startYM = member.startDate.substring(0, 7); // YYYY-MM
    return selMonth >= startYM; // Keep them eligible for the month they start or after
  };

  const getPaymentStatus = (member, selMonth) => {
    const payout = monthlyPayouts.find(p => p.staffId === member.id);
    if (payout) {
      return { 
        isPaid: true, 
        label: `Paid ₱${fmt(payout.netPaid)}`, 
        badgeBg: 'rgba(52,211,153,0.12)', 
        badgeColor: '#34d399', 
        isUpcoming: false, 
        payout 
      };
    }

    const startYM = member.startDate ? member.startDate.substring(0, 7) : '';
    const dueDay = getDueDay(member.startDate);
    const now = new Date();
    const currentYM = today().substring(0, 7);
    
    let label = 'Unpaid';
    let badgeBg = 'rgba(239,68,68,0.12)';
    let badgeColor = '#f87171';
    let isUpcoming = false;

    // Check if the selected month is the same month as their start date
    if (selMonth === startYM) {
      // Since they started on e.g. July 24, their first pay period isn't complete until August 24.
      // So they have NO payment due in the month of their start date.
      return {
        isPaid: false,
        label: 'Not Due (First Payout in next month)',
        badgeBg: 'rgba(255,255,255,0.06)',
        badgeColor: 'rgba(255,255,255,0.4)',
        isUpcoming: true
      };
    }

    if (selMonth === currentYM) {
      const todayDay = now.getDate();
      if (todayDay < dueDay) {
        const [year, month] = selMonth.split('-');
        const tempD = new Date(Number(year), Number(month) - 1, 1);
        const monthAbbr = tempD.toLocaleDateString('en-US', { month: 'short' });
        label = `Pending (Due ${monthAbbr} ${dueDay})`;
        badgeBg = 'rgba(251,191,36,0.12)';
        badgeColor = '#fbbf24';
        isUpcoming = true;
      } else {
        const [year, month] = selMonth.split('-');
        const tempD = new Date(Number(year), Number(month) - 1, 1);
        const monthAbbr = tempD.toLocaleDateString('en-US', { month: 'short' });
        label = `Overdue (Due ${monthAbbr} ${dueDay})`;
      }
    } else if (selMonth > currentYM) {
      const [year, month] = selMonth.split('-');
      const tempD = new Date(Number(year), Number(month) - 1, 1);
      const monthAbbr = tempD.toLocaleDateString('en-US', { month: 'short' });
      label = `Upcoming (Due ${monthAbbr} ${dueDay})`;
      badgeBg = 'rgba(251,191,36,0.08)';
      badgeColor = '#fbbf24';
      isUpcoming = true;
    } else {
      label = 'Unpaid (Overdue)';
    }

    return { isPaid: false, label, badgeBg, badgeColor, isUpcoming };
  };

  // Filtered Roster
  const filteredRoster = staff.filter(member => {
    const queryStr = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(queryStr) ||
      member.role?.toLowerCase().includes(queryStr) ||
      member.email?.toLowerCase().includes(queryStr)
    );
  });

  // Calculate Metrics for selectedMonth
  const activeStaff = staff.filter(s => s.status === 'active');
  const eligibleStaff = activeStaff.filter(member => isEligibleForMonth(member, selectedMonth));
  
  // Exclude staff from expected budget if their payment is not due this month (e.g. they just started)
  const dueStaff = eligibleStaff.filter(member => {
    const startYM = member.startDate ? member.startDate.substring(0, 7) : '';
    return selectedMonth !== startYM;
  });
  
  const expectedMonthlyBudget = dueStaff.reduce((sum, s) => sum + (s.monthlySalary || 0), 0);
  const monthlyPayouts = payouts.filter(p => p.month === selectedMonth);
  const paidSalariesTotal = monthlyPayouts.reduce((sum, p) => sum + (p.netPaid || 0), 0);
  const remainingSalariesTotal = Math.max(0, expectedMonthlyBudget - paidSalariesTotal);

  // Map staff with their payment status for selectedMonth
  const rosterWithPaymentStatus = eligibleStaff.map(member => {
    const statusInfo = getPaymentStatus(member, selectedMonth);
    return {
      ...member,
      ...statusInfo,
    };
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Salary Tracker</h2>
          <span style={{ fontSize: 11, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', padding: '3px 8px', borderRadius: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Superadmin Only
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => loadData()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {activeSubTab === 'roster' && isSuperAdmin && (
            <button onClick={handleOpenCreateStaff} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> Add Staff
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="admin-tabs-wrapper" style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
        {[
          { id: 'payroll', label: 'Monthly Payroll', count: rosterWithPaymentStatus.length, Icon: Wallet },
          { id: 'roster', label: 'Staff Roster', count: staff.length, Icon: User },
          { id: 'history', label: 'Payout History', count: payouts.length, Icon: CreditCard }
        ].map(tab => {
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setSearchQuery('');
              }}
              style={{
                cursor: 'pointer',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: activeSubTab === tab.id ? 'rgba(255,106,26,0.15)' : 'transparent',
                color: activeSubTab === tab.id ? '#ff9a4a' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === tab.id ? 600 : 400,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== null && (
                <span style={{
                  background: activeSubTab === tab.id ? 'rgba(255,106,26,0.25)' : 'rgba(255,255,255,0.08)',
                  color: activeSubTab === tab.id ? '#ff9a4a' : 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 6,
                  marginLeft: 4
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading records…</p>
        </div>
      ) : (
        <>
          {/* TAB 1: MONTHLY PAYROLL */}
          {activeSubTab === 'payroll' && (
            <div>
              {/* Monthly Overview Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Layers size={16} color="#60a5fa" />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Active Staff Count</span>
                  </div>
                  <span style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{activeStaff.length}</span>
                </div>
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Briefcase size={16} color="#34d399" />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Expected Budget</span>
                  </div>
                  <span style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>₱{fmt(expectedMonthlyBudget)}</span>
                </div>
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <CheckCircle2 size={16} color="#ff9a4a" />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Paid Salaries ({selectedMonth})</span>
                  </div>
                  <span style={{ color: '#ff9a4a', fontSize: 32, fontWeight: 700 }}>₱{fmt(paidSalariesTotal)}</span>
                </div>
                <div style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <AlertTriangle size={16} color={remainingSalariesTotal > 0 ? '#ff6b6b' : '#34d399'} />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Remaining/Unpaid</span>
                  </div>
                  <span style={{ color: remainingSalariesTotal > 0 ? '#ff6b6b' : '#34d399', fontSize: 32, fontWeight: 700 }}>₱{fmt(remainingSalariesTotal)}</span>
                </div>
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...S.lbl, margin: 0, textTransform: 'none', fontSize: 13 }}>Select Payroll Month:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                      ...S.inp,
                      width: 'auto',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 8,
                    }}
                  >
                    {MONTHS_LIST.map(m => (
                      <option key={m.val} value={m.val} style={{ background: '#121620', color: '#fff' }}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payroll Status Table */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Staff Member</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Designation / Role</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Base Salary</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterWithPaymentStatus.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                          <User size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                          No active staff members found. Go to "Staff Roster" to add employees.
                        </td>
                      </tr>
                    ) : (
                      rosterWithPaymentStatus.map(member => (
                        <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '18px 24px', fontWeight: 600, color: '#fff' }}>{member.name}</td>
                          <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.6)' }}>{member.role}</td>
                          <td style={{ padding: '18px 24px', color: '#fff', textAlign: 'right', fontWeight: 500 }}>₱{fmt(member.monthlySalary)}</td>
                          <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 4, 
                              background: member.badgeBg, 
                              color: member.badgeColor, 
                              padding: '4px 10px', 
                              borderRadius: 8, 
                              fontSize: 12, 
                              fontWeight: 600 
                            }}>
                              {member.isPaid ? <CheckCircle2 size={12} /> : (member.isUpcoming ? <Clock size={12} /> : <XCircle size={12} />)}
                              {member.label}
                            </span>
                          </td>
                          <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                            {member.isPaid ? (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button
                                  onClick={() => {
                                    alert(`Payment Details for ${member.name}:\n\n` +
                                      `Month: ${selectedMonth}\n` +
                                      `Base Salary: ₱${fmt(member.payout.baseSalary)}\n` +
                                      `Bonus: ₱${fmt(member.payout.bonus)}\n` +
                                      `Deductions: ₱${fmt(member.payout.deductions)}\n` +
                                      `Net Paid: ₱${fmt(member.payout.netPaid)}\n` +
                                      `Paid At: ${member.payout.paidAt}\n` +
                                      `Method: ${member.payout.paymentMethod}\n` +
                                      `Reference #: ${member.payout.referenceNumber || 'N/A'}\n` +
                                      `Notes: ${member.payout.notes || 'None'}`);
                                  }}
                                  style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}
                                >
                                  <Info size={13} /> View Receipt
                                </button>
                                <button
                                  onClick={() => handleDeletePayout(member.payout)}
                                  style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenPayModal(member)}
                                style={{
                                  ...S.btn,
                                  background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)',
                                  color: '#fff',
                                  padding: '7px 14px',
                                  fontSize: 12,
                                  marginLeft: 'auto'
                                }}
                              >
                                <DollarSign size={13} /> Pay Salary
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF ROSTER */}
          {activeSubTab === 'roster' && (
            <div>
              {/* Search Roster */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                  <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search staff by name, role, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ ...S.inp, paddingLeft: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
                  />
                </div>
              </div>

              {/* Roster Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {filteredRoster.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <User size={40} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>No staff members match the query.</p>
                  </div>
                ) : (
                  filteredRoster.map(member => (
                    <div key={member.id} style={{ ...S.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180, border: member.status === 'inactive' ? '1px dashed rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.08)', opacity: member.status === 'inactive' ? 0.6 : 1 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <h4 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>{member.name}</h4>
                            <p style={{ color: '#ff9a4a', fontSize: 13, margin: 0, fontWeight: 500 }}>{member.role}</p>
                          </div>
                          <span style={{
                            fontSize: 10,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: member.status === 'active' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.08)',
                            color: member.status === 'active' ? '#34d399' : 'rgba(255,255,255,0.4)',
                          }}>
                            {member.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                          <div><strong>Email:</strong> {member.email || '—'}</div>
                          <div><strong>Phone:</strong> {member.phone || '—'}</div>
                          <div><strong>Start Date:</strong> {member.startDate || '—'}</div>
                          <div style={{ marginTop: 4, fontSize: 14, color: '#fff' }}>
                            <strong>Base Salary:</strong> <span style={{ color: '#34d399', fontWeight: 600 }}>₱{fmt(member.monthlySalary)}</span> / month
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 'auto' }}>
                        <button onClick={() => handleOpenEditStaff(member)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', flex: 1, justifyContent: 'center' }}>
                          <Edit2 size={13} /> Edit Profile
                        </button>
                        <button onClick={() => handleDeleteStaff(member)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', flexShrink: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYOUT HISTORY */}
          {activeSubTab === 'history' && (
            <div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paid Date</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Staff Member</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payroll Month</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Method</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Net Amount</th>
                      <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                          No salary payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      payouts.map(p => {
                        const monthLabel = MONTHS_LIST.find(m => m.val === p.month)?.label || p.month;
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                            <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.8)' }}>{p.paidAt}</td>
                            <td style={{ padding: '18px 24px', fontWeight: 600, color: '#fff' }}>
                              {p.staffName}
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{p.role}</div>
                            </td>
                            <td style={{ padding: '18px 24px', color: '#ff9a4a' }}>{monthLabel}</td>
                            <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.6)' }}>
                              {p.paymentMethod}
                              {p.referenceNumber && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Ref: {p.referenceNumber}</div>
                              )}
                            </td>
                            <td style={{ padding: '18px 24px', color: '#34d399', textAlign: 'right', fontWeight: 600 }}>₱{fmt(p.netPaid)}</td>
                            <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDeletePayout(p)}
                                style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', marginLeft: 'auto' }}
                              >
                                <Trash2 size={13} /> Delete Payout
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: ADD/EDIT STAFF */}
      {showStaffModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 480, padding: 32, boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {staffEditingId ? 'Edit Staff Profile' : 'Add New Staff Member'}
              </h3>
              <button onClick={() => setShowStaffModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalAlert && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
                {modalAlert}
              </div>
            )}

            <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  style={S.inp}
                  required
                />
              </div>

              <div>
                <label style={S.lbl}>Role / Designation *</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Designer"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  style={S.inp}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Email</label>
                  <input
                    type="email"
                    placeholder="john@odc.com"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    style={S.inp}
                  />
                </div>
                <div>
                  <label style={S.lbl}>Phone</label>
                  <input
                    type="tel"
                    placeholder="+63 9xx..."
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    style={S.inp}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Base Monthly Salary (₱) *</label>
                  <input
                    type="number"
                    placeholder="50000"
                    value={staffForm.monthlySalary}
                    onChange={(e) => setStaffForm({ ...staffForm, monthlySalary: e.target.value })}
                    style={S.inp}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label style={S.lbl}>Start Date</label>
                  <input
                    type="date"
                    value={staffForm.startDate}
                    onChange={(e) => setStaffForm({ ...staffForm, startDate: e.target.value })}
                    style={S.inp}
                  />
                </div>
              </div>

              <div>
                <label style={S.lbl}>Status</label>
                <select
                  value={staffForm.status}
                  onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                  style={S.inp}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowStaffModal(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff' }}>
                  {saving ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD PAYMENT */}
      {showPayModal && payingStaff && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 500, padding: 32, boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Record Salary Payment</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 12 }}>Payee: <strong style={{ color: '#fff' }}>{payingStaff.name}</strong> · Month: <strong style={{ color: '#ff9a4a' }}>{selectedMonth}</strong></p>
              </div>
              <button onClick={() => setShowPayModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalAlert && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
                {modalAlert}
              </div>
            )}

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Base Salary (₱)</label>
                  <input
                    type="number"
                    value={payForm.baseSalary}
                    onChange={(e) => setPayForm({ ...payForm, baseSalary: Number(e.target.value) })}
                    style={S.inp}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label style={S.lbl}>Paid Date</label>
                  <input
                    type="date"
                    value={payForm.paidAt}
                    onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
                    style={S.inp}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Bonus / Allowances (₱)</label>
                  <input
                    type="number"
                    value={payForm.bonus}
                    onChange={(e) => setPayForm({ ...payForm, bonus: Number(e.target.value) })}
                    style={S.inp}
                    min="0"
                  />
                </div>
                <div>
                  <label style={S.lbl}>Deductions (₱)</label>
                  <input
                    type="number"
                    value={payForm.deductions}
                    onChange={(e) => setPayForm({ ...payForm, deductions: Number(e.target.value) })}
                    style={S.inp}
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Payment Method</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    style={S.inp}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="GCash">GCash</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Reference Number</label>
                  <input
                    type="text"
                    placeholder="Optional TXN ID"
                    value={payForm.referenceNumber}
                    onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                    style={S.inp}
                  />
                </div>
              </div>

              <div>
                <label style={S.lbl}>Notes</label>
                <textarea
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  style={{ ...S.inp, height: 60, resize: 'vertical' }}
                />
              </div>

              {/* Net Total Box */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>TOTAL NET PAYOUT</span>
                <span style={{ fontSize: 20, color: '#34d399', fontWeight: 700 }}>₱{fmt(payForm.netPaid)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowPayModal(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff' }}>
                  {saving ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
