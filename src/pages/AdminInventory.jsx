import { useState, useEffect, useCallback, useMemo } from 'react';
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
  serverTimestamp
} from 'firebase/firestore';
import {
  Package,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Search,
  UserCheck,
  ArrowRightLeft,
  Trash,
  ShoppingBag,
  Info,
  Calendar,
  History,
  PlusCircle,
  MapPin,
  ClipboardList,
  User,
  AlertCircle,
  Printer
} from 'lucide-react';

const uuid = () => Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);

const S = {
  card: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: '20px 24px'
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
    transition: 'all 0.2s'
  },
  inp: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  },
  lbl: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6
  },
  badge: {
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4
  }
};

const CATEGORIES = ["Consumables", "Equipment", "Office Supplies", "Hardware", "Others"];

const getActionColor = (action) => {
  switch (action) {
    case 'Create': return { bg: 'rgba(52, 211, 153, 0.1)', color: '#34d399', text: 'Stock Created' };
    case 'Restock': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', text: 'Restocked' };
    case 'Issue': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', text: 'Issued' };
    case 'Transfer': return { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', text: 'Transferred' };
    case 'Waste': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Wasted/Consumed' };
    case 'Sold': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'Sold' };
    default: return { bg: 'rgba(255, 255, 255, 0.1)', color: '#ccc', text: action };
  }
};

