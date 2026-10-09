import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { getNextMonthDueDate } from '../utils/billingDates';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { secondaryAuth } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useSystemModal } from '../components/ui/SystemModalContext';
import LoadingButton from '../components/ui/LoadingButton';
import {
  Plus, X, Trash2, RefreshCw, Users, Mail, Building2,
  CreditCard, Edit2, Calendar, Check, Minus, Search,
  FileText, Clock, AlertCircle, CheckCircle2, ChevronRight, Settings,
  MessageSquare, Star, Copy, Link, LayoutList, DollarSign, Target, Layers, Tag, ChevronDown, Rocket, Banknote
} from 'lucide-react';

const CO = {
  address: '3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu',
  email: 'odysseyphitsolutions@gmail.com',
  phone: '09930050994 / 08099855322',
  preparedBy: 'Johnjosefir Roca',
  approvedBy: 'Jetch Merald S. Madaya',
  approvedPhone: '0909-985-5322',
  bankName: 'GoTyme',
  bankAccount: '012267894321',
  bankAccountName: 'Johnjosefir Roca',
};

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDateStr = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const calcTotal = (items) => (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

const getDueDateStatus = (dueDateStr) => {
  if (!dueDateStr) return 'not_configured';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  if (diffDays <= 7) return 'due_soon';
  return 'ok';
};

const toLocalDateString = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const calculateDueDateFromDay = (day) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const maxDays = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(Number(day), maxDays);
  return toLocalDateString(new Date(year, month, targetDay));
};

const shiftDueDate = (currentDueDateStr, cycle) => {
  if (!currentDueDateStr) return '';
  const date = new Date(currentDueDateStr + 'T00:00:00');
  if (cycle === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === 'quarterly') {
    date.setMonth(date.getMonth() + 3);
  } else if (cycle === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setDate(date.getDate() + 30);
  }
  return toLocalDateString(date);
};

// Shared with regression tests for month-end billing.

const DEFAULT_PLANS = [
  { name: 'Basic Care Plan', price: '₱1,500' },
  { name: 'Standard Care Plan', price: '₱3,500' },
  { name: 'Premium Continuous Improvement', price: '₱7,500' }
];

const MAST_STATUS_COLORS = {
  ongoing: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', label: 'Ongoing' },
  completed: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)', label: 'Completed' },
  pending_launch: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)', label: 'Pending Launch' },
  pending_contract: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)', label: 'Pending Contract' },
  on_hold: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)', label: 'On Hold' },
  cancelled: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)', label: 'Cancelled' },
};

