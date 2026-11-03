import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  History,
  ShieldAlert,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  GitCompare,
  Plus,
  Trash2,
  DollarSign
} from 'lucide-react';

export default function OCRReview({ invoiceId, onBackToList }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerMode, setViewerMode] = useState('pdf'); // 'pdf' | 'preview'
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // 3-Way Matching state embedded directly in the bill review
  const [matchingResult, setMatchingResult] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // General Field Edit Modal State (Vendor, Currency, Invoice #, Date, PO)
  const [editModal, setEditModal] = useState({ open: false, field_name: '', old_value: '', label: '' });
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Line Item Edit & Create Modal State
  const [itemModal, setItemModal] = useState({
    open: false,
    isNew: false,
    item_id: null,
    description: '',
    quantity: '1.000',
    unit_price: '0.00'
  });
  const [submittingItem, setSubmittingItem] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceDetails(invoiceId);
    } else {
      loadLatestInvoice();
    }
    loadMasterData();
  }, [invoiceId]);

  const loadLatestInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.getInvoices();
      const list = res.data.results ? res.data.results : res.data;
      if (Array.isArray(list) && list.length > 0) {
        await loadInvoiceDetails(list[0].id);
      } else {
        setInvoice(null);
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to load invoice');
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const [vRes, pRes] = await Promise.all([
        api.getVendors().catch(() => ({ data: [] })),
        api.getPurchaseOrders().catch(() => ({ data: [] }))
      ]);
      setVendors(Array.isArray(vRes.data?.results) ? vRes.data.results : (Array.isArray(vRes.data) ? vRes.data : []));
      setPurchaseOrders(Array.isArray(pRes.data?.results) ? pRes.data.results : (Array.isArray(pRes.data) ? pRes.data : []));
    } catch (e) {
      console.warn('Could not fetch master data', e);
    }
  };

  const loadInvoiceDetails = async (id) => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getInvoice(id);
      setInvoice(res.data);
      if (res.data.file_url) {
        setViewerMode('pdf');
      } else {
        setViewerMode('preview');
      }

      // Automatically evaluate match if invoice has a linked PO
      if (res.data.po) {
        runMatchEvaluation(id);
      } else {
        setMatchingResult(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const runMatchEvaluation = async (invId = invoice?.id) => {
    if (!invId) return;
    try {
      setMatchingLoading(true);
      const res = await api.evaluateMatch(invId, 1.0);
      setMatchingResult(res.data);
    } catch (err) {
      console.warn('Matching evaluation error:', err);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleOverrideMatch = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('Mandatory justification reason is required to authorize variance.');
      return;
    }
    try {
      await api.overrideMatch(invoice.id, overrideReason);
      setShowOverrideModal(false);
      setOverrideReason('');
      await loadInvoiceDetails(invoice.id);
      await runMatchEvaluation(invoice.id);
      alert('Discrepancy authorized! Invoice marked as MATCH_PASSED.');
    } catch (err) {
      alert(err.response?.data?.error || 'Override failed');
    }
  };

  const handleRouteToApproval = async () => {
    try {
      await api.initiateApproval(invoice.id);
      alert('Invoice successfully routed to the Manager Approval Matrix!');
      await loadInvoiceDetails(invoice.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not initiate approval');
    }
  };

  const openEditModal = (fieldName, currentValue, label) => {
    setEditModal({ open: true, field_name: fieldName, old_value: currentValue, label: label || fieldName });
    setEditValue(currentValue != null ? String(currentValue) : '');
    setEditReason('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editReason.trim()) {
      alert('Mandatory explanation reason is required for every edit.');
      return;
    }

    try {
      setSubmittingEdit(true);
      await api.editInvoiceField(invoice.id, {
        field_name: editModal.field_name,
        new_value: editValue,
        reason: editReason
      });
      setEditModal({ open: false, field_name: '', old_value: '', label: '' });
      await loadInvoiceDetails(invoice.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update field');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Line Item Management Handlers
  const openItemEditModal = (item) => {
    setItemModal({
      open: true,
      isNew: false,
      item_id: item.id,
      description: item.description,
      quantity: String(parseFloat(item.quantity || 1)),
      unit_price: String(parseFloat(item.unit_price || 0))
    });
  };

  const openAddItemModal = () => {
    setItemModal({
      open: true,
      isNew: true,
      item_id: null,
      description: '',
      quantity: '1.000',
      unit_price: '0.00'
    });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemModal.description.trim()) {
      alert('Item description is required.');
      return;
    }

    try {
      setSubmittingItem(true);
      if (itemModal.isNew) {
        await api.addLineItem(invoice.id, {
          description: itemModal.description.trim(),
          quantity: itemModal.quantity,
          unit_price: itemModal.unit_price,
          reason: 'Added missing line item to invoice.'
        });
      } else {
        await api.editLineItem(invoice.id, {
          item_id: itemModal.item_id,
          description: itemModal.description.trim(),
          quantity: itemModal.quantity,
          unit_price: itemModal.unit_price,
          reason: 'Corrected line item description / quantity / unit price.'
        });
      }
      setItemModal({ open: false, isNew: false, item_id: null, description: '', quantity: '1.000', unit_price: '0.00' });
      await loadInvoiceDetails(invoice.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save line item');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteItem = async (itemId, desc) => {
    if (!window.confirm(`Are you sure you want to delete this line item?\n\n"${desc || 'Item'}"`)) {
      return;
    }

    try {
      await api.deleteLineItem(invoice.id, itemId, `Removed redundant or mis-extracted line item: ${desc}`);
      await loadInvoiceDetails(invoice.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete line item');
    }
  };

  // Helper for dynamic currency symbol ($ / € / £ / ₹)
  const getCurrencySymbol = (curr) => {
    switch (curr?.toUpperCase()) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '₹';
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading Bill Workspace...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-12 text-center space-y-3 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">Unable to Load Invoice</h3>
        <p className="text-xs text-rose-600">{error || 'No invoice selected'}</p>
        <button
          onClick={onBackToList}
          className="mt-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
        >
          ← Return to Bills Ledger
        </button>
      </div>
    );
  }

  const sym = getCurrencySymbol(invoice.currency);
  const items = invoice.items || [];
  const changeLogs = invoice.change_logs || [];
  const confidencePct = Math.round(parseFloat(invoice.ocr_confidence_score || 0) * 100);

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-4 font-sans text-slate-800">
      {/* Zoho-Style Breadcrumbs & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToList}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Bills</span>
          </button>
          <span className="text-slate-300">/</span>
          <h1 className="text-base font-bold text-slate-900">
            Bill #{invoice.invoice_number}
          </h1>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            invoice.status === 'PAID'
              ? 'bg-emerald-100 text-emerald-800'
              : invoice.status === 'PENDING_APPROVAL'
              ? 'bg-amber-100 text-amber-800'
              : invoice.status === 'MATCH_PASSED'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-slate-100 text-slate-700'
          }`}>
            {invoice.status_display || invoice.status}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {changeLogs.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Trail ({changeLogs.length})</span>
            </button>
          )}

          {invoice.po && (
            <button
              onClick={() => runMatchEvaluation(invoice.id)}
              disabled={matchingLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{matchingLoading ? 'Verifying...' : 'Re-Run 3-Way Match'}</span>
            </button>
          )}

          <button
            onClick={handleRouteToApproval}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            Route for Approval
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace (Zoho Books Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Document Preview (5 of 12 columns) */}
        <div className="lg:col-span-5 bg-slate-900 rounded-xl p-3 shadow-md flex flex-col h-[820px]">
          {/* Document Header Toolbar (Clean, NO technical SHA-256 jargon) */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-xs text-white">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200 text-xs">Original Bill Document</span>
              <span className="text-[11px] text-emerald-400 font-mono">
                • {confidencePct}% OCR
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="bg-slate-800 p-0.5 rounded-lg flex text-[10px]">
                <button
                  onClick={() => setViewerMode('pdf')}
                  className={`px-2 py-1 rounded transition-colors ${viewerMode === 'pdf' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Document
                </button>
                <button
                  onClick={() => setViewerMode('preview')}
                  className={`px-2 py-1 rounded transition-colors ${viewerMode === 'preview' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Text Form
                </button>
              </div>

              {invoice.file_url && (
                <a
                  href={invoice.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-indigo-100 text-[11px] font-semibold flex items-center space-x-1 bg-indigo-950/60 px-2 py-1 rounded border border-indigo-800/80"
                  title="Open file in a full browser tab"
                >
                  <span>↗ Full View</span>
                </a>
              )}
            </div>
          </div>

          {/* Document Body */}
          <div className="flex-1 mt-2.5 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex flex-col relative">
            {viewerMode === 'pdf' && invoice.file_url ? (
              <div className="w-full h-full bg-white relative">
                <iframe
                  src={invoice.file_url}
                  title="Source PDF"
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              /* Clean Structured Form View */
              <div className="w-full h-full bg-white text-slate-900 p-6 overflow-y-auto font-sans text-xs">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {invoice.vendor_details?.name || 'SuperStore'}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{invoice.vendor_details?.address_line || 'Commercial Supplier'}</p>
                    {invoice.vendor_details?.gstin && (
                      <p className="text-[11px] font-mono text-slate-500">GSTIN: {invoice.vendor_details.gstin}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">TAX INVOICE</span>
                    <p className="font-mono font-bold text-sm text-slate-900 mt-1">#{invoice.invoice_number}</p>
                    <p className="text-[11px] text-slate-500">Date: {invoice.invoice_date || 'N/A'}</p>
                  </div>
                </div>

                <div className="py-4 text-[11px] border-b border-slate-100 flex justify-between">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Customer / Billed To:</span>
                    <p className="font-bold text-slate-800">Aaron Hawkins</p>
                    <p className="text-slate-500">Templegate Accounts Department</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Linked PO:</span>
                    <p className="font-mono font-bold text-indigo-700">{invoice.po_details?.po_number || 'Unlinked'}</p>
                  </div>
                </div>

                <table className="w-full text-left my-4 text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 font-medium text-slate-800 whitespace-pre-line">{it.description}</td>
                        <td className="py-2.5 text-center font-mono font-semibold">{parseFloat(it.quantity || 0)}</td>
                        <td className="py-2.5 text-right font-mono">{sym}{parseFloat(it.unit_price || 0).toFixed(2)}</td>
                        <td className="py-2.5 text-right font-mono font-bold">{sym}{parseFloat(it.line_total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-slate-200 pt-3 space-y-1.5 text-right text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{sym}{parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax / Shipping:</span>
                    <span className="font-mono font-semibold">{sym}{parseFloat(invoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Grand Total:</span>
                    <span className="font-mono text-indigo-700">{sym}{parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Zoho Books Editable Bill Form & Integrated 3-Way Match (7 of 12 columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 h-[820px] overflow-y-auto">
          {/* Section 1: Header / Vendor & Currency Details (Zoho Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            {/* Vendor Name Field */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
                <span>VENDOR NAME</span>
                <button
                  onClick={() => openEditModal('vendor_id', invoice.vendor, 'Vendor Supplier')}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span className="text-[10px]">Change</span>
                </button>
              </div>
              <p className="font-bold text-sm text-slate-900 mt-1">{invoice.vendor_details?.name || 'Unassigned Vendor'}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {invoice.vendor_details?.vendor_code || 'VEND-EXTRACTED'}
              </p>
            </div>

            {/* Currency Selector Field */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
                <span>BILL CURRENCY</span>
                <button
                  onClick={() => openEditModal('currency', invoice.currency, 'Bill Currency')}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span className="text-[10px]">Change</span>
                </button>
              </div>
              <p className="font-bold text-sm text-indigo-700 mt-1 flex items-center space-x-1">
                <span>{invoice.currency || 'USD'}</span>
                <span className="text-slate-400 font-normal">({sym})</span>
              </p>
              <p className="text-[11px] text-slate-500">Auto-detected from document symbols</p>
            </div>

            {/* Bill Number */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
                <span>BILL / INVOICE #</span>
                <button
                  onClick={() => openEditModal('invoice_number', invoice.invoice_number, 'Invoice Number')}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
              <p className="font-mono font-bold text-sm text-slate-900 mt-1">{invoice.invoice_number}</p>
            </div>

            {/* Bill Date */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
                <span>BILL DATE</span>
                <button
                  onClick={() => openEditModal('invoice_date', invoice.invoice_date, 'Invoice Date')}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
              <p className="font-bold text-sm text-slate-900 mt-1">{invoice.invoice_date || 'Missing'}</p>
            </div>
          </div>

          {/* Section 2: Line Items Table (Zoho Books Grid with Edit + Delete Row) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Line Items ({items.length})
              </h3>
              <button
                onClick={openAddItemModal}
                className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Item & Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate ({sym})</th>
                    <th className="py-2.5 px-3 text-right">Amount ({sym})</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50 group">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="whitespace-pre-line leading-relaxed">{it.description}</div>
                        {it.hsn_sac_code && (
                          <span className="text-[10px] text-slate-400 font-mono">HSN: {it.hsn_sac_code}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {parseFloat(it.quantity || 0)} {it.uom || ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {sym}{parseFloat(it.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {sym}{parseFloat(it.line_total || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Edit Item Button */}
                          <button
                            onClick={() => openItemEditModal(it)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded hover:bg-indigo-50"
                            title="Edit this item"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete Item Button (Trash can) */}
                          <button
                            onClick={() => handleDeleteItem(it.id, it.description)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                            title="Delete this line row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No line items available. Click "+ Add Line Item" above to add.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Summary & Grand Total Card */}
          <div className="flex justify-end pt-1">
            <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">{sym}{parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax / Shipping:</span>
                <span className="font-mono font-semibold">{sym}{parseFloat(invoice.tax_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700 text-base">{sym}{parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Integrated 3-Way PO & GRN Match (Embedded in this Workspace!) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  3-Way PO & Delivery Cross Check
                </h3>
              </div>

              <button
                onClick={() => openEditModal('po_id', invoice.po, 'Linked Purchase Order')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>{invoice.po ? 'Change PO' : 'Link Purchase Order'}</span>
              </button>
            </div>

            {invoice.po ? (
              <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 font-semibold text-[11px]">Linked PO Reference:</span>
                    <p className="font-mono font-bold text-indigo-700 text-sm">{invoice.po_details?.po_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold text-[11px]">Match Status:</span>
                    <div className="mt-0.5">
                      {matchingResult?.status === 'MATCH_PASSED' ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>3-Way Match Passed (Zero Variance)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Match Evaluation: {matchingResult?.status || 'Pending Verification'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {matchingResult?.item_matching_details && (
                  <div className="pt-2 border-t border-slate-100">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-slate-500 border-b pb-1 text-[10px]">
                          <th>Item</th>
                          <th className="text-center">PO Qty</th>
                          <th className="text-center">Delivered (GRN)</th>
                          <th className="text-center">Billed Qty</th>
                          <th className="text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingResult.item_matching_details.map((m, idx) => (
                          <tr key={idx} className="border-b border-slate-50">
                            <td className="py-1 font-medium">{m.description}</td>
                            <td className="py-1 text-center font-mono">{m.po_qty}</td>
                            <td className="py-1 text-center font-mono text-indigo-600 font-bold">{m.grn_accepted_qty}</td>
                            <td className="py-1 text-center font-mono font-bold">{m.invoice_qty}</td>
                            <td className="py-1 text-right font-mono">
                              <span className={m.variance_pct > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}>
                                {m.variance_pct > 0 ? `+${m.variance_pct}%` : '0.0%'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {matchingResult?.status && matchingResult.status !== 'MATCH_PASSED' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setShowOverrideModal(true)}
                      className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-sm"
                    >
                      Authorize Discrepancy (Manager Override)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-3 text-xs text-slate-500 border border-dashed border-slate-300 flex items-center justify-between">
                <span>No Purchase Order linked to this invoice. Direct bill without 2-way/3-way verification.</span>
                <button
                  onClick={() => openEditModal('po_id', null, 'Link Purchase Order')}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded"
                >
                  + Link PO
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Item Edit & Create Modal */}
      {itemModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {itemModal.isNew ? 'Add New Line Item' : 'Edit Line Item'}
              </h3>
              <button
                onClick={() => setItemModal({ open: false, isNew: false, item_id: null, description: '', quantity: '1.000', unit_price: '0.00' })}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Item Description & SKU <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. EcoTones Memo Sheets - Paper, Office Supplies, OFF-PA-4014"
                  value={itemModal.description}
                  onChange={(e) => setItemModal({ ...itemModal, description: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={itemModal.quantity}
                    onChange={(e) => setItemModal({ ...itemModal, quantity: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Rate ({sym})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={itemModal.unit_price}
                    onChange={(e) => setItemModal({ ...itemModal, unit_price: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-indigo-950">Line Total:</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  {sym}{(parseFloat(itemModal.quantity || 0) * parseFloat(itemModal.unit_price || 0)).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModal({ open: false, isNew: false, item_id: null, description: '', quantity: '1.000', unit_price: '0.00' })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingItem ? 'Saving...' : 'Save Line Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* General Header Edit Modal (Vendor, Currency, Dates, PO) */}
      {editModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit: <span className="text-indigo-600">{editModal.label}</span>
              </h3>
              <button
                onClick={() => setEditModal({ open: false, field_name: '', old_value: '', label: '' })}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Field 1: Currency Selector */}
              {editModal.field_name === 'currency' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Select Currency</label>
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  >
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                  </select>
                </div>
              ) : editModal.field_name === 'vendor_id' ? (
                /* Field 2: Vendor Selector */
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Choose Supplier / Vendor</label>
                  <select
                    value={vendors.some(v => v.id === editValue) ? editValue : (editValue ? 'CUSTOM' : '')}
                    onChange={(e) => {
                      if (e.target.value !== 'CUSTOM') {
                        setEditValue(e.target.value);
                      } else {
                        setEditValue('');
                      }
                    }}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">-- Select Existing Supplier --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
                    ))}
                    <option value="CUSTOM">➕ Type Custom Vendor Name...</option>
                  </select>
                  {!vendors.some(v => v.id === editValue) && (
                    <input
                      type="text"
                      placeholder="Type supplier name (e.g. SuperStore)..."
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    />
                  )}
                </div>
              ) : editModal.field_name === 'po_id' ? (
                /* Field 3: PO Selector */
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Select Purchase Order to Link</label>
                  <select
                    value={editValue || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">-- No PO / Unlinked Direct Bill --</option>
                    {purchaseOrders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.po_number} ({p.vendor_details?.name || 'Vendor'} - {sym}{p.total_amount})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Field 4: Standard Value */
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">New Value</label>
                  <input
                    type="text"
                    required
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Explanation / Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the reason for this edit..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, field_name: '', old_value: '', label: '' })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Authorize 3-Way Match Discrepancy</h3>
            <p className="text-xs text-slate-500">
              Provide an audit justification to accept variance between the Purchase Order and the Invoiced amounts.
            </p>
            <form onSubmit={handleOverrideMatch} className="space-y-3">
              <textarea
                required
                rows={3}
                placeholder="State the business justification for approving this variance..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  Confirm & Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit History Drawer / Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Audit Trail: Bill #{invoice.invoice_number}</span>
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {changeLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{log.field_name}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-2 font-mono text-[11px]">
                    <span className="text-rose-600 line-through">Old: {log.old_value || 'None'}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 font-bold">New: {log.new_value}</span>
                  </div>
                  <p className="text-slate-600 italic">"{log.reason}"</p>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                    By: {log.user_display || 'User'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
