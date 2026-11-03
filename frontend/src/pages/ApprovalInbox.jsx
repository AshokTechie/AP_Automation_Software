import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Send,
  RefreshCw,
  UserCheck
} from 'lucide-react';

export default function ApprovalInbox({ onSelectInvoiceForReview, currentUser }) {
  const [approvals, setApprovals] = useState([]);
  const [rules, setRules] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceForRoute, setSelectedInvoiceForRoute] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, approvalId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    loadEligibleInvoices();
  }, [statusFilter, currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const [appRes, rulesRes] = await Promise.all([
        api.getApprovalRequests(params),
        api.getApprovalRules()
      ]);
      const appList = appRes.data.results ? appRes.data.results : appRes.data;
      setApprovals(Array.isArray(appList) ? appList : []);
      const rList = rulesRes.data.results ? rulesRes.data.results : rulesRes.data;
      setRules(Array.isArray(rList) ? rList : []);
    } catch (err) {
      console.error('Failed to load approvals', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleInvoices = async () => {
    try {
      const res = await api.getInvoices();
      const list = res.data.results ? res.data.results : res.data;
      const invList = Array.isArray(list) ? list : [];
      setInvoices(invList);
      if (invList.length > 0 && !selectedInvoiceForRoute) {
        setSelectedInvoiceForRoute(invList[0].id);
      }
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  };

  const handleRouteInvoice = async () => {
    if (!selectedInvoiceForRoute) return;
    try {
      setRouting(true);
      const res = await api.initiateApproval(selectedInvoiceForRoute);
      alert(res.data.message || 'Invoice successfully routed to Approval Matrix!');
      setStatusFilter('PENDING');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to route invoice to approval matrix');
    } finally {
      setRouting(false);
    }
  };

  const handleApprove = async (approvalId) => {
    try {
      setSubmitting(true);
      const res = await api.actionApproval(approvalId, 'APPROVE', 'Approved by authorized manager');
      alert(res.data.message || 'Invoice approved successfully!');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('A rejection reason is mandatory (Templegate Section 2.7).');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.actionApproval(rejectModal.approvalId, 'REJECT', rejectReason);
      setRejectModal({ open: false, approvalId: null });
      setRejectReason('');
      alert(res.data.message || 'Invoice rejected and returned to responsible team with rejection notes.');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 5: Workflow & Approval Engine</h2>
          <p className="text-xs text-slate-500">
            Role-based multi-tier approval matrix with SLA timers and separation of duties enforcement
          </p>
        </div>

        {/* Quick Route Helper */}
        <div className="flex items-center space-x-2 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
          <select
            value={selectedInvoiceForRoute}
            onChange={(e) => setSelectedInvoiceForRoute(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} (₹{parseFloat(inv.grand_total || 0).toLocaleString('en-IN')})
              </option>
            ))}
          </select>
          <button
            onClick={handleRouteInvoice}
            disabled={routing || !selectedInvoiceForRoute}
            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center space-x-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{routing ? 'Routing...' : 'Route to Matrix'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900">
              Approval Queue ({approvals.length})
            </h3>
            <span className="text-xs text-slate-400">
              (Separation of duties: Self-approval prohibited)
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === tab
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'PENDING' ? 'Pending Action' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading approval tasks...</span>
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="text-sm font-bold text-slate-800">
              {statusFilter === 'PENDING'
                ? 'No Pending Approvals in Queue'
                : `No ${statusFilter.toLowerCase()} records found.`}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All approval tasks have been actioned. You can route an invoice from the top-right dropdown or via the 3-Way Matching Engine to test workflow approval tiers!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {approvals.map((app) => (
              <div key={app.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-mono font-bold text-sm text-indigo-700">
                      {app.invoice_number}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Tier {app.tier_order}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {app.assigned_role_display}
                    </span>

                    {/* Status Badge */}
                    {app.status === 'APPROVED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ APPROVED
                      </span>
                    )}
                    {app.status === 'REJECTED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        ✕ REJECTED
                      </span>
                    )}
                    {app.status === 'PENDING' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        ⏳ PENDING APPROVAL
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    Vendor: <span className="font-bold">{app.vendor_name}</span> | Amount: <span className="font-mono font-bold text-slate-900">₹{parseFloat(app.invoice_total || 0).toLocaleString('en-IN')}</span>
                  </p>

                  {/* Comments / Details */}
                  {app.comments && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 px-2 py-1 rounded border border-slate-100 inline-block">
                      Note: "{app.comments}"
                    </p>
                  )}

                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        SLA Deadline:{' '}
                        {app.escalation_deadline
                          ? new Date(app.escalation_deadline).toLocaleString()
                          : 'Within SLA (48 hrs)'}
                      </span>
                    </span>
                    {app.is_overdue && (
                      <span className="text-rose-600 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>OVERDUE ESCALATED</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => onSelectInvoiceForReview(app.invoice)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    View Details
                  </button>

                  {app.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => setRejectModal({ open: true, approvalId: app.id })}
                        disabled={submitting}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center space-x-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleApprove(app.id)}
                        disabled={submitting}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center space-x-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Invoice</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configured Approval Matrix Rules Display */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Configured System Approval Matrix</h3>
        <p className="text-xs text-slate-500">Tier rules mapping transaction value thresholds to required signing authorities</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {(Array.isArray(rules) ? rules : []).map((r) => (
            <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <span className="font-bold text-indigo-700 uppercase text-[10px]">Tier {r.tier_order} Rule</span>
              <p className="font-bold text-slate-900">{r.name}</p>
              <p className="text-slate-600 font-mono">
                ₹{parseFloat(r.min_amount).toLocaleString('en-IN')} – ₹{parseFloat(r.max_amount).toLocaleString('en-IN')}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">{r.required_role_display}</span>
                <span className="text-slate-400">SLA: {r.sla_hours} hrs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rejection Modal with Mandatory Reason Prompt */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Reject Invoice Approval
            </h3>
            <p className="text-xs text-slate-500">
              Templegate Section 2.7: A rejection reason is required so the vendor/AP team knows what to fix.
            </p>
            <form onSubmit={handleReject} className="space-y-3">
              <textarea
                rows={3}
                required
                placeholder="State the reason for rejection (e.g., incorrect tax rate, missing delivery challan, unapproved price variance)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, approvalId: null })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
