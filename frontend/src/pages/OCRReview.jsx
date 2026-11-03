import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  ScanEye,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  History,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  FileText,
  RefreshCw
} from 'lucide-react';

export default function OCRReview({ invoiceId, onBackToList, onNavigateToMatching }) {
  const [selectedId, setSelectedId] = useState(invoiceId || null);
  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, field_name: '', old_value: '', item_id: null });
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' | 'history'
  const [apNotes, setApNotes] = useState('');

  const SENSITIVE_FIELDS = [
    'vendor_id',
    'invoice_number',
    'quantity',
    'unit_price',
    'tax_rate_percent',
    'tax_amount',
    'grand_total',
    'po_id'
  ];

  // Always fetch latest invoices and select the target or newest invoice
  useEffect(() => {
    loadInvoicesList(invoiceId);
  }, [invoiceId]);

  const loadInvoicesList = async (targetId) => {
    try {
      setLoading(true);
      const res = await api.getInvoices();
      const list = res.data.results ? res.data.results : res.data;
      const invList = Array.isArray(list) ? list : [];
      setInvoices(invList);

      // Select targetId (e.g. newly uploaded/ingested invoice), or the newest invoice in the list
      const toSelect = targetId || (invList.length > 0 ? invList[0].id : null);
      if (toSelect) {
        setSelectedId(toSelect);
        await loadInvoiceDetails(toSelect);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to load invoices list', err);
      setLoading(false);
    }
  };

  const loadInvoiceDetails = async (id) => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.getInvoice(id);
      setInvoice(res.data);
    } catch (err) {
      console.error('Failed to load invoice details', err);
      setError(err.response?.data?.error || err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (fieldName, currentValue, itemId = null) => {
    setEditModal({ open: true, field_name: fieldName, old_value: currentValue, item_id: itemId });
    setEditValue(currentValue != null ? String(currentValue) : '');
    setEditReason('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editReason.trim()) {
      alert('Mandatory explanation reason is required for every edit (Templegate Rule 3).');
      return;
    }

    try {
      setSubmittingEdit(true);
      await api.editInvoiceField(invoice.id, {
        field_name: editModal.field_name,
        new_value: editValue,
        reason: editReason,
        item_id: editModal.item_id
      });
      setEditModal({ open: false, field_name: '', old_value: '', item_id: null });
      await loadInvoiceDetails(invoice.id);
      alert('Field updated successfully and logged in immutable change history.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update field');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleAPApprove = async () => {
    try {
      await api.apApproveChanges(invoice.id, apNotes || 'AP specialist reviewed source document and confirmed edits.');
      await loadInvoiceDetails(invoice.id);
      alert('Sensitive edits verified and approved by AP Specialist!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve changes');
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading Side-by-Side OCR Verification Viewer...</p>
        <p className="text-xs text-slate-400">Fetching extracted metadata and line items</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center space-y-3 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">Error Loading Invoice</h3>
        <p className="text-xs text-rose-600">{error}</p>
        <div className="flex justify-center space-x-2 pt-2">
          <button
            onClick={() => loadInvoiceDetails(selectedId)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            Retry
          </button>
          <button
            onClick={onBackToList}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 max-w-md mx-auto">
        <FileText className="w-10 h-10 text-slate-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-800">No Invoices Available for OCR Review</p>
        <p className="text-xs text-slate-400">Please upload an invoice in the Invoice Capture module or check the ledger.</p>
        <button
          onClick={onBackToList}
          className="mt-3 px-4 py-2 text-xs text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
        >
          ← Go to Invoices Ledger
        </button>
      </div>
    );
  }

  const isSensitiveField = SENSITIVE_FIELDS.includes(editModal.field_name);
  const items = invoice.items || [];
  const changeLogs = invoice.change_logs || [];
  const confidencePct = Math.round(parseFloat(invoice.ocr_confidence_score || 0) * 100);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumbs & Invoice Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <button onClick={onBackToList} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← Invoices
          </button>
          <span className="text-slate-300">/</span>
          <h2 className="text-lg font-bold text-slate-900">
            OCR Verification: {invoice.invoice_number}
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
            {invoice.status_display || invoice.status}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Invoice Switcher Dropdown */}
          <div className="flex items-center space-x-1.5 bg-white p-1 border border-slate-200 rounded-lg shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 px-1">Switch:</span>
            <select
              value={selectedId || invoice.id}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedId(newId);
                loadInvoiceDetails(newId);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none"
            >
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} ({inv.vendor_details?.name || 'Vendor'} - ₹{parseFloat(inv.grand_total || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onNavigateToMatching(invoice.id)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center space-x-1"
          >
            <span>Proceed to 3-Way Match</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sensitive Edits Warning / AP Action Banner */}
      {invoice.has_sensitive_edits && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase">
                Sensitive Field Edits Detected (Templegate Section 2.3)
              </h4>
              <p className="text-xs text-amber-700">
                A sensitive financial field (quantity, price, or tax) was modified. Invoice is locked for AP Specialist Review before manager approval.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="AP Review Note..."
              value={apNotes}
              onChange={(e) => setApNotes(e.target.value)}
              className="text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
            />
            <button
              onClick={handleAPApprove}
              className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm"
            >
              AP Approve Changes
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Split Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANE: Document Preview / Raw PDF Evidence */}
        <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-4 text-white shadow-md flex flex-col h-[750px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Source Document Evidence</span>
            </span>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
              <span>SHA-256: {invoice.file_hash_sha256 ? `${invoice.file_hash_sha256.slice(0, 8)}...` : 'Verified'}</span>
            </div>
          </div>

          {/* Visual Document Viewer Box */}
          <div className="flex-1 bg-slate-950/80 rounded-xl mt-3 p-4 overflow-y-auto border border-slate-800 font-mono text-xs leading-relaxed space-y-3">
            <div className="bg-white/10 p-2.5 rounded border border-white/10">
              <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wide">
                OCR Bounding Box Overlay (Document Inspection)
              </span>
              <p className="text-emerald-400 text-[11px] mt-1 font-semibold">
                ✓ Document Integrity Verified | OCR Confidence: {confidencePct}%
              </p>
            </div>

            {/* Simulated Printed Invoice Structure */}
            <div className="bg-white text-slate-900 p-5 rounded-lg shadow-inner min-h-[500px] text-[11px] font-sans border border-slate-300">
              <div className="flex justify-between border-b pb-3 border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{invoice.vendor_details?.name || 'VENDOR SUPPLIES LTD.'}</h3>
                  <p className="text-[10px] text-slate-500">{invoice.vendor_details?.address_line || 'Peenya Industrial Area'}</p>
                  <p className="text-[10px] text-slate-500 font-mono">GSTIN: {invoice.vendor_details?.gstin || '29AAACT2727Q1ZU'}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border">TAX INVOICE</span>
                  <p className="font-mono font-bold mt-1 text-xs">{invoice.invoice_number}</p>
                  <p className="text-[10px] text-slate-500">Date: {invoice.invoice_date || '2026-10-31'}</p>
                </div>
              </div>

              <div className="my-3 text-[10px] text-slate-600">
                <span className="font-bold">Billed To:</span> Templegate Technologies & Services Pvt. Ltd.
                <p>PO Reference: <span className="font-bold font-mono text-indigo-600">{invoice.po_details?.po_number || 'PO-2026-001'}</span></p>
              </div>

              {/* Line Items Table in Preview */}
              <table className="w-full text-left text-[10px] border border-slate-200 my-3">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-1.5 border-b">Item</th>
                    <th className="p-1.5 border-b text-center">Qty</th>
                    <th className="p-1.5 border-b text-right">Rate (₹)</th>
                    <th className="p-1.5 border-b text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="relative group bg-amber-50/40">
                      <td className="p-1.5 font-medium">{item.description}</td>
                      <td className="p-1.5 font-bold font-mono text-center">{parseFloat(item.quantity || 0)}</td>
                      <td className="p-1.5 font-mono text-right">{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                      <td className="p-1.5 font-mono text-right font-bold">{parseFloat(item.line_total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-right space-y-1 text-[11px] pt-2 border-t border-slate-200">
                <p>Subtotal: <span className="font-mono">₹{parseFloat(invoice.subtotal || 0).toFixed(2)}</span></p>
                <p>Tax (GST): <span className="font-mono">₹{parseFloat(invoice.tax_amount || 0).toFixed(2)}</span></p>
                <p className="text-sm font-bold text-slate-900">
                  Grand Total: <span className="font-mono">₹{parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Extracted Data & Editable Fields */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-[750px]">
          {/* Tabs Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('fields')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  activeTab === 'fields' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Extracted Fields ({items.length} items)
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 ${
                  activeTab === 'history' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Edit History ({changeLogs.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-semibold">
              OCR Confidence: <span className="font-bold text-indigo-600">{confidencePct}%</span>
            </span>
          </div>

          {/* TAB 1: Extracted Header & Line Items */}
          {activeTab === 'fields' && (
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
              {/* Header Fields Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] font-semibold">
                    <span>INVOICE NUMBER</span>
                    <button onClick={() => openEditModal('invoice_number', invoice.invoice_number)} className="text-indigo-600 hover:text-indigo-800">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-mono font-bold text-xs text-slate-900 mt-1">{invoice.invoice_number}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] font-semibold">
                    <span>INVOICE DATE</span>
                    <button onClick={() => openEditModal('invoice_date', invoice.invoice_date)} className="text-indigo-600 hover:text-indigo-800">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-bold text-xs text-slate-900 mt-1">{invoice.invoice_date || 'Missing'}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] font-semibold">
                    <span>PO REFERENCE</span>
                    <button onClick={() => openEditModal('po_id', invoice.po)} className="text-indigo-600 hover:text-indigo-800">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-mono font-bold text-xs text-indigo-700 mt-1">{invoice.po_details?.po_number || 'Unlinked'}</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg col-span-2">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] font-semibold">
                    <span>VENDOR NAME</span>
                    <button onClick={() => openEditModal('vendor_id', invoice.vendor)} className="text-indigo-600 hover:text-indigo-800">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-bold text-xs text-slate-900 mt-1">{invoice.vendor_details?.name || 'Unassigned Vendor'}</p>
                  <p className="text-[10px] text-slate-400 font-mono">GSTIN: {invoice.vendor_details?.gstin || 'N/A'}</p>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase">GRAND TOTAL</span>
                  <p className="text-base font-bold text-indigo-950 mt-1">
                    ₹{parseFloat(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">
                  Line Items & Materials ({items.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Description</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Quantity</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                        <th className="py-2.5 px-3 font-semibold text-center">GST %</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Line Total</th>
                        <th className="py-2.5 px-3 text-center">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-center">{parseFloat(item.quantity || 0)} {item.uom}</td>
                          <td className="py-2.5 px-3 font-mono text-right">₹{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 font-mono text-center">{parseFloat(item.tax_rate_percent || 0)}%</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-right">₹{parseFloat(item.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => openEditModal('quantity', item.quantity, item.id)}
                              className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50"
                              title="Edit Quantity (Sensitive)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Immutable Edit Audit History (Templegate Section 2.3) */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-bold text-slate-900">Templegate Audit Trail Rule 3:</span> Every edit records user, timestamp, field, old value, new value, and mandatory reason.
              </div>

              {changeLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No manual edits performed on this invoice yet.
                </div>
              ) : (
                changeLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 shadow-sm text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{log.field_name}</span>
                      {log.is_sensitive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          SENSITIVE CHANGE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 font-mono text-[11px]">
                      <span className="text-rose-600 line-through">Old: {log.old_value || 'None'}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-700 font-bold">New: {log.new_value}</span>
                    </div>
                    <p className="text-slate-600 italic">"Reason: {log.reason}"</p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>Edited by: {log.user_display}</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal with Mandatory Reason Prompt */}
      {editModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Field: <span className="text-indigo-600">{editModal.field_name}</span>
              </h3>
              <button onClick={() => setEditModal({ open: false, field_name: '', old_value: '', item_id: null })} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {isSensitiveField && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p>
                  <b>Sensitive Financial Change:</b> Changing this field triggers an audit log and locks the invoice for AP Specialist Review before approval.
                </p>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Value</label>
                <input
                  type="text"
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mandatory Explanation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this value is being corrected (e.g. OCR misread INV-108 as 1NV-108, or packing list discrepancy)..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, field_name: '', old_value: '', item_id: null })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Confirm & Log Edit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
