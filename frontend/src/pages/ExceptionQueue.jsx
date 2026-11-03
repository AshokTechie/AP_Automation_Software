import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function ExceptionQueue({ onSelectInvoiceForReview }) {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedFilter, setResolvedFilter] = useState('false'); // 'false' | 'true' | 'all'
  const [selectedException, setSelectedException] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadExceptions();
  }, [resolvedFilter]);

  const loadExceptions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (resolvedFilter !== 'all') params.resolved = resolvedFilter;
      const res = await api.getExceptions(params);
      const list = res.data.results ? res.data.results : res.data;
      setExceptions(list);
    } catch (err) {
      console.error('Failed to load exceptions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) {
      alert('Resolution notes explaining the fix are required.');
      return;
    }

    try {
      setResolving(true);
      await api.resolveException(selectedException.id, resolutionNotes);
      setSelectedException(null);
      setResolutionNotes('');
      await loadExceptions();
      alert('Exception resolved! Re-validation triggered on affected invoice.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve exception');
    } finally {
      setResolving(false);
    }
  };

  const getSeverityBadge = (severity) => {
    if (severity === 'BLOCKING') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          BLOCKING
        </span>
      );
    } else if (severity === 'WARNING') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          WARNING
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
        INFO
      </span>
    );
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Module 3 & 4: Central Exception Queue</h2>
        <p className="text-xs text-slate-500">
          Templegate Section 5 & 11: Standardized tracking of all 16 business and technical discrepancy categories
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Status:</span>
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
          >
            <option value="false">Active / Unresolved Only</option>
            <option value="true">Resolved History</option>
            <option value="all">All Exceptions</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {exceptions.length} exception records
        </span>
      </div>

      {/* Exceptions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Affected Invoice / Ref</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Assigned Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading exceptions...
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No active exceptions found. All invoices are cleanly matched!
                  </td>
                </tr>
              ) : (
                exceptions.map((exc) => (
                  <tr key={exc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {exc.category_display}
                    </td>
                    <td className="py-3 px-4">{getSeverityBadge(exc.severity)}</td>
                    <td className="py-3 px-4">
                      {exc.invoice ? (
                        <div>
                          <span className="font-mono font-bold text-indigo-700">
                            {exc.invoice_number}
                          </span>
                          <p className="text-[10px] text-slate-400">{exc.vendor_name}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">System Batch</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs leading-relaxed">
                      {exc.description}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {exc.assigned_role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {exc.resolved ? (
                        <span className="text-emerald-600 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolved</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Active Blocker</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {!exc.resolved && (
                        <button
                          onClick={() => { setSelectedException(exc); setResolutionNotes(''); }}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm"
                        >
                          Resolve
                        </button>
                      )}
                      {exc.invoice && onSelectInvoiceForReview && (
                        <button
                          onClick={() => onSelectInvoiceForReview(exc.invoice)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
                        >
                          View Document
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

      {/* Resolution Modal */}
      {selectedException && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Resolve Exception: {selectedException.category_display}
              </h3>
              <button onClick={() => setSelectedException(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <b>Issue:</b> {selectedException.description}
            </p>

            <form onSubmit={handleResolve} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Resolution Notes & Evidence <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Document how this issue was resolved (e.g., supplier confirmed discount, warehouse uploaded missing GRN, GSTIN status verified on portal)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedException(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {resolving ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