export default function AdminInventory({ firebaseUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Drawer states
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Forms states
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Item form
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'Consumables',
    sku: '',
    totalQuantity: '',
    unit: 'pcs',
    location: 'Main Warehouse',
    notes: ''
  });

  // Action Drawer State
  // Type can be: 'issue' | 'transfer' | 'waste' | 'sold' | 'restock'
  const [actionType, setActionType] = useState(null);
  const [actionForm, setActionForm] = useState({
    quantity: 1,
    accountablePerson: '',
    targetAccountablePerson: '',
    location: '',
    notes: '',
    selectedIssuanceId: '', // For transfers, wastes, and sales from issuances
    sourceType: 'warehouse' // 'warehouse' or 'issuance'
  });

  // Load Inventory
  const loadInventory = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'inventory'), orderBy('name', 'asc')));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Firestore read error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInventory(false);
  }, [loadInventory]);

  // Compute overall stats dynamically
  const stats = useMemo(() => {
    let totalUnique = items.length;
    let totalInWarehouse = 0;
    let totalIssued = 0;
    let totalWasted = 0;
    let totalSold = 0;

    items.forEach(item => {
      totalInWarehouse += Number(item.totalQuantity || 0);
      
      const issuancesSum = (item.issuances || []).reduce((acc, iss) => acc + Number(iss.quantity || 0), 0);
      totalIssued += issuancesSum;

      // Extract waste/sold sums from history
      (item.history || []).forEach(h => {
        if (h.action === 'Waste') {
          totalWasted += Number(h.quantity || 0);
        } else if (h.action === 'Sold') {
          totalSold += Number(h.quantity || 0);
        }
      });
    });

    return { totalUnique, totalInWarehouse, totalIssued, totalWasted, totalSold };
  }, [items]);

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Format Date Helper
  const fmtDateTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Add Item Submit Handler
  const handleAddItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const q = Number(addForm.totalQuantity);
      if (isNaN(q) || q < 0) {
        throw new Error("Quantity must be a positive number.");
      }

      const initialHistory = [{
        id: uuid(),
        action: 'Create',
        timestamp: new Date().toISOString(),
        quantity: q,
        accountablePerson: '',
        fromLocation: '',
        toLocation: addForm.location,
        notes: addForm.notes || 'Initial stock intake',
        performedBy: firebaseUser.email
      }];

      const payload = {
        name: addForm.name,
        category: addForm.category,
        sku: addForm.sku || 'N/A',
        totalQuantity: q,
        unit: addForm.unit || 'pcs',
        location: addForm.location || 'Main Warehouse',
        notes: addForm.notes || '',
        issuances: [],
        history: initialHistory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: firebaseUser.email
      };

      await addDoc(collection(db, 'inventory'), payload);
      setShowAddDrawer(false);
      setAddForm({
        name: '',
        category: 'Consumables',
        sku: '',
        totalQuantity: '',
        unit: 'pcs',
        location: 'Main Warehouse',
        notes: ''
      });
      loadInventory();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  };

  // Generic Inventory Update Function
  const updateItemInFirestore = async (itemId, updatedData) => {
    try {
      const docRef = doc(db, 'inventory', itemId);
      await updateDoc(docRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });
      
      // Update local state to prevent a full page reload if possible, but reload after actions to ensure Firestore consistency
      loadInventory(false);
      
      // Update selectedItem view if open
      setItems(prev => {
        const index = prev.findIndex(item => item.id === itemId);
        if (index > -1) {
          const updatedItem = { ...prev[index], ...updatedData };
          if (selectedItem && selectedItem.id === itemId) {
            setSelectedItem(updatedItem);
          }
        }
        return prev;
      });
    } catch (err) {
      console.error("Error updating document: ", err);
      alert("Failed to save changes to Firestore.");
    }
  };

  // Perform Inventory Actions (Issue, Transfer, Waste, Sold, Restock)
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSaving(true);
    setErrorMsg('');

    try {
      const q = Number(actionForm.quantity);
      if (isNaN(q) || q <= 0) {
        throw new Error("Quantity must be greater than 0.");
      }

      let updatedQuantity = Number(selectedItem.totalQuantity || 0);
      let updatedIssuances = [...(selectedItem.issuances || [])];
      let updatedHistory = [...(selectedItem.history || [])];

      const newActionId = uuid();
      const nowString = new Date().toISOString();

      if (actionType === 'restock') {
        updatedQuantity += q;
        updatedHistory.unshift({
          id: newActionId,
          action: 'Restock',
          timestamp: nowString,
          quantity: q,
          accountablePerson: '',
          fromLocation: '',
          toLocation: actionForm.location || selectedItem.location,
          notes: actionForm.notes || 'Restocked warehouse inventory',
          performedBy: firebaseUser.email
        });
      }
      else if (actionType === 'issue') {
        if (q > updatedQuantity) {
          throw new Error(`Insufficient stock in warehouse. Only ${updatedQuantity} ${selectedItem.unit} available.`);
        }

        updatedQuantity -= q;
        
        // Add to active issuances
        updatedIssuances.push({
          id: newActionId,
          accountablePerson: actionForm.accountablePerson,
          quantity: q,
          location: actionForm.location || 'On Person',
          notes: actionForm.notes || '',
          issuedAt: nowString
        });

        // Add to history
        updatedHistory.unshift({
          id: newActionId,
          action: 'Issue',
          timestamp: nowString,
          quantity: q,
          accountablePerson: actionForm.accountablePerson,
          fromLocation: selectedItem.location,
          toLocation: actionForm.location || 'On Person',
          notes: actionForm.notes || `Issued to ${actionForm.accountablePerson}`,
          performedBy: firebaseUser.email
        });
      }
      else if (actionType === 'transfer') {
        const issIndex = updatedIssuances.findIndex(iss => iss.id === actionForm.selectedIssuanceId);
        if (issIndex === -1) throw new Error("Source issuance accountability record not found.");

        const sourceIss = updatedIssuances[issIndex];
        if (q > sourceIss.quantity) {
          throw new Error(`Cannot transfer ${q} ${selectedItem.unit}. Active holder only has ${sourceIss.quantity}.`);
        }

        // Deduct from source issuance
        const sourceName = sourceIss.accountablePerson;
        const sourceLoc = sourceIss.location;

        if (q === sourceIss.quantity) {
          updatedIssuances.splice(issIndex, 1);
        } else {
          updatedIssuances[issIndex] = {
            ...sourceIss,
            quantity: sourceIss.quantity - q
          };
        }

        // Add to/update target issuance
        const existingTargetIndex = updatedIssuances.findIndex(
          iss => iss.accountablePerson.toLowerCase() === actionForm.targetAccountablePerson.toLowerCase() &&
                 iss.location.toLowerCase() === (actionForm.location || 'On Person').toLowerCase()
        );

        if (existingTargetIndex > -1) {
          updatedIssuances[existingTargetIndex] = {
            ...updatedIssuances[existingTargetIndex],
            quantity: updatedIssuances[existingTargetIndex].quantity + q
          };
        } else {
          updatedIssuances.push({
            id: newActionId,
            accountablePerson: actionForm.targetAccountablePerson,
            quantity: q,
            location: actionForm.location || 'On Person',
            notes: actionForm.notes || `Transferred from ${sourceName}`,
            issuedAt: nowString
          });
        }

        // Add to history
        updatedHistory.unshift({
          id: newActionId,
          action: 'Transfer',
          timestamp: nowString,
          quantity: q,
          accountablePerson: actionForm.targetAccountablePerson,
          fromLocation: `From: ${sourceName} (${sourceLoc})`,
          toLocation: actionForm.location || 'On Person',
          notes: actionForm.notes || `Transferred custody from ${sourceName} to ${actionForm.targetAccountablePerson}`,
          performedBy: firebaseUser.email
        });
      }
      else if (actionType === 'waste') {
        if (actionForm.sourceType === 'warehouse') {
          if (q > updatedQuantity) throw new Error(`Insufficient stock in warehouse to waste. Only ${updatedQuantity} available.`);
          updatedQuantity -= q;

          updatedHistory.unshift({
            id: newActionId,
            action: 'Waste',
            timestamp: nowString,
            quantity: q,
            accountablePerson: '',
            fromLocation: selectedItem.location,
            toLocation: 'Waste/Discarded',
            notes: actionForm.notes || 'Damaged/Wasted from warehouse',
            performedBy: firebaseUser.email
          });
        } else {
          const issIndex = updatedIssuances.findIndex(iss => iss.id === actionForm.selectedIssuanceId);
          if (issIndex === -1) throw new Error("Accountability record not found.");

          const targetIss = updatedIssuances[issIndex];
          if (q > targetIss.quantity) throw new Error(`Cannot waste ${q} units. Holder only has ${targetIss.quantity}.`);

          const holderName = targetIss.accountablePerson;
          const holderLoc = targetIss.location;

          if (q === targetIss.quantity) {
            updatedIssuances.splice(issIndex, 1);
          } else {
            updatedIssuances[issIndex] = {
              ...targetIss,
              quantity: targetIss.quantity - q
            };
          }

          updatedHistory.unshift({
            id: newActionId,
            action: 'Waste',
            timestamp: nowString,
            quantity: q,
            accountablePerson: holderName,
            fromLocation: `Held by: ${holderName} (${holderLoc})`,
            toLocation: 'Waste/Consumed',
            notes: actionForm.notes || `Wasted/Consumed during issuance custody by ${holderName}`,
            performedBy: firebaseUser.email
          });
        }
      }
      else if (actionType === 'sold') {
        if (actionForm.sourceType === 'warehouse') {
          if (q > updatedQuantity) throw new Error(`Insufficient stock in warehouse to sell. Only ${updatedQuantity} available.`);
          updatedQuantity -= q;

          updatedHistory.unshift({
            id: newActionId,
            action: 'Sold',
            timestamp: nowString,
            quantity: q,
            accountablePerson: '',
            fromLocation: selectedItem.location,
            toLocation: 'Sold/Delivered',
            notes: actionForm.notes || 'Sold directly from warehouse',
            performedBy: firebaseUser.email
          });
        } else {
          const issIndex = updatedIssuances.findIndex(iss => iss.id === actionForm.selectedIssuanceId);
          if (issIndex === -1) throw new Error("Accountability record not found.");

          const targetIss = updatedIssuances[issIndex];
          if (q > targetIss.quantity) throw new Error(`Cannot sell ${q} units. Holder only has ${targetIss.quantity}.`);

          const holderName = targetIss.accountablePerson;
          const holderLoc = targetIss.location;

          if (q === targetIss.quantity) {
            updatedIssuances.splice(issIndex, 1);
          } else {
            updatedIssuances[issIndex] = {
              ...targetIss,
              quantity: targetIss.quantity - q
            };
          }

          updatedHistory.unshift({
            id: newActionId,
            action: 'Sold',
            timestamp: nowString,
            quantity: q,
            accountablePerson: holderName,
            fromLocation: `Held by: ${holderName} (${holderLoc})`,
            toLocation: 'Sold/Custody Settled',
            notes: actionForm.notes || `Sold and settled from ${holderName}'s custody`,
            performedBy: firebaseUser.email
          });
        }
      }

      // Save changes to Firestore
      await updateItemInFirestore(selectedItem.id, {
        totalQuantity: updatedQuantity,
        issuances: updatedIssuances,
        history: updatedHistory
      });

      // Reset action mode
      setActionType(null);
      setActionForm({
        quantity: 1,
        accountablePerson: '',
        targetAccountablePerson: '',
        location: '',
        notes: '',
        selectedIssuanceId: '',
        sourceType: 'warehouse'
      });

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Entire Item Handler
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you absolutely sure you want to delete ${item.name}? This will delete all stock, active issuances, and custody history permanently.`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', item.id));
      setSelectedItem(null);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Failed to delete item.");
    }
  };

  // Preset Action helper
  const openActionForm = (type, issuance = null) => {
    setActionType(type);
    setErrorMsg('');
    if (issuance) {
      setActionForm({
        quantity: issuance.quantity,
        accountablePerson: issuance.accountablePerson,
        targetAccountablePerson: '',
        location: issuance.location,
        notes: '',
        selectedIssuanceId: issuance.id,
        sourceType: 'issuance'
      });
    } else {
      setActionForm({
        quantity: 1,
        accountablePerson: '',
        targetAccountablePerson: '',
        location: type === 'restock' ? selectedItem?.location : '',
        notes: '',
        selectedIssuanceId: '',
        sourceType: 'warehouse'
      });
    }
  };

  const handlePrintSticker = (item, issuance) => {
    const printWindow = window.open('', '_blank', 'width=600,height=500');
    if (!printWindow) {
      alert("Please allow popups to print the property tag sticker.");
      return;
    }
    const dateStr = new Date(issuance.issuedAt).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    
    // Construct details URL that can be scanned to directly view the item
    const detailsUrl = `${window.location.origin}/odc/inventory?id=${item.id}`;

    const html = `
      <html>
        <head>
          <title>Property Tag - ${item.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body {
              margin: 0;
              padding: 20px;
              font-family: 'Inter', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            .tag-container {
              width: 380px;
              height: 240px;
              border: 2px solid #000;
              border-radius: 8px;
              padding: 14px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #fff;
              color: #000;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #000;
              padding-bottom: 4px;
            }
            .header-title {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .header-logo {
              font-size: 11px;
              font-weight: 800;
              background: #000;
              color: #fff;
              padding: 2px 6px;
              border-radius: 3px;
            }
            .main-body {
              display: flex;
              flex: 1;
              margin-top: 10px;
              gap: 10px;
            }
            .details-side {
              flex: 1.8;
              display: flex;
              flex-direction: column;
              gap: 3px;
              min-width: 0;
            }
            .item-name {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .field {
              display: flex;
              font-size: 10px;
            }
            .label {
              font-weight: 700;
              width: 75px;
              text-transform: uppercase;
              color: #444;
              flex-shrink: 0;
            }
            .value {
              font-weight: 600;
              flex: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .qr-side {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-left: 1px dashed #ccc;
              padding-left: 10px;
            }
            .qr-image {
              width: 85px;
              height: 85px;
            }
            .qr-caption {
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              margin-top: 4px;
              letter-spacing: 0.05em;
              color: #555;
            }
            .footer {
              border-top: 1px solid #000;
              padding-top: 4px;
              text-align: center;
            }
            .warning {
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            @media print {
              body {
                padding: 0;
              }
              .tag-container {
                border: 2px solid #000;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="tag-container">
            <div class="header">
              <span class="header-title">Property Asset Tag</span>
              <span class="header-logo">ODC</span>
            </div>
            
            <div class="main-body">
              <div class="details-side">
                <div class="item-name">${item.name}</div>
                <div class="field">
                  <span class="label">Category:</span>
                  <span class="value">${item.category}</span>
                </div>
                <div class="field">
                  <span class="label">Custodian:</span>
                  <span class="value">${issuance.accountablePerson}</span>
                </div>
                <div class="field">
                  <span class="label">Location:</span>
                  <span class="value">${issuance.location}</span>
                </div>
                <div class="field">
                  <span class="label">Issued:</span>
                  <span class="value">${dateStr}</span>
                </div>
                <div class="field">
                  <span class="label">SKU/Serial:</span>
                  <span class="value">${item.sku || 'N/A'}</span>
                </div>
              </div>
              
              <div class="qr-side">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(detailsUrl)}" class="qr-image" alt="QR Code" />
                <span class="qr-caption">Scan to View</span>
              </div>
            </div>
            
            <div class="footer">
              <span class="warning">Warning: Property of ODC - Do Not Remove</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Title Bar */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={22} color="#ff6a1a" /> Inventory & Accountability
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => loadInventory()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => { setErrorMsg(''); setShowAddDrawer(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Tracked Items', value: stats.totalUnique, color: '#ff9a4a', desc: 'Distinct catalog models' },
          { label: 'Warehouse Stock', value: stats.totalInWarehouse, color: '#34d399', desc: 'Units ready for issuance' },
          { label: 'Active Custody / Issued', value: stats.totalIssued, color: '#60a5fa', desc: 'Units assigned to persons' },
          { label: 'Wasted / Consumed', value: stats.totalWasted, color: '#f87171', desc: 'Aggregated loss/usage log' },
          { label: 'Sales Cleared', value: stats.totalSold, color: '#fbbf24', desc: 'Total units sold' },
        ].map(({ label, value, color, desc }) => (
          <div key={label} style={{ ...S.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 6, fontStyle: 'italic' }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Toolbar Filter / Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search inventory by name, SKU/serial, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...S.inp, paddingLeft: 40 }}
          />
        </div>
        
        {/* Category filtering buttons */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {['All', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...S.btn,
                background: selectedCategory === cat ? 'rgba(255, 106, 26, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selectedCategory === cat ? '#ff6a1a' : 'rgba(255,255,255,0.08)'}`,
                color: selectedCategory === cat ? '#ff9a4a' : 'rgba(255,255,255,0.6)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stock Inventory Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} />
          <p>Loading inventory logs...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
          No inventory items matched the criteria. Create one using the 'Add Item' button.
        </div>
      ) : (
        <div className="admin-table-card" style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Item Details</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Category</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Warehouse Stock</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Issued Custody</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Storage Location</th>
                <th style={{ padding: '16px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const issuedCount = (item.issuances || []).reduce((acc, curr) => acc + curr.quantity, 0);
                return (
                  <tr key={item.id} className="inventory-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9a4a', flexShrink: 0 }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                            SKU/Serial: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.sku || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <span style={{
                        ...S.badge,
                        background: item.category === 'Consumables' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(255,255,255,0.06)',
                        color: item.category === 'Consumables' ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                        border: `1px solid ${item.category === 'Consumables' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.1)'}`
                      }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: item.totalQuantity > 0 ? '#34d399' : 'rgba(255,68,68,0.7)' }}>
                        {item.totalQuantity} <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{item.unit}</span>
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      {issuedCount > 0 ? (
                        <span style={{
                          ...S.badge,
                          background: 'rgba(96, 165, 250, 0.15)',
                          color: '#60a5fa',
                          border: '1px solid rgba(96,165,250,0.3)',
                          fontWeight: 600
                        }}>
                          {issuedCount} {item.unit} out
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} color="rgba(255,255,255,0.4)" /> {item.location}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setSelectedItem(item)}
                          style={{
                            ...S.btn,
                            background: 'rgba(255,106,26,0.1)',
                            border: '1px solid rgba(255,106,26,0.2)',
                            color: '#ff9a4a',
                            fontSize: 12,
                            padding: '6px 12px'
                          }}
                        >
                          <Info size={13} /> View Details
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          style={{
                            ...S.btn,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.15)',
                            color: '#f87171',
                            padding: 6
                          }}
                          title="Delete Catalog Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE NEW ITEM SIDEBAR/DRAWER */}
      {showAddDrawer && (
        <>
          <div onClick={() => setShowAddDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={20} color="#ff6a1a" /> Add Catalog Item
              </h3>
              <button onClick={() => setShowAddDrawer(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Item Name *</label>
                <input style={S.inp} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Paper Rolls" required />
              </div>
              
              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Category *</label>
                  <select
                    style={{ ...S.inp, height: 42, appearance: 'none', background: 'rgba(255,255,255,0.06)' }}
                    value={addForm.category}
                    onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat} style={{ background: '#0f1218' }}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>SKU / Serial (Optional)</label>
                  <input style={S.inp} value={addForm.sku} onChange={e => setAddForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. PR-80MM" />
                </div>
              </div>

              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Initial Stock Quantity *</label>
                  <input type="number" min="0" style={S.inp} value={addForm.totalQuantity} onChange={e => setAddForm(f => ({ ...f, totalQuantity: e.target.value }))} placeholder="e.g. 50" required />
                </div>
                <div>
                  <label style={S.lbl}>Unit *</label>
                  <input style={S.inp} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. rolls, pcs, boxes" required />
                </div>
              </div>

              <div>
                <label style={S.lbl}>Default Storage Location</label>
                <input style={S.inp} value={addForm.location} onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Warehouse, Shelf B" />
              </div>

              <div>
                <label style={S.lbl}>Intake Notes / Description</label>
                <textarea
                  style={{ ...S.inp, height: 80, resize: 'none' }}
                  value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional context on procurement or storage"
                />
              </div>

              <button type="submit" disabled={saving || !addForm.name || addForm.totalQuantity === ''} style={{ ...S.btn, background: (saving || !addForm.name || addForm.totalQuantity === '') ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                {saving ? 'Registering Entry...' : 'Register Item'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* VIEW ITEM DETAILS & HISTORY DRAWER */}
      {selectedItem && !actionType && (
        <>
          <div onClick={() => setSelectedItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 700, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: '24px 32px' }}>
            
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...S.badge, background: 'rgba(255,106,26,0.1)', color: '#ff9a4a', border: '1px solid rgba(255,106,26,0.25)' }}>
                    {selectedItem.category}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>SKU: {selectedItem.sku}</span>
                </div>
                <h3 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>{selectedItem.name}</h3>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> Storage Location: {selectedItem.location}
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            {/* Quick Metrics */}
            <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={{ background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.1)', borderRadius: 12, padding: 14 }}>
                <span style={{ display: 'block', color: 'rgba(52, 211, 153, 0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Warehouse (Available)</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#34d399', display: 'block', marginTop: 4 }}>
                  {selectedItem.totalQuantity} <span style={{ fontSize: 13, fontWeight: 400 }}>{selectedItem.unit}</span>
                </span>
              </div>
              <div style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.1)', borderRadius: 12, padding: 14 }}>
                <span style={{ display: 'block', color: 'rgba(96, 165, 250, 0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Active Custody (Issued)</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa', display: 'block', marginTop: 4 }}>
                  {(selectedItem.issuances || []).reduce((acc, c) => acc + c.quantity, 0)} <span style={{ fontSize: 13, fontWeight: 400 }}>{selectedItem.unit}</span>
                </span>
              </div>
            </div>

            {/* General Warehouse Custody Management Panel */}
            <div style={{ ...S.card, marginBottom: 28, background: 'rgba(255, 255, 255, 0.02)', padding: '16px 20px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)' }}>Warehouse Actions</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => openActionForm('issue')} disabled={selectedItem.totalQuantity <= 0} style={{ ...S.btn, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', fontSize: 12, opacity: selectedItem.totalQuantity <= 0 ? 0.5 : 1 }}>
                  <UserCheck size={14} /> Issue Stock
                </button>
                <button onClick={() => openActionForm('restock')} style={{ ...S.btn, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', fontSize: 12 }}>
                  <PlusCircle size={14} /> Restock
                </button>
                <button onClick={() => openActionForm('waste')} disabled={selectedItem.totalQuantity <= 0} style={{ ...S.btn, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 12, opacity: selectedItem.totalQuantity <= 0 ? 0.5 : 1 }}>
                  <Trash size={14} /> Waste Stock
                </button>
                <button onClick={() => openActionForm('sold')} disabled={selectedItem.totalQuantity <= 0} style={{ ...S.btn, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', fontSize: 12, opacity: selectedItem.totalQuantity <= 0 ? 0.5 : 1 }}>
                  <ShoppingBag size={14} /> Mark as Sold
                </button>
              </div>
            </div>

            {/* Active Custodians Section */}
            <div style={{ marginBottom: 28 }}>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={16} color="#ff6a1a" /> Active Accountability Records
              </h4>

              {(!selectedItem.issuances || selectedItem.issuances.length === 0) ? (
                <div style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                  No active issuances. All units are currently in the storage warehouse.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedItem.issuances.map((iss) => (
                    <div key={iss.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontWeight: 600, fontSize: 11 }}>
                              <User size={12} />
                            </div>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{iss.accountablePerson}</span>
                            <span style={{ ...S.badge, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontWeight: 700 }}>
                              {iss.quantity} {selectedItem.unit}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={10} /> {iss.location}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={10} /> {fmtDateTime(iss.issuedAt)}
                            </div>
                          </div>
                          {iss.notes && (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: 4 }}>
                              "{iss.notes}"
                            </div>
                          )}
                        </div>

                        {/* Custody Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handlePrintSticker(selectedItem, iss)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', padding: '5px 10px', fontSize: 11 }}>
                            <Printer size={11} /> Print Tag
                          </button>
                          <button onClick={() => openActionForm('transfer', iss)} style={{ ...S.btn, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c084fc', padding: '5px 10px', fontSize: 11 }}>
                            <ArrowRightLeft size={11} /> Transfer
                          </button>
                          <button onClick={() => openActionForm('waste', iss)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '5px 10px', fontSize: 11 }}>
                            <Trash size={11} /> Waste
                          </button>
                          <button onClick={() => openActionForm('sold', iss)} style={{ ...S.btn, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbbf24', padding: '5px 10px', fontSize: 11 }}>
                            <ShoppingBag size={11} /> Sold
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custody History & Activity Logs */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={16} color="#ff6a1a" /> Custody History & Logs
              </h4>

              {(!selectedItem.history || selectedItem.history.length === 0) ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 13 }}>No history logs recorded.</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 20, borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {selectedItem.history.map((log) => {
                    const actConfig = getActionColor(log.action);
                    return (
                      <div key={log.id} style={{ position: 'relative' }}>
                        {/* Timeline Node Point */}
                        <div style={{
                          position: 'absolute',
                          left: -25,
                          top: 4,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: actConfig.color,
                          boxShadow: `0 0 8px ${actConfig.color}`
                        }} />

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              ...S.badge,
                              background: actConfig.bg,
                              color: actConfig.color,
                              border: `1px solid ${actConfig.color}40`,
                              fontWeight: 600,
                              fontSize: 10
                            }}>
                              {actConfig.text}
                            </span>
                            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                              {log.quantity} {selectedItem.unit}
                            </span>
                            {log.accountablePerson && (
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                &rarr; Custodian: <strong style={{ color: '#fff' }}>{log.accountablePerson}</strong>
                              </span>
                            )}
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginLeft: 'auto' }}>
                              {fmtDateTime(log.timestamp)}
                            </span>
                          </div>

                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {(log.fromLocation || log.toLocation) && (
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                                {log.fromLocation ? `${log.fromLocation} ` : ''} &rarr; <span style={{ color: '#ff9a4a' }}>{log.toLocation}</span>
                              </div>
                            )}
                            {log.notes && (
                              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                                "{log.notes}"
                              </div>
                            )}
                            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>
                              Logged by: {log.performedBy || 'System'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* CUSTODY ACTION FORM MODAL (Issue, Transfer, Waste, Sold, Restock) */}
      {actionType && selectedItem && (
        <>
          <div onClick={() => setActionType(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 110 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: 480, background: '#0f1218', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, zIndex: 111, padding: 28, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            {/* Modal Header */}
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
                {actionType === 'issue' && <UserCheck size={18} color="#60a5fa" />}
                {actionType === 'transfer' && <ArrowRightLeft size={18} color="#c084fc" />}
                {actionType === 'waste' && <Trash size={18} color="#f87171" />}
                {actionType === 'sold' && <ShoppingBag size={18} color="#fbbf24" />}
                {actionType === 'restock' && <PlusCircle size={18} color="#34d399" />}
                {actionType} Custody Action: {selectedItem.name}
              </h3>
              <button onClick={() => setActionType(null)} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: 6 }}><X size={15} /></button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Context helper text */}
              {actionForm.selectedIssuanceId && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  Source: Custody of <strong>{actionForm.accountablePerson}</strong> ({actionForm.location})
                </div>
              )}

              {/* Quantity */}
              <div>
                <label style={S.lbl}>Quantity to {actionType} ({selectedItem.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  max={
                    actionType === 'restock' 
                      ? undefined 
                      : (actionForm.selectedIssuanceId 
                          ? (selectedItem.issuances.find(iss => iss.id === actionForm.selectedIssuanceId)?.quantity || 1)
                          : selectedItem.totalQuantity)
                  }
                  style={S.inp}
                  value={actionForm.quantity}
                  onChange={e => setActionForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                  required
                />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, display: 'block' }}>
                  {actionType === 'restock' 
                    ? 'Adds directly to available warehouse stock'
                    : `Available: ${actionForm.selectedIssuanceId 
                        ? (selectedItem.issuances.find(iss => iss.id === actionForm.selectedIssuanceId)?.quantity || 0) 
                        : selectedItem.totalQuantity} ${selectedItem.unit}`
                  }
                </span>
              </div>

              {/* Issue fields */}
              {actionType === 'issue' && (
                <div>
                  <label style={S.lbl}>Accountable Custodian Name *</label>
                  <input
                    style={S.inp}
                    value={actionForm.accountablePerson}
                    onChange={e => setActionForm(f => ({ ...f, accountablePerson: e.target.value }))}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
              )}

              {/* Transfer fields */}
              {actionType === 'transfer' && (
                <div>
                  <label style={S.lbl}>New Accountable Custodian Name *</label>
                  <input
                    style={S.inp}
                    value={actionForm.targetAccountablePerson}
                    onChange={e => setActionForm(f => ({ ...f, targetAccountablePerson: e.target.value }))}
                    placeholder="e.g. Jane Smith"
                    required
                  />
                </div>
              )}

              {/* Location (Issue, Restock, Transfer) */}
              {(actionType === 'issue' || actionType === 'restock' || actionType === 'transfer') && (
                <div>
                  <label style={S.lbl}>
                    {actionType === 'restock' ? 'Warehouse Stocking Location' : 'Destination Custody Location *'}
                  </label>
                  <input
                    style={S.inp}
                    value={actionForm.location}
                    onChange={e => setActionForm(f => ({ ...f, location: e.target.value }))}
                    placeholder={actionType === 'restock' ? 'e.g. Warehouse Shelf A' : 'e.g. Front Reception Desk'}
                    required={actionType !== 'restock'}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={S.lbl}>
                  {actionType === 'waste' ? 'Reason / Details for Waste *' : actionType === 'sold' ? 'Sales / Price Details *' : 'Transaction Notes'}
                </label>
                <textarea
                  style={{ ...S.inp, height: 70, resize: 'none' }}
                  value={actionForm.notes}
                  onChange={e => setActionForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={
                    actionType === 'waste' ? "Describe why item is wasted (e.g. Used up 1 roll for customers, Water damage)"
                    : actionType === 'sold' ? "e.g. Sold unit to client XYZ for PHP 250"
                    : "Add notes about this inventory movement"
                  }
                  required={actionType === 'waste' || actionType === 'sold'}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', flex: 1, justifyContent: 'center', height: 42 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...S.btn,
                    background: actionType === 'waste' ? 'rgba(239,68,68,0.8)'
                              : actionType === 'sold' ? 'rgba(245,158,11,0.8)'
                              : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)',
                    color: '#fff',
                    flex: 2,
                    justifyContent: 'center',
                    fontWeight: 600,
                    height: 42
                  }}
                >
                  {saving ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>

          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .inventory-row:hover { background: rgba(255, 255, 255, 0.06) !important; }
      `}</style>
    </div>
  );
}