export default function AdminClients({ firebaseUser, isSuperAdmin, can, initialSubTab = 'masterlist', onSubTabChange }) {
  const modal = useSystemModal();
  const canCreateClient = can ? can('clients:create') : isSuperAdmin !== false;
  const canBillingClient = can ? can('clients:billing') : isSuperAdmin !== false;
  const canInvoiceClient = can ? can('clients:invoice') : isSuperAdmin !== false;
  const canDeleteClient = can ? can('clients:delete') : isSuperAdmin !== false;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [maintenancePlans, setMaintenancePlans] = useState([]);

  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'masterlist' | 'directory' | 'billing' | 'feedback'
  const [feedbacks, setFeedbacks] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalClientId, setLinkModalClientId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (['masterlist', 'directory', 'billing', 'feedback'].includes(initialSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const selectSubTab = (id) => {
    setActiveSubTab(id);
    onSubTabChange?.(id);
  };

  // Registration form
  const [form, setForm] = useState({ name: '', business: '', email: '', password: '' });
  const [createPortalAccount, setCreatePortalAccount] = useState(false);

  const [billingSetup, setBillingSetup] = useState(false);
  const [billingForm, setBillingForm] = useState({
    billingType: 'flat_rate',
    billingRate: '',
    billingCurrency: 'PHP',
    exchangeRate: '58.0',
    billingCycle: 'monthly',
    dueType: 'day_of_month',
    billingDay: '2',
    nextDueDate: new Date().toISOString().split('T')[0],
    currentBookingsCount: 0,
    maintenancePlan: 'none',
    maintenanceRate: ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Editing billing settings form
  const [showBillingSidebar, setShowBillingSidebar] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editBillingForm, setEditBillingForm] = useState({
    billingType: 'flat_rate',
    billingRate: '',
    billingCurrency: 'PHP',
    exchangeRate: '58.0',
    billingCycle: 'monthly',
    dueType: 'day_of_month',
    billingDay: '2',
    nextDueDate: '',
    currentBookingsCount: 0,
    lastBilledDate: '',
    maintenancePlan: 'none',
    maintenanceRate: ''
  });
  const [savingBilling, setSavingBilling] = useState(false);

  // Invoicing drawer sidebar state (for prefilling & editing the invoice before generating)
  const [showInvoiceSidebar, setShowInvoiceSidebar] = useState(false);
  const [invoicingClient, setInvoicingClient] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    billTo: '',
    project: '',
    date: '',
    paymentTerms: 'Cash/Bank Transfer',
    items: [{ id: 1, service: '', amount: '' }],
    notes: '',
    qrCodes: ['gotyme', 'maribank'],
    preparedBy: CO.preparedBy
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Billing filter states
  const [billingSearch, setBillingSearch] = useState('');
  const [billingTypeFilter, setBillingTypeFilter] = useState('all'); // 'all' | 'flat_rate' | 'per_booking'
  const [billingStatusFilter, setBillingStatusFilter] = useState('all'); // 'all' | 'overdue' | 'due_soon' | 'billed' | 'not_configured'

  // Masterlist states
  const [mastSearch, setMastSearch] = useState('');
  const [mastStatusFilter, setMastStatusFilter] = useState('all');
  const [mastTypeFilter, setMastTypeFilter] = useState('all');
  const [mastPayFilter, setMastPayFilter] = useState('all');
  const [mastSort, setMastSort] = useState('newest');

  const [showMastDetail, setShowMastDetail] = useState(false);
  const [detailClient, setDetailClient] = useState(null);

  const [showMastEdit, setShowMastEdit] = useState(false);
  const [mastCustomTypeOpen, setMastCustomTypeOpen] = useState(false);
  const [mastEditForm, setMastEditForm] = useState({
    projectStatus: 'ongoing',
    projectType: '',
    projectTags: '', // comma separated string for ease of editing
    projectStartDate: '',
    projectEndDate: '',
    launchDate: '',
    projectNotes: '',
    contractTotal: '',
    paymentScheme: 'full', // 'full' | 'installment' | 'downpayment_balance'
    downpaymentAmount: '',
    downpaymentDate: '',
    downpaymentPaid: false,
    installments: []
  });
  const [savingMast, setSavingMast] = useState(false);
  const [mastView, setMastView] = useState('grid'); // 'grid' | 'table'
  const [mastPage, setMastPage] = useState(1);
  const mastPageSize = 12;
  const [mastQuickStatusId, setMastQuickStatusId] = useState(null); // client id for inline status dropdown

  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'clients'), orderBy('createdAt', 'desc')));
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapFeedback = await getDocs(query(collection(db, 'clientFeedback'), orderBy('submittedAt', 'desc')));
      setFeedbacks(snapFeedback.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const handleDeleteFeedback = async (id) => {
    const confirmed = await modal.confirm({
      title: 'Delete feedback submission?',
      message: 'This feedback will be permanently removed and cannot be recovered.',
      confirmLabel: 'Delete feedback',
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'clientFeedback', id));
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      modal.success({ title: 'Feedback deleted', message: 'The feedback submission was removed.' });
    } catch (err) {
      console.error(err);
      modal.error('We could not delete the feedback submission. Please try again.');
    }
  };

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const snap = await getDoc(doc(db, 'maintenanceSettings', 'config'));
        if (snap.exists() && snap.data().plans) {
          setMaintenancePlans(snap.data().plans);
        } else {
          setMaintenancePlans(DEFAULT_PLANS);
        }
      } catch (e) {
        console.error('Error fetching maintenance config:', e);
        setMaintenancePlans(DEFAULT_PLANS);
      }
    };
    fetchPlans();
  }, []);

  const parsePriceToNumber = (priceStr) => {
    if (!priceStr) return 0;
    const clean = priceStr.replace(/[^\d.]/g, '');
    return Number(clean) || 0;
  };

  const handlePlanChange = (val, isEdit = false) => {
    const setFormFn = isEdit ? setEditBillingForm : setBillingForm;
    if (val === 'none') {
      setFormFn(f => ({ ...f, maintenancePlan: val, maintenanceRate: '' }));
    } else if (val === 'custom') {
      setFormFn(f => ({ ...f, maintenancePlan: val }));
    } else {
      const selected = maintenancePlans.find(p => p.name === val);
      if (selected) {
        const parsedRate = parsePriceToNumber(selected.price);
        setFormFn(f => ({
          ...f,
          maintenancePlan: val,
          maintenanceRate: String(parsedRate)
        }));
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      let newUserId = null;

      // 1. If portal account is enabled, create auth user using secondary app (prevents logging out admin)
      if (createPortalAccount) {
        if (!form.email || !form.password) {
          throw new Error('Email and Password are required to create a Client Portal account.');
        }
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
        newUserId = userCredential.user.uid;

        // Update profile name
        await updateProfile(userCredential.user, { displayName: form.name });
      }

      // 2. Save client to Firestore
      const payload = {
        uid: newUserId,
        name: form.name,
        business: form.business,
        email: form.email || '',
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.email,
        // Optional Billing config
        billingType: billingSetup ? billingForm.billingType : null,
        billingRate: billingSetup ? Number(billingForm.billingRate || 0) : null,
        billingCurrency: billingSetup ? (billingForm.billingCurrency || 'PHP') : null,
        exchangeRate: billingSetup && billingForm.billingCurrency === 'USD' ? Number(billingForm.exchangeRate || 58.0) : null,
        maintenancePlan: billingSetup ? (billingForm.maintenancePlan || 'none') : null,
        maintenanceRate: billingSetup ? Number(billingForm.maintenanceRate || 0) : null,
        billingCycle: billingSetup ? (billingForm.billingType === 'flat_rate' ? billingForm.billingCycle : null) : null,
        billingDay: billingSetup && billingForm.dueType === 'day_of_month' ? Number(billingForm.billingDay) : null,
        nextDueDate: billingSetup
          ? (billingForm.dueType === 'day_of_month' ? calculateDueDateFromDay(billingForm.billingDay) : billingForm.nextDueDate)
          : null,
        currentBookingsCount: billingSetup && billingForm.billingType === 'per_booking' ? Number(billingForm.currentBookingsCount || 0) : 0,
        lastBilledDate: null
      };

      await addDoc(collection(db, 'clients'), payload);

      setShowSidebar(false);
      setForm({ name: '', business: '', email: '', password: '' });
      setCreatePortalAccount(false);
      setBillingSetup(false);
      setBillingForm({
        billingType: 'flat_rate',
        billingRate: '',
        billingCurrency: 'PHP',
        exchangeRate: '58.0',
        billingCycle: 'monthly',
        dueType: 'day_of_month',
        billingDay: '2',
        nextDueDate: new Date().toISOString().split('T')[0],
        currentBookingsCount: 0,
        maintenancePlan: 'none',
        maintenanceRate: ''
      });
      load();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('That email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else {
        setErrorMsg('Error creating client. ' + err.message);
      }
    }
    setSaving(false);
  };

  const handleUpdateBillingSubmit = async (e) => {
    e.preventDefault();
    setSavingBilling(true);

    const payload = {
      billingType: editBillingForm.billingType,
      billingRate: Number(editBillingForm.billingRate || 0),
      billingCurrency: editBillingForm.billingCurrency || 'PHP',
      exchangeRate: editBillingForm.billingCurrency === 'USD' ? Number(editBillingForm.exchangeRate || 58.0) : null,
      maintenancePlan: editBillingForm.maintenancePlan || 'none',
      maintenanceRate: Number(editBillingForm.maintenanceRate || 0),
      billingCycle: editBillingForm.billingType === 'flat_rate' ? editBillingForm.billingCycle : null,
      billingDay: editBillingForm.dueType === 'day_of_month' ? Number(editBillingForm.billingDay) : null,
      nextDueDate: editBillingForm.dueType === 'day_of_month'
        ? calculateDueDateFromDay(editBillingForm.billingDay)
        : (editBillingForm.nextDueDate || null),
      currentBookingsCount: editBillingForm.billingType === 'per_booking' ? Number(editBillingForm.currentBookingsCount || 0) : 0,
      lastBilledDate: editBillingForm.lastBilledDate || null,
    };

    try {
      await updateDoc(doc(db, 'clients', editingClient.id), payload);
      setShowBillingSidebar(false);
      load();
    } catch (err) {
      console.error('Error saving billing configuration:', err);
      modal.error({ title: 'Billing details not saved', message: err.message || 'Please check the details and try again.' });
    }
    setSavingBilling(false);
  };

  const handleAdjustBookings = async (client, delta) => {
    const newCount = Math.max(0, (client.currentBookingsCount || 0) + delta);

    // Optimistic UI update
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, currentBookingsCount: newCount } : c));

    try {
      await updateDoc(doc(db, 'clients', client.id), { currentBookingsCount: newCount });
    } catch (e) {
      console.error('Error updating booking count:', e);
      // Rollback UI update on failure
      load(false);
    }
  };

  // MASTERLIST FUNCTIONS
  const openMastEdit = (client) => {
    setDetailClient(client);
    setMastEditForm({
      projectStatus: client.projectStatus || 'ongoing',
      projectType: client.projectType || '',
      projectTags: (client.projectTags || []).join(', '),
      projectStartDate: client.projectStartDate || '',
      projectEndDate: client.projectEndDate || '',
      launchDate: client.launchDate || '',
      projectNotes: client.projectNotes || '',
      contractTotal: client.contractTotal !== undefined ? client.contractTotal : '',
      paymentScheme: client.paymentScheme || 'full',
      downpaymentAmount: client.downpaymentAmount !== undefined ? client.downpaymentAmount : '',
      downpaymentDate: client.downpaymentDate || '',
      downpaymentPaid: client.downpaymentPaid || false,
      installments: client.installments || []
    });
    setMastCustomTypeOpen(false);
    setShowMastEdit(true);
  };

  const handleSaveMastEdit = async (e) => {
    e.preventDefault();
    setSavingMast(true);

    const payload = {
      projectStatus: mastEditForm.projectStatus,
      projectType: mastEditForm.projectType,
      projectTags: mastEditForm.projectTags.split(',').map(t => t.trim()).filter(Boolean),
      projectStartDate: mastEditForm.projectStartDate,
      projectEndDate: mastEditForm.projectEndDate,
      launchDate: mastEditForm.launchDate,
      projectNotes: mastEditForm.projectNotes,
      contractTotal: Number(mastEditForm.contractTotal || 0),
      paymentScheme: mastEditForm.paymentScheme,
      downpaymentAmount: Number(mastEditForm.downpaymentAmount || 0),
      downpaymentDate: mastEditForm.downpaymentDate,
      downpaymentPaid: mastEditForm.downpaymentPaid,
      installments: mastEditForm.installments
    };

    try {
      await updateDoc(doc(db, 'clients', detailClient.id), payload);
      setShowMastEdit(false);

      // Update local state for immediate feedback
      setClients(prev => prev.map(c => c.id === detailClient.id ? { ...c, ...payload } : c));
      setDetailClient(prev => ({ ...prev, ...payload }));

    } catch (err) {
      console.error(err);
      modal.error({ title: 'Client details not saved', message: err.message || 'Please check the details and try again.' });
    }
    setSavingMast(false);
  };

  const quickMarkDownpayment = async (client, paidStatus) => {
    try {
      await updateDoc(doc(db, 'clients', client.id), { downpaymentPaid: paidStatus });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, downpaymentPaid: paidStatus } : c));
      if (detailClient?.id === client.id) setDetailClient(prev => ({ ...prev, downpaymentPaid: paidStatus }));
    } catch (e) {
      console.error(e);
    }
  };

  const quickMarkInstallment = async (client, installmentId, status) => {
    const updatedInst = (client.installments || []).map(i => {
      if (i.id === installmentId) {
        return { ...i, status, paidDate: status === 'paid' ? today() : null };
      }
      return i;
    });

    try {
      await updateDoc(doc(db, 'clients', client.id), { installments: updatedInst });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, installments: updatedInst } : c));
      if (detailClient?.id === client.id) setDetailClient(prev => ({ ...prev, installments: updatedInst }));
    } catch (e) {
      console.error(e);
    }
  };

  const today = () => new Date().toISOString().split('T')[0];

  // Triggers the invoice creation modal pre-populated with default client billing data
  const handleOpenGenerateInvoice = (client) => {
    if (!client.billingType || !client.billingRate) {
      modal.error({ title: 'Billing setup required', message: 'Configure this client’s billing type and rate before generating an invoice.' });
      return;
    }

    let baseAmount = 0;
    let baseDesc = '';
    const todayStr = new Date().toISOString().split('T')[0];

    const isUSD = client.billingCurrency === 'USD';
    const rateInUSD = Number(client.billingRate);
    const exRate = Number(client.exchangeRate || 58.0);
    const rateInPHP = isUSD ? rateInUSD * exRate : rateInUSD;

    if (client.billingType === 'flat_rate') {
      baseAmount = rateInPHP;
      const cycleLabel = client.billingCycle === 'monthly' ? 'Monthly' : client.billingCycle === 'quarterly' ? 'Quarterly' : 'Yearly';
      const monthStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      baseDesc = isUSD
        ? `${cycleLabel} Flat Rate — ${monthStr} ($${rateInUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} @ ₱${exRate.toFixed(2)}/USD)`
        : `${cycleLabel} Flat Rate — ${monthStr}`;
    } else if (client.billingType === 'per_booking') {
      const bookings = Number(client.currentBookingsCount || 0);
      baseAmount = rateInPHP * bookings;
      baseDesc = isUSD
        ? `Per-Booking Maintenance Fee (${bookings} bookings @ $${rateInUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} @ ₱${exRate.toFixed(2)}/USD)`
        : `Per-Booking Maintenance Fee (${bookings} bookings @ ₱${client.billingRate})`;
    }

    const items = [];
    if (client.billingType) {
      items.push({ id: 1, service: baseDesc, amount: String(baseAmount.toFixed(2)) });
    }

    // Additional Maintenance Plan Fee
    if (client.maintenancePlan && client.maintenancePlan !== 'none') {
      const mPlanPrice = Number(client.maintenanceRate || 0);
      items.push({
        id: Date.now() + 1,
        service: `Maintenance Support — ${client.maintenancePlan}`,
        amount: String(mPlanPrice.toFixed(2))
      });
    }

    setInvoicingClient(client);
    setInvoiceForm({
      billTo: client.name,
      project: client.business || 'Maintenance Support',
      date: todayStr,
      paymentTerms: 'Cash/Bank Transfer',
      items: items.length > 0 ? items : [{ id: 1, service: 'Maintenance support', amount: '0' }],
      notes: 'Generated from Client Billing Tracker.',
      qrCodes: ['gotyme', 'maribank'],
      preparedBy: firebaseUser.email || CO.preparedBy
    });
    setShowInvoiceSidebar(true);
  };

  // Submit hander to save the edited invoice and update the client due-dates/bookings
  const handleGenerateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (savingInvoice) return;
    setSavingInvoice(true);

    const invoiceFormTotal = calcTotal(invoiceForm.items);

    try {
      // 1. Fetch current invoices to calculate sequential number
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const invoiceCount = invoicesSnap.size;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const invoiceNumber = `SOA-${year}-${month}-${String(invoiceCount + 1).padStart(3, '0')}`;

      // 2. Add Invoice document to Firestore
      const invoicePayload = {
        invoiceNumber,
        billTo: invoiceForm.billTo,
        project: invoiceForm.project,
        date: invoiceForm.date,
        paymentTerms: invoiceForm.paymentTerms,
        items: invoiceForm.items.map(item => ({ service: item.service, amount: Number(item.amount || 0) })),
        notes: invoiceForm.notes,
        qrCodes: invoiceForm.qrCodes,
        preparedBy: invoiceForm.preparedBy,
        total: invoiceFormTotal,
        status: 'unpaid',
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.email || 'Admin'
      };

      await addDoc(collection(db, 'invoices'), invoicePayload);

      // 3. Update Client details
      let clientUpdate = {
        lastBilledDate: invoiceForm.date
      };

      if (invoicingClient.billingType === 'flat_rate') {
        const newDueDate = invoicingClient.billingDay
          ? getNextMonthDueDate(invoicingClient.nextDueDate || invoiceForm.date, invoicingClient.billingDay)
          : shiftDueDate(invoicingClient.nextDueDate || invoiceForm.date, invoicingClient.billingCycle);
        clientUpdate.nextDueDate = newDueDate;
      } else if (invoicingClient.billingType === 'per_booking') {
        clientUpdate.currentBookingsCount = 0;
        const newDueDate = invoicingClient.billingDay
          ? getNextMonthDueDate(invoicingClient.nextDueDate || invoiceForm.date, invoicingClient.billingDay)
          : shiftDueDate(invoicingClient.nextDueDate || invoiceForm.date, 'monthly');
        clientUpdate.nextDueDate = newDueDate;
      }

      await updateDoc(doc(db, 'clients', invoicingClient.id), clientUpdate);
      setShowInvoiceSidebar(false);
      load();
      modal.success({ title: 'Invoice created', message: `${invoiceNumber} is ready in Invoices & Finance.` });
    } catch (err) {
      console.error('Error generating invoice:', err);
      modal.error({ title: 'Invoice not created', message: err.message || 'Please review the invoice details and try again.' });
    } finally {
      setSavingInvoice(false);
    }
  };

  // Invoice Line Items Management inside sidebar
  const addInvoiceItem = () => setInvoiceForm(f => ({ ...f, items: [...f.items, { id: Date.now(), service: '', amount: '' }] }));
  const removeInvoiceItem = (id) => setInvoiceForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  const updInvoiceItem = (id, k, v) => setInvoiceForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }));
  const invoiceFormTotal = calcTotal(invoiceForm.items);

  const openEditBilling = (client) => {
    setEditingClient(client);
    setEditBillingForm({
      billingType: client.billingType || 'flat_rate',
      billingRate: client.billingRate !== undefined && client.billingRate !== null ? client.billingRate : '',
      billingCurrency: client.billingCurrency || 'PHP',
      exchangeRate: client.exchangeRate !== undefined && client.exchangeRate !== null ? client.exchangeRate : '58.0',
      maintenancePlan: client.maintenancePlan || 'none',
      maintenanceRate: client.maintenanceRate !== undefined && client.maintenanceRate !== null ? client.maintenanceRate : '',
      billingCycle: client.billingCycle || 'monthly',
      dueType: client.billingDay ? 'day_of_month' : 'manual',
      billingDay: client.billingDay || '2',
      nextDueDate: client.nextDueDate || new Date().toISOString().split('T')[0],
      currentBookingsCount: client.currentBookingsCount || 0,
      lastBilledDate: client.lastBilledDate || ''
    });
    setShowBillingSidebar(true);
  };

  const handleDelete = async (client) => {
    const confirmed = await modal.confirm({
      title: 'Delete client record?',
      message: `${client.name} will be removed from this list. Their Firebase Auth account will remain active.`,
      confirmLabel: 'Delete record',
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'clients', client.id));
      setClients(prev => prev.filter(c => c.id !== client.id));
      modal.success({ title: 'Client record deleted', message: `${client.name} was removed from the client list.` });
    } catch (err) {
      console.error('Error deleting client record:', err);
      modal.error('We could not delete the client record. Please try again.');
    }
  };

  // Compute metrics for Billing Tracker tab
  const activeBillingClients = clients.filter(c => c.billingType);
  const totalFeedbacks = feedbacks.length;
  const overdueClients = clients.filter(c => c.billingType && c.nextDueDate && getDueDateStatus(c.nextDueDate) === 'overdue');

  const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const dueThisMonth = clients.filter(c => c.billingType && c.nextDueDate && c.nextDueDate.substring(0, 7) === currentYearMonth);

  const projectedRevenue = clients.reduce((acc, c) => {
    if (!c.billingType) return acc;
    const isUSD = c.billingCurrency === 'USD';
    const rateInUSD = Number(c.billingRate || 0);
    const exRate = Number(c.exchangeRate || 58.0);
    const rateInPHP = isUSD ? rateInUSD * exRate : rateInUSD;

    let clientTotal = 0;
    if (c.billingType === 'flat_rate') {
      clientTotal = rateInPHP;
    } else if (c.billingType === 'per_booking') {
      clientTotal = rateInPHP * Number(c.currentBookingsCount || 0);
    }

    // Add the maintenance rate (always in PHP) if configured
    if (c.maintenancePlan && c.maintenancePlan !== 'none') {
      clientTotal += Number(c.maintenanceRate || 0);
    }

    return acc + clientTotal;
  }, 0);

  // Masterlist calculations
  const getClientCollected = (c) => {
    let sum = 0;
    if (c.downpaymentPaid) {
      sum += Number(c.downpaymentAmount || 0);
    }
    (c.installments || []).forEach(inst => {
      if (inst.status === 'paid') sum += Number(inst.amount || 0);
    });
    return sum;
  };

  const mastStats = clients.reduce((acc, c) => {
    const status = c.projectStatus || 'ongoing';
    if (status === 'ongoing') acc.ongoing++;
    if (status === 'completed') acc.completed++;
    if (status === 'pending_launch') acc.pendingLaunch++;

    const contract = Number(c.contractTotal || 0);
    const collected = getClientCollected(c);
    acc.totalContract += contract;
    acc.totalCollected += collected;

    // Billing tracker data
    if (c.billingType) {
      acc.billingActive++;
      const isUSD = c.billingCurrency === 'USD';
      const rate = Number(c.billingRate || 0);
      const exRate = Number(c.exchangeRate || 58.0);
      const rateInPHP = isUSD ? rate * exRate : rate;
      let clientBillTotal = c.billingType === 'flat_rate' ? rateInPHP : rateInPHP * Number(c.currentBookingsCount || 0);
      if (c.maintenancePlan && c.maintenancePlan !== 'none') clientBillTotal += Number(c.maintenanceRate || 0);
      acc.projectedRevenue += clientBillTotal;
    }

    if (c.billingType && c.nextDueDate) {
      const billStatus = getDueDateStatus(c.nextDueDate);
      if (billStatus === 'overdue') acc.billingOverdue++;
      if (billStatus === 'due_today' || billStatus === 'due_soon') acc.billingSoon++;
    }

    return acc;
  }, { ongoing: 0, completed: 0, pendingLaunch: 0, totalContract: 0, totalCollected: 0, billingActive: 0, projectedRevenue: 0, billingOverdue: 0, billingSoon: 0 });
  mastStats.outstanding = mastStats.totalContract - mastStats.totalCollected;

  const filteredMasterlist = clients.filter(c => {
    const s = (c.projectStatus || 'ongoing');

    const matchSearch =
      c.name?.toLowerCase().includes(mastSearch.toLowerCase()) ||
      c.business?.toLowerCase().includes(mastSearch.toLowerCase()) ||
      c.projectType?.toLowerCase().includes(mastSearch.toLowerCase()) ||
      (c.projectTags || []).some(t => t.toLowerCase().includes(mastSearch.toLowerCase()));

    const matchStatus = mastStatusFilter === 'all' || s === mastStatusFilter;
    const matchType = mastTypeFilter === 'all' || (c.projectType || '') === mastTypeFilter;

    let matchPay = true;
    if (mastPayFilter === 'fully_paid') {
      matchPay = getClientCollected(c) >= Number(c.contractTotal || 0);
    } else if (mastPayFilter === 'outstanding') {
      matchPay = getClientCollected(c) < Number(c.contractTotal || 0);
    } else if (mastPayFilter === 'overdue_installment') {
      matchPay = (c.installments || []).some(i => i.status === 'overdue');
    }

    return matchSearch && matchStatus && matchType && matchPay;
  }).sort((a, b) => {
    if (mastSort === 'newest') return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    if (mastSort === 'oldest') return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
    if (mastSort === 'highest_contract') return Number(b.contractTotal || 0) - Number(a.contractTotal || 0);
    if (mastSort === 'completion') {
      const pA = Number(a.contractTotal || 0) ? getClientCollected(a) / Number(a.contractTotal) : 0;
      const pB = Number(b.contractTotal || 0) ? getClientCollected(b) / Number(b.contractTotal) : 0;
      return pB - pA;
    }
    return 0;
  });

  // Filter client directory list
  const filteredDirectory = clients;

  // Filter clients for billing tracker
  const filteredBilling = clients.filter(c => {
    const matchesSearch =
      c.name?.toLowerCase().includes(billingSearch.toLowerCase()) ||
      c.business?.toLowerCase().includes(billingSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(billingSearch.toLowerCase());

    const matchesType =
      billingTypeFilter === 'all' ||
      c.billingType === billingTypeFilter;

    const status = getDueDateStatus(c.nextDueDate);
    let matchesStatus = true;
    if (billingStatusFilter === 'overdue') {
      matchesStatus = c.billingType && status === 'overdue';
    } else if (billingStatusFilter === 'due_soon') {
      matchesStatus = c.billingType && (status === 'due_soon' || status === 'due_today');
    } else if (billingStatusFilter === 'billed') {
      matchesStatus = c.billingType && status === 'ok';
    } else if (billingStatusFilter === 'not_configured') {
      matchesStatus = !c.billingType;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  const renderDueDateBadge = (dueDate) => {
    if (!dueDate) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', fontSize: 11, fontWeight: 600,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6
        }}>
          Not Configured
        </span>
      );
    }

    const status = getDueDateStatus(dueDate);

    if (status === 'overdue') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', fontSize: 11, fontWeight: 600,
          background: 'rgba(239,68,68,0.1)', color: '#f87171',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6
        }}>
          <AlertCircle size={10} /> Overdue
        </span>
      );
    }

    if (status === 'due_today') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', fontSize: 11, fontWeight: 600,
          background: 'rgba(249,115,22,0.1)', color: '#fb923c',
          border: '1px solid rgba(249,115,22,0.2)', borderRadius: 6
        }}>
          <Clock size={10} /> Due Today
        </span>
      );
    }

    if (status === 'due_soon') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', fontSize: 11, fontWeight: 600,
          background: 'rgba(234,179,8,0.1)', color: '#facc15',
          border: '1px solid rgba(234,179,8,0.2)', borderRadius: 6
        }}>
          <Clock size={10} /> Due Soon
        </span>
      );
    }

    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', fontSize: 11, fontWeight: 600,
        background: 'rgba(34,197,94,0.1)', color: '#4ade80',
        border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6
      }}>
        <CheckCircle2 size={10} /> Up to Date
      </span>
    );
  };

  // Helper list of days 1-31
  const daysArray = Array.from({ length: 31 }, (_, i) => String(i + 1));

  // Dynamic dropdown lists for Masterlist (merged with defaults so the dropdown arrow always appears)
  const uniqueProjectTypes = Array.from(new Set([
    'Pickleball Court Booking System', 'Inventory Management System', 'Barbershop Booking System', 'Web App', 'Mobile App', 'Landing Page', 'E-commerce', 'Custom System', 'Maintenance',
    ...clients.map(c => c.projectType).filter(Boolean)
  ]));
  const uniqueProjectTags = Array.from(new Set([
    'React', 'Node.js', 'Firebase', 'Shopify', 'WordPress', 'React Native', 'Flutter', 'UI/UX Design',
    ...clients.map(c => (c.projectTags || []).join(', ')).filter(Boolean)
  ]));

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Header Row */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Client Management</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <LoadingButton onClick={() => load()} loading={refreshing} loadingLabel="Refreshing…" style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} /> Refresh
          </LoadingButton>
          {activeSubTab === 'feedback' ? (
            <button onClick={() => { setLinkModalClientId(clients[0]?.id || ''); setCopiedLink(false); setShowLinkModal(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Link size={16} /> Get Feedback Link
            </button>
          ) : (
            canCreateClient && (
              <button onClick={() => { setForm({ name: '', business: '', email: '', password: '' }); setCreatePortalAccount(false); setBillingSetup(false); setErrorMsg(''); setShowSidebar(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
                <Plus size={16} /> New Client
              </button>
            )
          )}
        </div>
      </div>

      {/* Sub-navigation Subtabs */}
      <div className="admin-tabs-wrapper" style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
        {[
          { id: 'masterlist', label: 'Masterlist', count: clients.length, Icon: LayoutList },
          { id: 'directory', label: 'Client Directory', count: clients.length, Icon: Users },
          { id: 'billing', label: 'Billing Tracker', count: activeBillingClients.length, Icon: CreditCard },
          { id: 'feedback', label: 'Client Feedback', count: feedbacks.length, Icon: MessageSquare }
        ].map(subTab => {
          const Icon = subTab.Icon;
          return (
            <button
              key={subTab.id}
              onClick={() => selectSubTab(subTab.id)}
              style={{
                cursor: 'pointer',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: activeSubTab === subTab.id ? 'rgba(255,106,26,0.15)' : 'transparent',
                color: activeSubTab === subTab.id ? '#ff9a4a' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === subTab.id ? 600 : 400,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icon size={14} />
              {subTab.label}
              <span style={{
                background: activeSubTab === subTab.id ? 'rgba(255,106,26,0.25)' : 'rgba(255,255,255,0.08)',
                color: activeSubTab === subTab.id ? '#ff9a4a' : 'rgba(255,255,255,0.4)',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6
              }}>
                {subTab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ACTIVE TAB RENDER */}

      {/* TAB 0: MASTERLIST */}
      {activeSubTab === 'masterlist' && (
        <>
          {/* === SECTION 1: Project Status KPIs === */}
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>📁 Project Status</div>
          <div className="admin-metrics-grid mast-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { l: 'Total Clients', v: clients.length, c: '#fff', icon: '👥' },
              { l: 'Ongoing', v: mastStats.ongoing, c: '#34d399', icon: '🟢' },
              { l: 'Completed', v: mastStats.completed, c: '#60a5fa', icon: '🔵' },
              { l: 'Pending Launch', v: mastStats.pendingLaunch, c: '#a78bfa', icon: '🚀' },
            ].map(({ l, v, c, icon }) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ color: c, fontSize: 22, fontWeight: 700 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* === SECTION 2: Contract & Payments === */}
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>💰 Contract & Payments</div>
          <div className="admin-metrics-grid mast-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { l: 'Total Contract Value', v: `₱${mastStats.totalContract.toLocaleString('en-PH')}`, c: '#fff', icon: '📄' },
              { l: 'Total Collected', v: `₱${mastStats.totalCollected.toLocaleString('en-PH')}`, c: '#34d399', icon: '💰' },
              { l: 'Outstanding Balance', v: `₱${mastStats.outstanding.toLocaleString('en-PH')}`, c: mastStats.outstanding > 0 ? '#f87171' : '#34d399', icon: '⏳' },
            ].map(({ l, v, c, icon }) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ color: c, fontSize: 18, fontWeight: 700 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* === SECTION 3: Billing Tracker Summary === */}
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>📋 Billing Tracker</div>
          <div className="admin-metrics-grid mast-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { l: 'Billing Configured', v: mastStats.billingActive, c: '#fff', icon: '⚙️', sub: `of ${clients.length} clients` },
              { l: 'Projected Monthly', v: `₱${mastStats.projectedRevenue.toLocaleString('en-PH')}`, c: '#ff9a4a', icon: '📈', sub: 'recurring revenue' },
              { l: 'Overdue Billing', v: mastStats.billingOverdue, c: mastStats.billingOverdue > 0 ? '#f87171' : '#34d399', icon: '🔴', sub: 'need collection' },
              { l: 'Due Soon', v: mastStats.billingSoon, c: mastStats.billingSoon > 0 ? '#fbbf24' : '#34d399', icon: '⏰', sub: 'within 7 days' },
            ].map(({ l, v, c, icon, sub }) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${l === 'Overdue Billing' && mastStats.billingOverdue > 0 ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ color: c, fontSize: 18, fontWeight: 700 }}>{v}</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar: Search + Filters + View Toggle */}
          <div className="admin-toolbar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search clients, business, project type, tags..."
                value={mastSearch}
                onChange={e => { setMastSearch(e.target.value); setMastPage(1); }}
                style={{ ...S.inp, paddingLeft: 36, fontSize: 13 }}
              />
            </div>
            {/* Status filter with live counts */}
            <select style={{ ...S.inp, width: 'auto', minWidth: 160, cursor: 'pointer', fontSize: 13 }} value={mastStatusFilter} onChange={e => { setMastStatusFilter(e.target.value); setMastPage(1); }}>
              <option value="all" style={{ background: '#0f1218' }}>All Status ({clients.length})</option>
              <option value="ongoing" style={{ background: '#0f1218' }}>🟢 Ongoing ({mastStats.ongoing})</option>
              <option value="completed" style={{ background: '#0f1218' }}>🔵 Completed ({mastStats.completed})</option>
              <option value="pending_launch" style={{ background: '#0f1218' }}>🟣 Pending Launch ({mastStats.pendingLaunch})</option>
              <option value="pending_contract" style={{ background: '#0f1218' }}>🟡 Pending Contract ({clients.filter(c => (c.projectStatus || 'ongoing') === 'pending_contract').length})</option>
              <option value="on_hold" style={{ background: '#0f1218' }}>🟠 On Hold ({clients.filter(c => (c.projectStatus || 'ongoing') === 'on_hold').length})</option>
              <option value="cancelled" style={{ background: '#0f1218' }}>🔴 Cancelled ({clients.filter(c => (c.projectStatus || 'ongoing') === 'cancelled').length})</option>
            </select>
            <select style={{ ...S.inp, width: 'auto', minWidth: 150, cursor: 'pointer', fontSize: 13 }} value={mastTypeFilter} onChange={e => { setMastTypeFilter(e.target.value); setMastPage(1); }}>
              <option value="all" style={{ background: '#0f1218' }}>All Types</option>
              {uniqueProjectTypes.map(t => (
                <option key={t} value={t} style={{ background: '#0f1218' }}>{t}</option>
              ))}
            </select>
            <select style={{ ...S.inp, width: 'auto', minWidth: 150, cursor: 'pointer', fontSize: 13 }} value={mastPayFilter} onChange={e => { setMastPayFilter(e.target.value); setMastPage(1); }}>
              <option value="all" style={{ background: '#0f1218' }}>All Payments</option>
              <option value="fully_paid" style={{ background: '#0f1218' }}>✅ Fully Paid</option>
              <option value="outstanding" style={{ background: '#0f1218' }}>⏳ Has Balance</option>
              <option value="overdue_installment" style={{ background: '#0f1218' }}>🔴 Overdue</option>
            </select>
            <select style={{ ...S.inp, width: 'auto', minWidth: 140, cursor: 'pointer', fontSize: 13 }} value={mastSort} onChange={e => setMastSort(e.target.value)}>
              <option value="newest" style={{ background: '#0f1218' }}>Newest First</option>
              <option value="oldest" style={{ background: '#0f1218' }}>Oldest First</option>
              <option value="highest_contract" style={{ background: '#0f1218' }}>Highest Contract</option>
              <option value="completion" style={{ background: '#0f1218' }}>% Paid (High→Low)</option>
            </select>
            {/* View Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              <button onClick={() => setMastView('grid')} title="Card View" style={{ ...S.btn, borderRadius: 0, padding: '8px 14px', background: mastView === 'grid' ? 'rgba(255,106,26,0.2)' : 'transparent', color: mastView === 'grid' ? '#ff9a4a' : 'rgba(255,255,255,0.4)', gap: 4 }}>
                <LayoutList size={15} />
              </button>
              <button onClick={() => setMastView('table')} title="Table View" style={{ ...S.btn, borderRadius: 0, padding: '8px 14px', background: mastView === 'table' ? 'rgba(255,106,26,0.2)' : 'transparent', color: mastView === 'table' ? '#ff9a4a' : 'rgba(255,255,255,0.4)', gap: 4 }}>
                <Layers size={15} />
              </button>
            </div>
          </div>

          {/* Results count */}
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 14 }}>
            Showing <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{Math.min(mastPageSize, filteredMasterlist.length - (mastPage - 1) * mastPageSize)}</strong> of <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{filteredMasterlist.length}</strong> clients
            {filteredMasterlist.length !== clients.length && ` (filtered from ${clients.length})`}
          </div>

          {/* ── GRID VIEW ── */}
          {mastView === 'grid' && (
            <div className="mast-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {filteredMasterlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', gridColumn: '1 / -1' }}>No masterlist records found.</div>
              ) : (
                filteredMasterlist.slice((mastPage - 1) * mastPageSize, mastPage * mastPageSize).map(c => {
                  const s = MAST_STATUS_COLORS[c.projectStatus || 'ongoing'];
                  const contract = Number(c.contractTotal || 0);
                  const collected = getClientCollected(c);
                  const pct = contract > 0 ? Math.min(100, Math.round((collected / contract) * 100)) : 0;
                  const hasFinancials = contract > 0;
                  const overdueCount = (c.installments || []).filter(i => i.status === 'overdue').length;
                  const billStatus = c.billingType && c.nextDueDate ? getDueDateStatus(c.nextDueDate) : null;

                  let cardBorder = 'rgba(255,255,255,0.08)';
                  let cardBg = 'rgba(255,255,255,0.04)';
                  if (overdueCount > 0 || billStatus === 'overdue') {
                    cardBorder = 'rgba(248,113,113,0.4)';
                    cardBg = 'rgba(248,113,113,0.08)';
                  } else if (billStatus === 'due_today' || billStatus === 'due_soon') {
                    cardBorder = 'rgba(251,191,36,0.4)';
                    cardBg = 'rgba(251,191,36,0.08)';
                  }

                  return (
                    <div key={c.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, background-color 0.2s' }}>
                      {/* Card Header */}
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9a4a', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                            {c.name[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: 4, alignItems: 'center' }}>
                              <Building2 size={10} /> {c.business || '—'}
                            </div>
                          </div>
                        </div>
                        {/* Inline Quick Status Badge */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button onClick={() => setMastQuickStatusId(mastQuickStatusId === c.id ? null : c.id)} style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '3px 8px', borderRadius: 7, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.04em' }} title="Click to change status">
                            {s.label} <ChevronDown size={10} />
                          </button>
                          {mastQuickStatusId === c.id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, zIndex: 50, minWidth: 170, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                              {Object.entries(MAST_STATUS_COLORS).map(([key, col]) => (
                                <button key={key} onClick={async () => {
                                  await updateDoc(doc(db, 'clients', c.id), { projectStatus: key });
                                  setClients(prev => prev.map(x => x.id === c.id ? { ...x, projectStatus: key } : x));
                                  setMastQuickStatusId(null);
                                }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: c.projectStatus === key ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', color: col.color, fontSize: 12, fontWeight: c.projectStatus === key ? 700 : 400, textAlign: 'left', fontFamily: 'inherit' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                                  {col.label}
                                  {c.projectStatus === key && <Check size={11} style={{ marginLeft: 'auto' }} />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '12px 16px', flex: 1 }}>
                        {/* Tags row */}
                        {(c.projectType || (c.projectTags || []).length > 0 || c.paymentScheme === 'full' || c.paymentScheme === 'partnership') && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                            {(!c.paymentScheme || c.paymentScheme === 'full') && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600 }}>One-Time Payment</span>}
                            {c.paymentScheme === 'partnership' && <span style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.2)', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600 }}>Partnership</span>}
                            {c.projectType && <span style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 7px', borderRadius: 5, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{c.projectType}</span>}
                            {(c.projectTags || []).slice(0, 3).map(tag => (
                              <span key={tag} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 5, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{tag}</span>
                            ))}
                          </div>
                        )}

                        {/* Financials row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Contract</div>
                            <div style={{ color: hasFinancials ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: hasFinancials ? 600 : 400, fontStyle: hasFinancials ? 'normal' : 'italic' }}>
                              {hasFinancials ? `₱${contract.toLocaleString('en-PH')}` : 'Not set'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Collected</div>
                            <div style={{ color: hasFinancials ? '#34d399' : 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 600, fontStyle: hasFinancials ? 'normal' : 'italic' }}>
                              {hasFinancials ? `₱${collected.toLocaleString('en-PH')}` : '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Balance</div>
                            <div style={{ color: (contract - collected) > 0 ? '#f87171' : '#34d399', fontSize: 13, fontWeight: 600 }}>
                              {hasFinancials ? `₱${(contract - collected).toLocaleString('en-PH')}` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {hasFinancials && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Progress</span>
                              <span style={{ fontSize: 10, color: pct === 100 ? '#34d399' : '#fff', fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34d399' : 'linear-gradient(90deg, #ff6a1a, #ff9a4a)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        )}

                        {/* Billing Tracker Quick Info */}
                        {c.billingType && (
                          <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🔄 Billing ({c.billingCycle})</span>
                              {c.nextDueDate ? (() => {
                                const st = getDueDateStatus(c.nextDueDate);
                                if (st === 'overdue') return <span style={{ color: '#f87171', fontSize: 10, fontWeight: 600 }}>Overdue</span>;
                                if (st === 'due_today') return <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600 }}>Due Today</span>;
                                if (st === 'due_soon') return <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600 }}>Due Soon</span>;
                                return <span style={{ color: '#34d399', fontSize: 10, fontWeight: 600 }}>On Track</span>;
                              })() : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Not Scheduled</span>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, alignItems: 'flex-end' }}>
                              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                                {(() => {
                                  const isUSD = c.billingCurrency === 'USD';
                                  const rate = Number(c.billingRate || 0);
                                  const exRate = Number(c.exchangeRate || 58.0);

                                  const rateInPHP = isUSD ? rate * exRate : rate;
                                  let clientBillTotal = c.billingType === 'flat_rate' ? rateInPHP : rateInPHP * Number(c.currentBookingsCount || 0);
                                  if (c.maintenancePlan && c.maintenancePlan !== 'none') clientBillTotal += Number(c.maintenanceRate || 0);

                                  const phpDisplay = `₱${clientBillTotal.toLocaleString('en-PH')}`;

                                  if (isUSD) {
                                    let usdTotal = c.billingType === 'flat_rate' ? rate : rate * Number(c.currentBookingsCount || 0);
                                    // Note: Maintenance rate is always assumed to be in PHP, so we don't add it to the base USD display.
                                    return <>{phpDisplay} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 400 }}>(${usdTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})</span></>;
                                  }

                                  return phpDisplay;
                                })()}
                              </div>
                              {c.nextDueDate && (
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Due: {fmtDateStr(c.nextDueDate)}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Overdue alert */}
                        {overdueCount > 0 && (
                          <div style={{ marginTop: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertCircle size={12} color="#f87171" />
                            <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>{overdueCount} overdue installment{overdueCount > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                          {c.projectStartDate ? <>📅 {fmtDateStr(c.projectStartDate)}</> : <span style={{ fontStyle: 'italic' }}>No start date</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setDetailClient(c); setShowMastDetail(true); }} style={{ ...S.btn, padding: '5px 10px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                            <Layers size={12} /> Details
                          </button>
                          <button onClick={() => openMastEdit(c)} style={{ ...S.btn, padding: '5px 10px', background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 12 }}>
                            <Edit2 size={12} /> Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TABLE VIEW ── */}
          {mastView === 'table' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
              {filteredMasterlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No records found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
                      {['Client / Business', 'Status', 'Project Type', 'Contract', 'Collected', 'Balance', 'Progress', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterlist.slice((mastPage - 1) * mastPageSize, mastPage * mastPageSize).map(c => {
                      const s = MAST_STATUS_COLORS[c.projectStatus || 'ongoing'];
                      const contract = Number(c.contractTotal || 0);
                      const collected = getClientCollected(c);
                      const pct = contract > 0 ? Math.min(100, Math.round((collected / contract) * 100)) : 0;
                      const overdueCount = (c.installments || []).filter(i => i.status === 'overdue').length;
                      const billStatus = c.billingType && c.nextDueDate ? getDueDateStatus(c.nextDueDate) : null;

                      let rowBg = 'transparent';
                      if (overdueCount > 0 || billStatus === 'overdue') {
                        rowBg = 'rgba(248,113,113,0.08)';
                      } else if (billStatus === 'due_today' || billStatus === 'due_soon') {
                        rowBg = 'rgba(251,191,36,0.08)';
                      }

                      return (
                        <tr key={c.id} className="client-row" style={{ background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9a4a', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{c.name[0]?.toUpperCase()}</div>
                              <div>
                                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.business || '—'}</div>
                              </div>
                            </div>
                            {overdueCount > 0 && <div style={{ marginTop: 4, color: '#f87171', fontSize: 10, fontWeight: 600 }}>⚠ {overdueCount} overdue</div>}
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setMastQuickStatusId(mastQuickStatusId === c.id ? null : c.id)} style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                {s.label} <ChevronDown size={9} />
                              </button>
                              {mastQuickStatusId === c.id && (
                                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, zIndex: 50, minWidth: 170, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                  {Object.entries(MAST_STATUS_COLORS).map(([key, col]) => (
                                    <button key={key} onClick={async () => {
                                      await updateDoc(doc(db, 'clients', c.id), { projectStatus: key });
                                      setClients(prev => prev.map(x => x.id === c.id ? { ...x, projectStatus: key } : x));
                                      setMastQuickStatusId(null);
                                    }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: c.projectStatus === key ? 'rgba(255,255,255,0.06)' : 'none', border: 'none', cursor: 'pointer', color: col.color, fontSize: 12, fontWeight: c.projectStatus === key ? 700 : 400, textAlign: 'left', fontFamily: 'inherit' }}>
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />{col.label}
                                      {c.projectStatus === key && <Check size={10} style={{ marginLeft: 'auto' }} />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{c.projectType || '—'}</td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: '#fff', fontSize: 13, fontWeight: 600 }}>{contract > 0 ? `₱${contract.toLocaleString('en-PH')}` : <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', fontWeight: 400 }}>Not set</span>}</td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: '#34d399', fontSize: 13, fontWeight: 600 }}>{contract > 0 ? `₱${collected.toLocaleString('en-PH')}` : '—'}</td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: (contract - collected) > 0 ? '#f87171' : '#34d399', fontSize: 13, fontWeight: 600 }}>{contract > 0 ? `₱${(contract - collected).toLocaleString('en-PH')}` : '—'}</td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', minWidth: 100 }}>
                            {contract > 0 ? (
                              <div>
                                <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34d399' : 'linear-gradient(90deg,#ff6a1a,#ff9a4a)', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{pct}%</span>
                              </div>
                            ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setDetailClient(c); setShowMastDetail(true); }} style={{ ...S.btn, padding: '5px 8px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}><Layers size={12} /></button>
                              <button onClick={() => openMastEdit(c)} style={{ ...S.btn, padding: '5px 8px', background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 11 }}><Edit2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Pagination */}
          {filteredMasterlist.length > mastPageSize && (() => {
            const totalPages = Math.ceil(filteredMasterlist.length / mastPageSize);
            return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
                <button onClick={() => setMastPage(p => Math.max(1, p - 1))} disabled={mastPage === 1} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: mastPage === 1 ? 'rgba(255,255,255,0.2)' : '#fff', padding: '7px 14px', fontSize: 13 }}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setMastPage(p)} style={{ ...S.btn, padding: '7px 12px', minWidth: 36, justifyContent: 'center', background: mastPage === p ? 'rgba(255,106,26,0.25)' : 'rgba(255,255,255,0.06)', color: mastPage === p ? '#ff9a4a' : 'rgba(255,255,255,0.6)', fontWeight: mastPage === p ? 700 : 400, fontSize: 13 }}>{p}</button>
                ))}
                <button onClick={() => setMastPage(p => Math.min(totalPages, p + 1))} disabled={mastPage === totalPages} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: mastPage === totalPages ? 'rgba(255,255,255,0.2)' : '#fff', padding: '7px 14px', fontSize: 13 }}>Next →</button>
              </div>
            );
          })()}

        </>
      )}

      {/* TAB 1: CLIENT DIRECTORY */}
      {activeSubTab === 'directory' && (
        <>
          <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { l: 'Total Clients', v: clients.length, c: '#fff' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ ...S.card }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
                <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading Clients…</p>
            </div>
          ) : filteredDirectory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No clients registered yet.</div>
          ) : (
            <div className="admin-table-card" style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Client</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Contact</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Added On</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDirectory.map(client => (
                    <tr key={client.id} className="client-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9a4a', fontWeight: 700 }}>
                            {client.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Building2 size={10} /> {client.business || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={12} color="rgba(255,255,255,0.4)" /> {client.email || <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No email</span>}
                        </div>
                        {client.uid ? (
                          <div style={{ color: '#ff9a4a', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginTop: 4, letterSpacing: '0.04em' }}>🔑 Portal Access Active</div>
                        ) : (
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', marginTop: 4, letterSpacing: '0.04em' }}>Local Directory Entry</div>
                        )}
                      </td>
                      <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>
                        {fmtDate(client.createdAt)}
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          {canBillingClient && (
                            <button onClick={() => openEditBilling(client)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Configure Billing">
                              <Settings size={14} /> Configure Billing
                            </button>
                          )}
                          {canDeleteClient && (
                            <LoadingButton onClick={() => handleDelete(client)} loadingLabel="Deleting client record" spinnerOnly style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete Record">
                              <Trash2 size={14} />
                            </LoadingButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: BILLING TRACKER */}
      {activeSubTab === 'billing' && (
        <>
          {/* Tracker Metrics */}
          <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { l: 'Monitored Clients', v: activeBillingClients.length, c: '#fff' },
              { l: 'Due This Month', v: dueThisMonth.length, c: '#fb923c' },
              { l: 'Overdue Billing', v: overdueClients.length, c: '#f87171' },
              { l: 'Projected Revenue', v: `₱${projectedRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, c: '#ff9a4a' }
            ].map(({ l, v, c }) => (
              <div key={l} style={{ ...S.card }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
                <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Filtering and Toolbar */}
          <div className="admin-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search clients, email, company..."
                value={billingSearch}
                onChange={e => setBillingSearch(e.target.value)}
                style={{
                  ...S.inp,
                  padding: '10px 14px 10px 40px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={billingTypeFilter}
                onChange={e => setBillingTypeFilter(e.target.value)}
                style={{
                  padding: '10px 14px',
                  background: '#0f1218',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="all">All Billing Types</option>
                <option value="flat_rate">Flat Rate</option>
                <option value="per_booking">Per Booking</option>
              </select>

              <select
                value={billingStatusFilter}
                onChange={e => setBillingStatusFilter(e.target.value)}
                style={{
                  padding: '10px 14px',
                  background: '#0f1218',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon / Today</option>
                <option value="billed">Up to Date</option>
                <option value="not_configured">Not Configured</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading Billing Data…</p>
            </div>
          ) : filteredBilling.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              No clients matched your criteria.
            </div>
          ) : (
            <div className="admin-table-card" style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 950 }}>
                <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Client</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Billing Setup</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Bookings (Cycle)</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Next Due Date</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Accumulated Amount</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBilling.map(client => {
                    const accumulates = client.billingType === 'per_booking';
                    const isUSD = client.billingCurrency === 'USD';
                    const rateInUSD = Number(client.billingRate || 0);
                    const exRate = Number(client.exchangeRate || 58.0);
                    const rateInPHP = isUSD ? rateInUSD * exRate : rateInUSD;

                    const baseAmountPHP = client.billingType === 'flat_rate'
                      ? rateInPHP
                      : (client.billingType === 'per_booking' ? rateInPHP * (client.currentBookingsCount || 0) : 0);

                    const maintenanceAmt = (client.maintenancePlan && client.maintenancePlan !== 'none') ? Number(client.maintenanceRate || 0) : 0;

                    const amountDue = baseAmountPHP + maintenanceAmt;

                    const matchingPlan = maintenancePlans.find(p => p.name === client.maintenancePlan);
                    const standardRate = matchingPlan ? parsePriceToNumber(matchingPlan.price) : null;
                    const isNegotiated = client.maintenancePlan && client.maintenancePlan !== 'custom' && client.maintenancePlan !== 'none' && standardRate !== null && Number(client.maintenanceRate || 0) !== standardRate;

                    return (
                      <tr key={client.id} className="billing-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                        {/* Client details */}
                        <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9a4a', fontWeight: 700 }}>
                              {client.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{client.business || 'N/A'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Billing setup info */}
                        <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                          {client.billingType ? (
                            <div>
                              {/* Base billing details */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                                  {client.billingType.replace('_', ' ')}:
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                  {isUSD ? `$${rateInUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `₱${rateInUSD.toLocaleString()}`}
                                  {client.billingType === 'flat_rate' ? `/${client.billingCycle || 'mo'}` : '/booking'}
                                </span>
                              </div>
                              {isUSD && (
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>
                                  (₱{rateInPHP.toLocaleString('en-PH', { minimumFractionDigits: 2 })} @ ₱{exRate.toFixed(2)}/USD)
                                </div>
                              )}

                              {/* Additional Maintenance plan details */}
                              {client.maintenancePlan && client.maintenancePlan !== 'none' && (
                                <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                                  <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 600 }}>
                                    + {client.maintenancePlan}
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    ₱{Number(client.maintenanceRate || 0).toLocaleString()}/mo
                                    {isNegotiated && <span style={{ color: '#ff9a4a', fontSize: 10, fontWeight: 600 }}>(Negotiated)</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' }}>Not Configured</span>
                          )}
                        </td>

                        {/* Booking Count Adjuster */}
                        <td style={{ padding: '18px 24px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {accumulates ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 8px' }}>
                              {canInvoiceClient && (
                                <button onClick={() => handleAdjustBookings(client, -1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                                  <Minus size={12} />
                                </button>
                              )}
                              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                                {client.currentBookingsCount || 0}
                              </span>
                              {canInvoiceClient && (
                                <button onClick={() => handleAdjustBookings(client, 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                                  <Plus size={12} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>—</span>
                          )}
                        </td>

                        {/* Due Date & Badge */}
                        <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            {renderDueDateBadge(client.nextDueDate)}
                            {client.nextDueDate && (
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                {fmtDateStr(client.nextDueDate)}
                                {client.billingDay && ` (Day ${client.billingDay})`}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Accumulated Due Amount */}
                        <td style={{ padding: '18px 24px', textAlign: 'right', verticalAlign: 'middle', color: '#ff9a4a', fontWeight: 700, fontSize: 15 }}>
                          {client.billingType ? `₱${amountDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                        </td>

                        {/* Quick Actions */}
                        <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {canBillingClient && (
                              <button onClick={() => openEditBilling(client)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: 8 }} title="Billing Configurations">
                                <Settings size={14} />
                              </button>
                            )}
                            {client.billingType && canInvoiceClient && (
                              <button
                                onClick={() => handleOpenGenerateInvoice(client)}
                                style={{
                                  ...S.btn,
                                  background: 'linear-gradient(135deg,rgba(255,106,26,0.1),rgba(255,154,74,0.15))',
                                  color: '#ff9a4a',
                                  border: '1px solid rgba(255,106,26,0.3)'
                                }}
                              >
                                <FileText size={13} /> Gen Invoice
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 3: CLIENT FEEDBACK */}
      {activeSubTab === 'feedback' && (
        <>
          {/* Feedback Metrics */}
          <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { l: 'Total Reviews', v: feedbacks.length, c: '#fff' },
              { l: 'Avg Quality Rating', v: `${totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + (f.ratingOverall || 0), 0) / totalFeedbacks).toFixed(1) : '0.0'} ★`, c: '#ff9a4a' },
              { l: 'Avg Communication', v: `${totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + (f.ratingCommunication || 0), 0) / totalFeedbacks).toFixed(1) : '0.0'} ★`, c: '#60a5fa' },
              { l: 'Avg Timeliness', v: `${totalFeedbacks > 0 ? (feedbacks.reduce((sum, f) => sum + (f.ratingTimeliness || 0), 0) / totalFeedbacks).toFixed(1) : '0.0'} ★`, c: '#34d399' },
              { l: 'Testimonials Authorized', v: `${totalFeedbacks > 0 ? Math.round((feedbacks.filter(f => f.allowReference).length / totalFeedbacks) * 100) : 0}%`, c: '#a78bfa' }
            ].map(({ l, v, c }) => (
              <div key={l} style={{ ...S.card }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
                <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Feedback list */}
          {feedbacks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
              <MessageSquare size={40} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>No client feedback received yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {feedbacks.map(f => (
                <div key={f.id} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h4 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>{f.clientName}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                        Company / Project: <strong style={{ color: '#ff9a4a' }}>{f.businessName}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        {fmtDate(f.submittedAt)}
                      </span>
                      <span style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: f.allowReference ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.08)',
                        color: f.allowReference ? '#34d399' : 'rgba(255,255,255,0.4)'
                      }}>
                        {f.allowReference ? 'Reference Allowed' : 'Internal Only'}
                      </span>
                    </div>
                  </div>

                  {/* Ratings breakdown */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 13 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Overall: </span><span style={{ color: '#ff9a4a', fontWeight: 600 }}>{f.ratingOverall} ★</span></div>
                    <div style={{ fontSize: 13 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Communication: </span><span style={{ color: '#60a5fa', fontWeight: 600 }}>{f.ratingCommunication} ★</span></div>
                    <div style={{ fontSize: 13 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Timeliness: </span><span style={{ color: '#34d399', fontWeight: 600 }}>{f.ratingTimeliness} ★</span></div>
                  </div>

                  {/* Testimonial Quote */}
                  {f.testimonial && (
                    <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', paddingLeft: 12, borderLeft: '2px solid #ff6a1a', fontSize: 14 }}>
                      "{f.testimonial}"
                    </div>
                  )}

                  {/* Positive/Negatives */}
                  {(f.whatWentWell || f.whatToImprove) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, fontSize: 13 }}>
                      {f.whatWentWell && (
                        <div>
                          <strong style={{ color: '#34d399', display: 'block', marginBottom: 4 }}>What went well:</strong>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{f.whatWentWell}</span>
                        </div>
                      )}
                      {f.whatToImprove && (
                        <div>
                          <strong style={{ color: '#f87171', display: 'block', marginBottom: 4 }}>What could be improved:</strong>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{f.whatToImprove}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {canDeleteClient && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                      <LoadingButton onClick={() => handleDeleteFeedback(f.id)} loadingLabel="Deleting…" style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '6px 12px' }}>
                        <Trash2 size={13} /> Delete Review
                      </LoadingButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL 3: SHARE FEEDBACK LINK */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '90%', maxWidth: 480, padding: 32, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Get Feedback Sharing Link</h3>
              <button onClick={() => setShowLinkModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Select Client / Project</label>
                <select
                  value={linkModalClientId}
                  onChange={(e) => setLinkModalClientId(e.target.value)}
                  style={S.inp}
                >
                  <option value="">General (No Prefill)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#121620' }}>
                      {c.business ? `${c.business} (${c.name})` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={S.lbl}>Copyable Feedback URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={linkModalClientId ? `${window.location.origin}/feedback/${linkModalClientId}` : `${window.location.origin}/feedback`}
                    style={{ ...S.inp, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}
                    readOnly
                  />
                  <button
                    onClick={() => {
                      const link = linkModalClientId ? `${window.location.origin}/feedback/${linkModalClientId}` : `${window.location.origin}/feedback`;
                      navigator.clipboard.writeText(link);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', flexShrink: 0 }}
                  >
                    {copiedLink ? <CheckCircle2 size={15} color="#34d399" /> : <Copy size={15} />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.4 }}>
                Send this link to your client. When they visit it, their company name and representative contact name will be locked and prefilled automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTER CLIENT */}
      {showSidebar && (
        <>
          <div onClick={() => setShowSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Register Client</h3>
              <button onClick={() => setShowSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Client Name</label>
                <input style={S.inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kharyl Simolde" required />
              </div>

              <div>
                <label style={S.lbl}>Business / Company</label>
                <input style={S.inp} value={form.business} onChange={e => setForm(f => ({ ...f, business: e.target.value }))} placeholder="Optional" />
              </div>

              <div>
                <label style={S.lbl}>Email Address</label>
                <input type="email" style={S.inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" required={createPortalAccount} />
              </div>

              {/* Toggle to create portal account */}
              <div style={{ margin: '4px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createPortalAccount}
                    onChange={e => setCreatePortalAccount(e.target.checked)}
                    style={{ accentColor: '#ff6a1a', width: 15, height: 15 }}
                  />
                  Enable Client Portal Access (Creates Logins)
                </label>
              </div>

              {createPortalAccount && (
                <div>
                  <label style={S.lbl}>Temporary Password</label>
                  <input type="text" style={S.inp} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" required={createPortalAccount} minLength={6} />
                </div>
              )}

              {/* Billing setup toggle */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={billingSetup}
                    onChange={e => setBillingSetup(e.target.checked)}
                    style={{ accentColor: '#ff6a1a', width: 16, height: 16 }}
                  />
                  Configure Billing Setup Now
                </label>
              </div>

              {billingSetup && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={S.lbl}>Billing Type</label>
                    <select
                      value={billingForm.billingType}
                      onChange={e => setBillingForm(f => ({ ...f, billingType: e.target.value }))}
                      style={S.inp}
                    >
                      <option value="flat_rate">Flat Rate Maintenance</option>
                      <option value="per_booking">Per Booking Basis</option>
                    </select>
                  </div>

                  <div>
                    <label style={S.lbl}>Maintenance Plan</label>
                    <select
                      value={billingForm.maintenancePlan || 'none'}
                      onChange={e => handlePlanChange(e.target.value, false)}
                      style={S.inp}
                    >
                      <option value="none">None (No Maintenance Plan)</option>
                      <option value="custom">Custom / Negotiated Rate</option>
                      {maintenancePlans.map(plan => (
                        <option key={plan.name} value={plan.name}>
                          {plan.name} ({plan.price || '₱0'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(billingForm.maintenancePlan && billingForm.maintenancePlan !== 'none') && (
                    <div>
                      <label style={S.lbl}>
                        Maintenance Plan Rate (PHP / mo)
                      </label>
                      <input
                        type="number"
                        style={S.inp}
                        value={billingForm.maintenanceRate}
                        onChange={e => setBillingForm(f => ({ ...f, maintenanceRate: e.target.value }))}
                        placeholder="e.g. 3500"
                        required={billingSetup && billingForm.maintenancePlan !== 'none'}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={S.lbl}>Billing Currency</label>
                      <select
                        value={billingForm.billingCurrency || 'PHP'}
                        onChange={e => setBillingForm(f => ({ ...f, billingCurrency: e.target.value }))}
                        style={S.inp}
                      >
                        <option value="PHP">PHP (₱)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>

                    <div>
                      <label style={S.lbl}>
                        {billingForm.billingType === 'flat_rate'
                          ? `Rate Fee (${billingForm.billingCurrency || 'PHP'})`
                          : `Fee per Booking (${billingForm.billingCurrency || 'PHP'})`}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        style={S.inp}
                        value={billingForm.billingRate}
                        onChange={e => setBillingForm(f => ({ ...f, billingRate: e.target.value }))}
                        placeholder={billingForm.billingCurrency === 'USD' ? "e.g. 300" : "e.g. 15000"}
                        required={billingSetup}
                      />
                    </div>
                  </div>

                  {(billingForm.billingCurrency || 'PHP') === 'USD' && (
                    <div>
                      <label style={S.lbl}>Exchange Rate (1 USD = ? PHP)</label>
                      <input
                        type="number"
                        step="0.01"
                        style={S.inp}
                        value={billingForm.exchangeRate}
                        onChange={e => setBillingForm(f => ({ ...f, exchangeRate: e.target.value }))}
                        placeholder="e.g. 58.00"
                        required={billingSetup && billingForm.billingCurrency === 'USD'}
                      />
                    </div>
                  )}

                  {billingForm.billingType === 'flat_rate' && (
                    <div>
                      <label style={S.lbl}>Flat Rate Cycle</label>
                      <select
                        value={billingForm.billingCycle}
                        onChange={e => setBillingForm(f => ({ ...f, billingCycle: e.target.value }))}
                        style={S.inp}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  )}

                  {/* Due Date Type */}
                  <div>
                    <label style={S.lbl}>Due Date Schedule</label>
                    <select
                      value={billingForm.dueType}
                      onChange={e => setBillingForm(f => ({ ...f, dueType: e.target.value }))}
                      style={S.inp}
                    >
                      <option value="day_of_month">Recurring Day of Month</option>
                      <option value="manual">Manual Calendar Date</option>
                    </select>
                  </div>

                  {billingForm.dueType === 'day_of_month' ? (
                    <div>
                      <label style={S.lbl}>Due Day of Month</label>
                      <select
                        value={billingForm.billingDay}
                        onChange={e => setBillingForm(f => ({ ...f, billingDay: e.target.value }))}
                        style={S.inp}
                      >
                        {daysArray.map(day => (
                          <option key={day} value={day}>Day {day} of the month</option>
                        ))}
                      </select>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                        Calculated initial due date: <strong>{fmtDateStr(calculateDueDateFromDay(billingForm.billingDay))}</strong>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={S.lbl}>Next Due Date</label>
                      <input
                        type="date"
                        style={S.inp}
                        value={billingForm.nextDueDate}
                        onChange={e => setBillingForm(f => ({ ...f, nextDueDate: e.target.value }))}
                        required={billingSetup}
                      />
                    </div>
                  )}

                  {billingForm.billingType === 'per_booking' && (
                    <div>
                      <label style={S.lbl}>Initial Booking Count</label>
                      <input
                        type="number"
                        style={S.inp}
                        value={billingForm.currentBookingsCount}
                        onChange={e => setBillingForm(f => ({ ...f, currentBookingsCount: e.target.value }))}
                        min="0"
                      />
                    </div>
                  )}
                </div>
              )}

              <LoadingButton type="submit" loading={saving} loadingLabel="Registering client…" style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                Register Client
              </LoadingButton>
            </form>
          </div>
        </>
      )}

      {/* MODAL 2: CONFIGURE BILLING SETTINGS SIDEBAR */}
      {showBillingSidebar && editingClient && (
        <>
          <div onClick={() => setShowBillingSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 440, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Configure Billing</h3>
              <button onClick={() => setShowBillingSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{editingClient.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{editingClient.business || 'No Business Name'}</div>
            </div>

            <form onSubmit={handleUpdateBillingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Billing Type</label>
                <select
                  value={editBillingForm.billingType}
                  onChange={e => setEditBillingForm(f => ({ ...f, billingType: e.target.value }))}
                  style={S.inp}
                >
                  <option value="flat_rate">Flat Rate Maintenance</option>
                  <option value="per_booking">Per Booking Basis</option>
                </select>
              </div>

              <div>
                <label style={S.lbl}>Maintenance Plan</label>
                <select
                  value={editBillingForm.maintenancePlan || 'none'}
                  onChange={e => handlePlanChange(e.target.value, true)}
                  style={S.inp}
                >
                  <option value="none">None (No Maintenance Plan)</option>
                  <option value="custom">Custom / Negotiated Rate</option>
                  {maintenancePlans.map(plan => (
                    <option key={plan.name} value={plan.name}>
                      {plan.name} ({plan.price || '₱0'})
                    </option>
                  ))}
                </select>
              </div>

              {(editBillingForm.maintenancePlan && editBillingForm.maintenancePlan !== 'none') && (
                <div>
                  <label style={S.lbl}>
                    Maintenance Plan Rate (PHP / mo)
                  </label>
                  <input
                    type="number"
                    style={S.inp}
                    value={editBillingForm.maintenanceRate}
                    onChange={e => setEditBillingForm(f => ({ ...f, maintenanceRate: e.target.value }))}
                    placeholder="e.g. 3500"
                    required={editBillingForm.maintenancePlan !== 'none'}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>Billing Currency</label>
                  <select
                    value={editBillingForm.billingCurrency || 'PHP'}
                    onChange={e => setEditBillingForm(f => ({ ...f, billingCurrency: e.target.value }))}
                    style={S.inp}
                  >
                    <option value="PHP">PHP (₱)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label style={S.lbl}>
                    {editBillingForm.billingType === 'flat_rate'
                      ? `Rate Fee (${editBillingForm.billingCurrency || 'PHP'})`
                      : `Fee per Booking (${editBillingForm.billingCurrency || 'PHP'})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    style={S.inp}
                    value={editBillingForm.billingRate}
                    onChange={e => setEditBillingForm(f => ({ ...f, billingRate: e.target.value }))}
                    placeholder={editBillingForm.billingCurrency === 'USD' ? "e.g. 300" : "e.g. 15000"}
                    required
                  />
                </div>
              </div>

              {(editBillingForm.billingCurrency || 'PHP') === 'USD' && (
                <div>
                  <label style={S.lbl}>Exchange Rate (1 USD = ? PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    style={S.inp}
                    value={editBillingForm.exchangeRate}
                    onChange={e => setEditBillingForm(f => ({ ...f, exchangeRate: e.target.value }))}
                    placeholder="e.g. 58.00"
                    required={editBillingForm.billingCurrency === 'USD'}
                  />
                </div>
              )}

              {editBillingForm.billingType === 'flat_rate' && (
                <div>
                  <label style={S.lbl}>Billing Cycle</label>
                  <select
                    value={editBillingForm.billingCycle}
                    onChange={e => setEditBillingForm(f => ({ ...f, billingCycle: e.target.value }))}
                    style={S.inp}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}

              {/* Due Date Type */}
              <div>
                <label style={S.lbl}>Due Date Schedule</label>
                <select
                  value={editBillingForm.dueType}
                  onChange={e => setEditBillingForm(f => ({ ...f, dueType: e.target.value }))}
                  style={S.inp}
                >
                  <option value="day_of_month">Recurring Day of Month</option>
                  <option value="manual">Manual Calendar Date</option>
                </select>
              </div>

              {editBillingForm.dueType === 'day_of_month' ? (
                <div>
                  <label style={S.lbl}>Due Day of Month</label>
                  <select
                    value={editBillingForm.billingDay}
                    onChange={e => setEditBillingForm(f => ({ ...f, billingDay: e.target.value }))}
                    style={S.inp}
                  >
                    {daysArray.map(day => (
                      <option key={day} value={day}>Day {day} of the month</option>
                    ))}
                  </select>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                    Calculated next due date: <strong>{fmtDateStr(calculateDueDateFromDay(editBillingForm.billingDay))}</strong>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={S.lbl}>Next Due Date</label>
                  <input
                    type="date"
                    style={S.inp}
                    value={editBillingForm.nextDueDate}
                    onChange={e => setEditBillingForm(f => ({ ...f, nextDueDate: e.target.value }))}
                    required
                  />
                </div>
              )}

              {editBillingForm.billingType === 'per_booking' && (
                <div>
                  <label style={S.lbl}>Current Booking Count</label>
                  <input
                    type="number"
                    style={S.inp}
                    value={editBillingForm.currentBookingsCount}
                    onChange={e => setEditBillingForm(f => ({ ...f, currentBookingsCount: e.target.value }))}
                    min="0"
                  />
                </div>
              )}

              <div>
                <label style={S.lbl}>Last Billed Date</label>
                <input
                  type="date"
                  style={S.inp}
                  value={editBillingForm.lastBilledDate}
                  onChange={e => setEditBillingForm(f => ({ ...f, lastBilledDate: e.target.value }))}
                />
              </div>

              <LoadingButton
                type="submit"
                loading={savingBilling}
                loadingLabel="Saving billing info…"
                style={{
                  ...S.btn,
                  background: savingBilling ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)',
                  color: '#fff',
                  padding: '13px 0',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: savingBilling ? 'none' : '0 4px 16px rgba(255,106,26,0.3)',
                  width: '100%',
                  marginTop: 16
                }}
              >
                Save Configuration
              </LoadingButton>
            </form>
          </div>
        </>
      )}

      {/* MODAL 3: INVOICE GENERATOR SIDEBAR (Edits pre-filled invoice details) */}
      {showInvoiceSidebar && invoicingClient && (
        <>
          <div onClick={() => setShowInvoiceSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Generate Invoice</h3>
              <button onClick={() => setShowInvoiceSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleGenerateInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={S.lbl}>Bill To (Client)</label>
                <input style={S.inp} value={invoiceForm.billTo} onChange={e => setInvoiceForm(f => ({ ...f, billTo: e.target.value }))} placeholder="e.g. CPRMed" required />
              </div>
              <div>
                <label style={S.lbl}>Project</label>
                <input style={S.inp} value={invoiceForm.project} onChange={e => setInvoiceForm(f => ({ ...f, project: e.target.value }))} placeholder="e.g. Clinic Management" required />
              </div>
              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>Date</label>
                  <input type="date" style={S.inp} value={invoiceForm.date} onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label style={S.lbl}>Payment Terms</label>
                  <input style={S.inp} value={invoiceForm.paymentTerms} onChange={e => setInvoiceForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="Cash/Bank Transfer" />
                </div>
              </div>

              <div>
                <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={S.lbl}>Line Items</label>
                  <button type="button" onClick={addInvoiceItem} style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 12, padding: '4px 10px' }}><Plus size={13} /> Add Row</button>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Service</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Amount (₱)</span>
                    <span />
                  </div>
                  {invoiceForm.items.map((item) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 8px', alignItems: 'center' }}>
                      <input style={{ ...S.inp, background: 'transparent', border: 'none', padding: '6px 8px', fontSize: 13 }} value={item.service} onChange={e => updInvoiceItem(item.id, 'service', e.target.value)} placeholder="Description" required />
                      <input type="number" min="0" step="0.01" style={{ ...S.inp, background: 'transparent', border: 'none', padding: '6px 8px', fontSize: 13, textAlign: 'right' }} value={item.amount} onChange={e => updInvoiceItem(item.id, 'amount', e.target.value)} placeholder="0" required />
                      <button type="button" onClick={() => removeInvoiceItem(item.id)} disabled={invoiceForm.items.length === 1} style={{ ...S.btn, padding: 4, background: 'none', color: '#f87171', opacity: invoiceForm.items.length === 1 ? 0.3 : 1 }}><X size={14} /></button>
                    </div>
                  ))}
                  <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 }}>Total</span>
                    <span style={{ color: '#ff9a4a', fontSize: 16, fontWeight: 700, textAlign: 'right' }}>₱{fmt(invoiceFormTotal)}</span>
                    <span />
                  </div>
                </div>
              </div>

              <div>
                <label style={S.lbl}>Prepared By</label>
                <input style={S.inp} value={invoiceForm.preparedBy} onChange={e => setInvoiceForm(f => ({ ...f, preparedBy: e.target.value }))} placeholder="e.g. Johnjosefir Roca" />
              </div>

              <div>
                <label style={S.lbl}>Notes (Optional)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 70 }} value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" />
              </div>

              <div>
                <label style={S.lbl}>QR Code on Invoice</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  {[{ id: 'gotyme', label: 'GoTyme', img: '/images/jetchgotyme.png' }, { id: 'maribank', label: 'MariBank', img: '/images/jetchmaribank.png' }].map(({ id, label, img }) => {
                    const active = (invoiceForm.qrCodes || []).includes(id);
                    const toggle = () => setInvoiceForm(f => ({ ...f, qrCodes: active ? (f.qrCodes || []).filter(q => q !== id) : [...(f.qrCodes || []), id] }));
                    return (
                      <button key={id} type="button" onClick={toggle} style={{ ...S.btn, flexDirection: 'column', gap: 6, padding: '10px 14px', background: active ? 'rgba(255,106,26,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? 'rgba(255,106,26,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, color: active ? '#ff9a4a' : 'rgba(255,255,255,0.4)', minWidth: 90 }}>
                        <img src={img} alt={label} style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover', opacity: active ? 1 : 0.4 }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 10 }}>{active ? '✓ Included' : 'Excluded'}</span>
                      </button>
                    );
                  })}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    <button type="button" onClick={() => setInvoiceForm(f => ({ ...f, qrCodes: ['gotyme', 'maribank'] }))} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '6px 10px' }}>Both</button>
                    <button type="button" onClick={() => setInvoiceForm(f => ({ ...f, qrCodes: [] }))} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '6px 10px' }}>None</button>
                  </div>
                </div>
              </div>

              <LoadingButton type="submit" loading={savingInvoice} loadingLabel="Generating invoice…" style={{ ...S.btn, background: savingInvoice ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: savingInvoice ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 4 }}>
                Generate Invoice
              </LoadingButton>
            </form>
          </div>
        </>
      )}

      {/* MASTERLIST DETAIL DRAWER */}
      {showMastDetail && detailClient && (
        <>
          <div onClick={() => setShowMastDetail(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div className="mast-drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 450, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{detailClient.name}</h3>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Building2 size={12} /> {detailClient.business || 'N/A'}
                </div>
              </div>
              <button onClick={() => setShowMastDetail(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            {(() => {
              const s = MAST_STATUS_COLORS[detailClient.projectStatus || 'ongoing'];
              const contract = Number(detailClient.contractTotal || 0);
              const collected = getClientCollected(detailClient);
              const pct = contract > 0 ? Math.min(100, Math.round((collected / contract) * 100)) : 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Status & Dates */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={S.lbl}>Project Status</div>
                      <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                        {s.label}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={S.lbl}>Start Date</div>
                        <div style={{ color: '#fff', fontSize: 14 }}>{fmtDateStr(detailClient.projectStartDate)}</div>
                      </div>
                      {detailClient.launchDate && (
                        <div>
                          <div style={S.lbl}>Launch Target</div>
                          <div style={{ color: '#a78bfa', fontSize: 14 }}>{fmtDateStr(detailClient.launchDate)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={S.lbl}>Contract Value</div>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>₱{contract.toLocaleString('en-PH')}</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Collected (₱{collected.toLocaleString('en-PH')})</span>
                        <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#34d399' : 'linear-gradient(90deg, #ff6a1a, #ff9a4a)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Remaining Balance</span>
                      <span style={{ fontSize: 14, color: '#f87171', fontWeight: 700 }}>₱{(contract - collected).toLocaleString('en-PH')}</span>
                    </div>
                  </div>

                  {/* Installment Timeline */}
                  {detailClient.paymentScheme !== 'full' && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                      <div style={{ ...S.lbl, marginBottom: 16 }}>Payment Timeline</div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Downpayment Row */}
                        {detailClient.downpaymentAmount > 0 && (
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ marginTop: 2, color: detailClient.downpaymentPaid ? '#34d399' : '#fbbf24' }}>
                              {detailClient.downpaymentPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Downpayment</span>
                                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>₱{Number(detailClient.downpaymentAmount).toLocaleString('en-PH')}</span>
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                                {detailClient.downpaymentPaid ? 'Paid' : `Due: ${fmtDateStr(detailClient.downpaymentDate)}`}
                              </div>
                              {!detailClient.downpaymentPaid && (
                                <button onClick={() => quickMarkDownpayment(detailClient, true)} style={{ ...S.btn, marginTop: 8, background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 11, padding: '4px 10px' }}>Mark Paid</button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Installments Rows */}
                        {(detailClient.installments || []).map((inst, idx) => (
                          <div key={inst.id} style={{ display: 'flex', gap: 12 }}>
                            <div style={{ marginTop: 2, color: inst.status === 'paid' ? '#34d399' : inst.status === 'overdue' ? '#f87171' : '#fbbf24' }}>
                              {inst.status === 'paid' ? <CheckCircle2 size={16} /> : inst.status === 'overdue' ? <AlertCircle size={16} /> : <Clock size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{inst.label || `Installment ${idx + 1}`}</span>
                                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>₱{Number(inst.amount).toLocaleString('en-PH')}</span>
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, display: 'flex', gap: 8 }}>
                                <span>{inst.status === 'paid' ? `Paid on ${fmtDateStr(inst.paidDate)}` : `Due: ${fmtDateStr(inst.dueDate)}`}</span>
                                {inst.paymentMethod && <span>• {inst.paymentMethod}</span>}
                              </div>
                              {inst.status !== 'paid' && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                  <button onClick={() => quickMarkInstallment(detailClient, inst.id, 'paid')} style={{ ...S.btn, background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 11, padding: '4px 10px' }}>Mark Paid</button>
                                  {inst.status !== 'overdue' && (
                                    <button onClick={() => quickMarkInstallment(detailClient, inst.id, 'overdue')} style={{ ...S.btn, background: 'rgba(248,113,113,0.15)', color: '#f87171', fontSize: 11, padding: '4px 10px' }}>Mark Overdue</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailClient.projectNotes && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                      <div style={S.lbl}>Project Notes</div>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {detailClient.projectNotes}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { setShowMastDetail(false); openMastEdit(detailClient); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '12px 0', justifyContent: 'center', fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(255,106,26,0.3)' }}>
                    Edit Masterlist Data
                  </button>

                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* MASTERLIST EDIT SIDEBAR */}
      {showMastEdit && detailClient && (
        <>
          <div onClick={() => setShowMastEdit(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div className="mast-drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Masterlist Info</h3>
              <button onClick={() => setShowMastEdit(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveMastEdit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Section 1: Project Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ color: '#fff', fontSize: 15, margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>1. Project Information</h4>

                <div>
                  <label style={S.lbl}>Project Status</label>
                  <select style={{ ...S.inp, cursor: 'pointer' }} value={mastEditForm.projectStatus} onChange={e => setMastEditForm(f => ({ ...f, projectStatus: e.target.value }))}>
                    <option value="ongoing" style={{ background: '#0f1218' }}>🟢 Ongoing</option>
                    <option value="completed" style={{ background: '#0f1218' }}>🔵 Completed</option>
                    <option value="pending_launch" style={{ background: '#0f1218' }}>🟣 Pending Launch</option>
                    <option value="pending_contract" style={{ background: '#0f1218' }}>🟡 Pending Contract</option>
                    <option value="on_hold" style={{ background: '#0f1218' }}>🟠 On Hold</option>
                    <option value="cancelled" style={{ background: '#0f1218' }}>🔴 Cancelled</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={S.lbl}>Project Type</label>
                    <select
                      style={{ ...S.inp, cursor: 'pointer', marginBottom: mastCustomTypeOpen ? 8 : 0 }}
                      value={mastCustomTypeOpen ? '__custom__' : (mastEditForm.projectType || '')}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setMastCustomTypeOpen(true);
                          setMastEditForm(f => ({ ...f, projectType: '' }));
                        } else {
                          setMastCustomTypeOpen(false);
                          setMastEditForm(f => ({ ...f, projectType: e.target.value }));
                        }
                      }}
                    >
                      <option value="" style={{ background: '#0f1218' }}>Select Type</option>
                      {uniqueProjectTypes.map(t => <option key={t} value={t} style={{ background: '#0f1218' }}>{t}</option>)}
                      <option value="__custom__" style={{ background: '#0f1218' }}>+ Other (Custom Type)...</option>
                    </select>
                    {mastCustomTypeOpen && (
                      <input
                        style={S.inp}
                        placeholder="Type custom project type..."
                        value={mastEditForm.projectType}
                        onChange={e => setMastEditForm(f => ({ ...f, projectType: e.target.value }))}
                        autoFocus
                      />
                    )}
                  </div>
                  <div>
                    <label style={S.lbl}>Project Tags</label>
                    <input list="dynamic-project-tags" style={S.inp} placeholder="e.g. React, E-commerce" value={mastEditForm.projectTags} onChange={e => setMastEditForm(f => ({ ...f, projectTags: e.target.value }))} />
                    <datalist id="dynamic-project-tags">
                      {uniqueProjectTags.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={S.lbl}>Start Date</label>
                    <input type="date" style={S.inp} value={mastEditForm.projectStartDate} onChange={e => setMastEditForm(f => ({ ...f, projectStartDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>Est. End Date</label>
                    <input type="date" style={S.inp} value={mastEditForm.projectEndDate} onChange={e => setMastEditForm(f => ({ ...f, projectEndDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>Launch Target</label>
                    <input type="date" style={S.inp} value={mastEditForm.launchDate} onChange={e => setMastEditForm(f => ({ ...f, launchDate: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={S.lbl}>Project Notes</label>
                  <textarea style={{ ...S.inp, minHeight: 80, resize: 'vertical' }} placeholder="Additional context..." value={mastEditForm.projectNotes} onChange={e => setMastEditForm(f => ({ ...f, projectNotes: e.target.value }))} />
                </div>
              </div>

              {/* Section 2: Financials */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ color: '#fff', fontSize: 15, margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>2. Financials & Payment Scheme</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={S.lbl}>Contract Total (₱)</label>
                    <input type="number" style={S.inp} placeholder="0.00" value={mastEditForm.contractTotal} onChange={e => setMastEditForm(f => ({ ...f, contractTotal: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>Payment Scheme</label>
                    <select style={{ ...S.inp, cursor: 'pointer' }} value={mastEditForm.paymentScheme} onChange={e => setMastEditForm(f => ({ ...f, paymentScheme: e.target.value }))}>
                      <option value="full" style={{ background: '#0f1218' }}>One-Time Payment</option>
                      <option value="installment" style={{ background: '#0f1218' }}>Installment Schedule</option>
                      <option value="downpayment_balance" style={{ background: '#0f1218' }}>Downpayment + Balance</option>
                      <option value="partnership" style={{ background: '#0f1218' }}>Partnership</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, alignItems: 'end' }}>
                  <div>
                    <label style={S.lbl}>{(mastEditForm.paymentScheme === 'full' || mastEditForm.paymentScheme === 'partnership') ? 'Payment Amount (₱)' : 'Downpayment (₱)'}</label>
                    <input type="number" style={S.inp} placeholder="0.00" value={mastEditForm.downpaymentAmount} onChange={e => setMastEditForm(f => ({ ...f, downpaymentAmount: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>{(mastEditForm.paymentScheme === 'full' || mastEditForm.paymentScheme === 'partnership') ? 'Payment Date' : 'DP Due Date'}</label>
                    <input type="date" style={S.inp} value={mastEditForm.downpaymentDate} onChange={e => setMastEditForm(f => ({ ...f, downpaymentDate: e.target.value }))} />
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={mastEditForm.downpaymentPaid} onChange={e => setMastEditForm(f => ({ ...f, downpaymentPaid: e.target.checked }))} style={{ width: 16, height: 16 }} />
                      Paid
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 3: Installments */}
              {mastEditForm.paymentScheme !== 'full' && mastEditForm.paymentScheme !== 'partnership' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                    <h4 style={{ color: '#fff', fontSize: 15, margin: 0 }}>3. Installments / Milestones</h4>
                    <button type="button" onClick={() => setMastEditForm(f => ({ ...f, installments: [...f.installments, { id: crypto.randomUUID(), label: '', amount: '', dueDate: '', status: 'pending', paidDate: '', paymentMethod: '' }] }))} style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 11, padding: '4px 10px' }}><Plus size={12} /> Add Installment</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {mastEditForm.installments.map((inst, idx) => (
                      <div key={inst.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>INSTALLMENT {idx + 1}</span>
                          <button type="button" onClick={() => setMastEditForm(f => ({ ...f, installments: f.installments.filter(i => i.id !== inst.id) }))} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={14} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <input style={S.inp} placeholder="Label (e.g. Milestone 1)" value={inst.label} onChange={e => {
                            const v = e.target.value;
                            setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, label: v } : i) }));
                          }} />
                          <input type="number" style={S.inp} placeholder="Amount (₱)" value={inst.amount} onChange={e => {
                            const v = e.target.value;
                            setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, amount: v } : i) }));
                          }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <div style={{ ...S.lbl, fontSize: 10 }}>Due Date</div>
                            <input type="date" style={S.inp} value={inst.dueDate} onChange={e => {
                              const v = e.target.value;
                              setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, dueDate: v } : i) }));
                            }} />
                          </div>
                          <div>
                            <div style={{ ...S.lbl, fontSize: 10 }}>Status</div>
                            <select style={{ ...S.inp, cursor: 'pointer' }} value={inst.status} onChange={e => {
                              const v = e.target.value;
                              setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, status: v } : i) }));
                            }}>
                              <option value="pending">⏳ Pending</option>
                              <option value="paid">✅ Paid</option>
                              <option value="overdue">🔴 Overdue</option>
                            </select>
                          </div>
                        </div>
                        {inst.status === 'paid' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            <div>
                              <div style={{ ...S.lbl, fontSize: 10 }}>Date Paid</div>
                              <input type="date" style={S.inp} value={inst.paidDate} onChange={e => {
                                const v = e.target.value;
                                setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, paidDate: v } : i) }));
                              }} />
                            </div>
                            <div>
                              <div style={{ ...S.lbl, fontSize: 10 }}>Method</div>
                              <input style={S.inp} placeholder="e.g. GoTyme" value={inst.paymentMethod || ''} onChange={e => {
                                const v = e.target.value;
                                setMastEditForm(f => ({ ...f, installments: f.installments.map(i => i.id === inst.id ? { ...i, paymentMethod: v } : i) }));
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <LoadingButton type="submit" loading={savingMast} loadingLabel="Saving…" style={{ ...S.btn, background: savingMast ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: savingMast ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                Save Masterlist Record
              </LoadingButton>
            </form>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .client-row:hover { background: rgba(255,255,255,0.06) !important; }
        .billing-row:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>
    </div>
  );
}
