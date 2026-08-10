import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { secondaryAuth } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { 
  Plus, X, Trash2, RefreshCw, Users, Mail, Building2, 
  CreditCard, Edit2, Calendar, Check, Minus, Search, 
  FileText, Clock, AlertCircle, CheckCircle2, ChevronRight, Settings,
  MessageSquare, Star, Copy, Link
} from 'lucide-react';

const CO = {
  address: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City',
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

const getNextMonthDueDate = (currentDueDateStr, billingDay) => {
  const current = new Date(currentDueDateStr + 'T00:00:00');
  let nextYear = current.getFullYear();
  let nextMonth = current.getMonth() + 1;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
};

const DEFAULT_PLANS = [
  { name: 'Basic Care Plan', price: '₱1,500' },
  { name: 'Standard Care Plan', price: '₱3,500' },
  { name: 'Premium Continuous Improvement', price: '₱7,500' }
];

export default function AdminClients({ firebaseUser }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  
  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState('directory'); // 'directory' | 'billing' | 'feedback'
  const [feedbacks, setFeedbacks] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalClientId, setLinkModalClientId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

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
    if (!window.confirm("Are you sure you want to delete this feedback submission? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'clientFeedback', id));
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete feedback.");
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
      alert('Error saving billing details: ' + err.message);
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

  // Triggers the invoice creation modal pre-populated with default client billing data
  const handleOpenGenerateInvoice = (client) => {
    if (!client.billingType || !client.billingRate) {
      alert('Configure billing settings first.');
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
      alert(`Invoice ${invoiceNumber} successfully created! View it in the "Invoices & Finance" tab.`);
      setShowInvoiceSidebar(false);
      load();
    } catch (err) {
      console.error('Error generating invoice:', err);
      alert('Invoice generation failed: ' + err.message);
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
    if (!window.confirm(`Delete record for ${client.name}? Note: This only removes them from this list, it does not delete their Firebase Auth account.`)) return;
    await deleteDoc(doc(db, 'clients', client.id));
    setClients(prev => prev.filter(c => c.id !== client.id));
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

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Header Row */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Client Management</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => load()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {activeSubTab === 'feedback' ? (
            <button onClick={() => { setLinkModalClientId(clients[0]?.id || ''); setCopiedLink(false); setShowLinkModal(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Link size={16} /> Get Feedback Link
            </button>
          ) : (
            <button onClick={() => { setForm({ name: '', business: '', email: '', password: '' }); setCreatePortalAccount(false); setBillingSetup(false); setErrorMsg(''); setShowSidebar(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> New Client
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Subtabs */}
      <div className="admin-tabs-wrapper" style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
        {[
          { id: 'directory', label: 'Client Directory', count: clients.length, Icon: Users },
          { id: 'billing', label: 'Billing Tracker', count: activeBillingClients.length, Icon: CreditCard },
          { id: 'feedback', label: 'Client Feedback', count: feedbacks.length, Icon: MessageSquare }
        ].map(subTab => {
          const Icon = subTab.Icon;
          return (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id)}
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
                          <button onClick={() => openEditBilling(client)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Configure Billing">
                            <Settings size={14} /> Configure Billing
                          </button>
                          <button onClick={() => handleDelete(client)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete Record">
                            <Trash2 size={14} />
                          </button>
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
                              <button onClick={() => handleAdjustBookings(client, -1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                                <Minus size={12} />
                              </button>
                              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                                {client.currentBookingsCount || 0}
                              </span>
                              <button onClick={() => handleAdjustBookings(client, 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                                <Plus size={12} />
                              </button>
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
                            <button onClick={() => openEditBilling(client)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: 8 }} title="Billing Configurations">
                              <Settings size={14} />
                            </button>
                            {client.billingType && (
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    <button onClick={() => handleDeleteFeedback(f.id)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '6px 12px' }}>
                      <Trash2 size={13} /> Delete Review
                    </button>
                  </div>
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

              <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                {saving ? 'Registering Client…' : 'Register Client'}
              </button>
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

              <button 
                type="submit" 
                disabled={savingBilling} 
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
                {savingBilling ? 'Saving Billing Info...' : 'Save Configuration'}
              </button>
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

              <button type="submit" disabled={savingInvoice} style={{ ...S.btn, background: savingInvoice ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: savingInvoice ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 4 }}>
                {savingInvoice ? 'Generating Invoice…' : 'Generate Invoice'}
              </button>
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
