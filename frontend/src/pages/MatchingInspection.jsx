import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Percent,
  RefreshCw
} from 'lucide-react';

export default function MatchingInspection({ invoiceId, onBackToList, onNavigateToApprovals }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoiceId || '');
  const [matchingResult, setMatchingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tolerance, setTolerance] = useState(1.0);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoiceId) {
      runMatchEvaluation(selectedInvoiceId, tolerance);
    }
  }, [selectedInvoiceId]);

  const loadInvoices = async () => {
    try {
      const res = await api.getInvoices();
      const list = res.data.results ? res.data.results : res.data;
      setInvoices(list);
      if (!selectedInvoiceId && list.length > 0) {
        setSelectedInvoiceId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  };

  const runMatchEvaluation = async (invId, tol) => {
    try {
      setEvaluating(true);
      const res = await api.evaluateMatch(invId, tol);
      setMatchingResult(res.data);
    } catch (err) {
      console.error('Evaluation error', err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('Override reason is required');
      return;
    }

    try {
      await api.overrideMatch(selectedInvoiceId, overrideReason);
      setOverrideModal(false);
      setOverrideReason('');
      await runMatchEvaluation(selectedInvoiceId, tolerance);
      alert('Discrepancy overridden by authorized manager. Invoice marked as MATCH_PASSED!');
    } catch (err) {
      alert(err.response?.data?.error || 'Override failed');
    }
  };

  const handleInitiateApproval = async () => {
    try {
      await api.initiateApproval(selectedInvoiceId);
      alert('Invoice successfully routed into the Manager Approval Matrix!');
      if (onNavigateToApprovals) onNavigateToApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to initiate approval');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 4: PO & GRN Matching Engine</h2>
          <p className="text-xs text-slate-500">
            Automated 2-Way (PO vs Invoice) and 3-Way (PO vs GRN vs Invoice) discrepancy detection
          </p>
        </div>

        {/* Invoice Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600">Select Invoice:</label>
          <select
            value={selectedInvoiceId}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 shadow-sm focus:outline-none"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} ({inv.vendor_details?.name || 'Unknown'} - ₹{inv.grand_total})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tolerance Config Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Percent className="w-5 h-5 text-indigo-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase">Configurable Price Tolerance</h4>
            <p className="text-xs text-slate-500">Allowable price variance threshold before triggering a price mismatch exception</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
            className="w-20 text-xs font-bold p-2 bg-slate-50 border border-slate-300 rounded-lg text-center"
          />
          <span className="text-xs font-semibold text-slate-600">% Variance</span>
          <button
            onClick={() => runMatchEvaluation(selectedInvoiceId, tolerance)}
            disabled={evaluating}
            className="px-3 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {/* Matching Result Outcome Banner */}
      {matchingResult && (
        <div
          className={`p-5 rounded-2xl border shadow-sm ${
            matchingResult.is_passed
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              {matchingResult.is_passed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Match Status: {matchingResult.status_display}
                </h3>
                <p className="text-xs mt-1 leading-relaxed">
                  {matchingResult.discrepancy_summary}
                </p>
                {matchingResult.override_approved && (
                  <p className="text-xs font-bold text-indigo-700 mt-1">
                    ✓ Overridden by Manager: "{matchingResult.override_reason}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!matchingResult.is_passed && (
                <button
                  onClick={() => setOverrideModal(true)}
                  className="px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  Override Discrepancy
                </button>
              )}
              {matchingResult.is_passed && (
                <button
                  onClick={handleInitiateApproval}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center space-x-1.5"
                >
                  <span>Route to Approval Matrix</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item-by-Item 3-Way Match Table */}
      {matchingResult && matchingResult.item_matching_details && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            Line Items 3-Way Cross Verification Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Material / Description</th>
                  <th className="py-2.5 px-3 font-semibold text-center">PO Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-center">GRN Accepted Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Invoice Billed Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-center">PO Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Invoice Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Variance %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchingResult.item_matching_details.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.material_code || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{item.po_qty}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{item.grn_accepted_qty}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{item.invoice_qty}</td>
                    <td className="py-3 px-3 text-center font-mono">₹{item.po_price}</td>
                    <td className="py-3 px-3 text-center font-mono">₹{item.invoice_price}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {item.variance_pct > 0 ? `+${item.variance_pct}%` : '0.0%'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.status === 'MATCHED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          MATCHED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Manager Override Justification
            </h3>
            <p className="text-xs text-slate-500">
              Templegate Section 4.3: Authorizing an invoice discrepancy requires a documented justification for audit logging.
            </p>
            <form onSubmit={handleOverride} className="space-y-3">
              <textarea
                rows={3}
                required
                placeholder="Explain why the price variance or partial receipt is approved for processing..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setOverrideModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
