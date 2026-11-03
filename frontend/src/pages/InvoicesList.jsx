import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  FileText,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function InvoicesList({ onSelectInvoiceForReview, onSelectInvoiceForMatching }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.getInvoices(params);
      // DRF pagination support
      const data = res.data.results ? res.data.results : res.data;
      setInvoices(data);
    } catch (err) {
      console.error('Error fetching invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const term = searchQuery.toLowerCase();
    const invNum = (inv.invoice_number || '').toLowerCase();
    const vName = (inv.vendor_details?.name || '').toLowerCase();
    return invNum.includes(term) || vName.includes(term);
  });

  const getStatusBadge = (status, hasSensitiveEdits) => {
    if (hasSensitiveEdits) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <ShieldAlert className="w-3 h-3 mr-1" />
          Pending AP Sensitive Review
        </span>
      );
    }

    const map = {
      APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PAID: 'bg-sky-50 text-sky-700 border-sky-200',
      MATCH_PASSED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      MATCH_FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
      PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
      NEEDS_VERIFICATION: 'bg-orange-50 text-orange-700 border-orange-200',
      REJECTED: 'bg-slate-100 text-slate-700 border-slate-300',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${map[status] || 'bg-slate-50 text-slate-600'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getConfidencePill = (score) => {
    const pct = Math.round((parseFloat(score) || 0) * 100);
    let color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct < 70) color = 'bg-rose-50 text-rose-700 border-rose-200';
    else if (pct < 90) color = 'bg-amber-50 text-amber-700 border-amber-200';

    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${color}`}>
        {pct}% OCR
      </span>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices Master Ledger</h2>
          <p className="text-xs text-slate-500">
            Complete registry of ingested, extracted, matched, and settled supplier invoices
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice # or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved for Payment</option>
            <option value="MATCH_PASSED">Matching Passed</option>
            <option value="MATCH_FAILED">Matching Discrepancy</option>
            <option value="PENDING_AP_REVIEW">Pending AP Review</option>
            <option value="PENDING_APPROVAL">Pending Manager Approval</option>
            <option value="NEEDS_VERIFICATION">Needs Human Verification</option>
            <option value="PAID">Paid & Settled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice Number</th>
                <th className="py-3 px-4 font-semibold">Vendor / Supplier</th>
                <th className="py-3 px-4 font-semibold">Invoice Date</th>
                <th className="py-3 px-4 font-semibold">Grand Total</th>
                <th className="py-3 px-4 font-semibold">OCR Confidence</th>
                <th className="py-3 px-4 font-semibold">Workflow Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading invoices from database...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching invoice records found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {inv.vendor_details?.name || 'Unidentified Supplier'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        GSTIN: {inv.vendor_details?.gstin || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.invoice_date || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{parseFloat(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {getConfidencePill(inv.ocr_confidence_score)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(inv.status, inv.has_sensitive_edits)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onSelectInvoiceForReview(inv.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded transition-colors"
                      >
                        Side-by-Side Review
                      </button>
                      <button
                        onClick={() => onSelectInvoiceForMatching(inv.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      >
                        3-Way Match →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
