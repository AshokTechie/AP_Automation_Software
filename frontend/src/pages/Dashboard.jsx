import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Zap,
  Building,
  CreditCard,
  AlertOctagon,
  RefreshCw,
  TrendingUp,
  Inbox
} from 'lucide-react';

export default function Dashboard({ onNavigateTo }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardSummary();
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load dashboard summary', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect to backend analytics API');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Calculating real-time AP analytics from PostgreSQL...</p>
        <p className="text-xs text-slate-400">Aggregating OCR confidence, aging brackets, and pending exceptions</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Dashboard Analytics Unavailable</h3>
        <p className="text-xs text-slate-500">
          Could not fetch real-time summary from backend. Please ensure the Django server is running on port 8000.
        </p>
        <button
          onClick={loadSummary}
          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
        >
          Retry Loading Dashboard
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 max-w-md mx-auto">
        <Inbox className="w-10 h-10 text-slate-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-800">No Analytics Data Found</p>
        <p className="text-xs text-slate-400">Upload invoices or seed procurement master data to view live metrics.</p>
      </div>
    );
  }

  const aging = summary.aging_buckets || {};
  const payments = summary.payment_stats || {};
  const topVendors = summary.top_vendors || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Accounts Payable Executive Dashboard</h2>
          <p className="text-xs text-slate-500">
            Real-time tracking of invoice aging, approval bottlenecks, processing speed & payment tracking
          </p>
        </div>
        <button
          onClick={loadSummary}
          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm flex items-center space-x-1 self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* MSME Statutory Warning Banner (Section 43B(h) Compliance) */}
      {summary.msme_overdue_warning_count > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertOctagon className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Statutory Compliance Alert: MSME 45-Day Rule (Section 43B(h))
              </h4>
              <p className="text-xs text-amber-700">
                {summary.msme_overdue_warning_count} MSME vendor invoice(s) are approaching or past 35 days. Settle immediately to prevent income tax deduction disallowance.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTo('invoices')}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm self-start sm:self-auto"
          >
            Review MSME Invoices
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total AP Outstanding"
          value={`₹${parseFloat(summary.total_ap_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${summary.total_invoices || 0} total invoices in system`}
          icon={DollarSign}
          color="indigo"
          badge="Live Ledger"
        />
        <StatCard
          title="Processing Turnaround Time"
          value={`${summary.avg_turnaround_days || 0} Days`}
          subtitle="Average cycle: upload to settlement"
          icon={Clock}
          color="emerald"
          badge="85% Faster"
        />
        <StatCard
          title="OCR Accuracy Percentage"
          value={`${summary.ocr_accuracy_percentage || 0}%`}
          subtitle="Line-item & header confidence"
          icon={FileSearch}
          color="sky"
          badge="Confidence Avg"
        />
        <StatCard
          title="Auto-Approval (STP) Rate"
          value={`${summary.stp_rate_percentage || 0}%`}
          subtitle="Zero manual touch processing"
          icon={Zap}
          color="emerald"
          badge="Automation"
        />
      </div>

      {/* Aging & Payment Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AP Aging Brackets */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Invoice Aging Schedule</h3>
              <p className="text-xs text-slate-500">Aging calculated from invoice date across open liabilities</p>
            </div>
            <button onClick={() => onNavigateTo('reports')} className="text-xs text-indigo-600 font-semibold hover:underline">
              View Detailed Report →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">0 – 30 Days</span>
              <p className="text-lg font-bold text-emerald-950 mt-1">
                ₹{parseFloat(aging['0_30_days'] || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-600">Current / Safe</span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
              <span className="text-[11px] font-bold text-amber-800 uppercase">31 – 60 Days</span>
              <p className="text-lg font-bold text-amber-950 mt-1">
                ₹{parseFloat(aging['31_60_days'] || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-600">Follow-up Due</span>
            </div>
            <div className="p-3 bg-orange-50/70 border border-orange-100 rounded-lg">
              <span className="text-[11px] font-bold text-orange-800 uppercase">61 – 90 Days</span>
              <p className="text-lg font-bold text-orange-950 mt-1">
                ₹{parseFloat(aging['61_90_days'] || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-orange-600">Critical Overdue</span>
            </div>
            <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-lg">
              <span className="text-[11px] font-bold text-rose-800 uppercase">90+ Days</span>
              <p className="text-lg font-bold text-rose-950 mt-1">
                ₹{parseFloat(aging['90_plus_days'] || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-600">Dispute / Blocked</span>
            </div>
          </div>

          {/* Quick Action Queue Counters */}
          <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div
              onClick={() => onNavigateTo('approvals')}
              className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Pending Approvals</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  {summary.pending_approvals_count || 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Invoices waiting in manager approval matrix</p>
            </div>

            <div
              onClick={() => onNavigateTo('exceptions')}
              className="p-3 bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Active Exceptions</span>
                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  {summary.active_exceptions_count || 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Price/qty variances, duplicates, missing GRNs</p>
            </div>
          </div>
        </div>

        {/* Banking & Settlement Status Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Payment Tracking</h3>
              <CreditCard className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Settled & Confirmed (with UTR)</span>
                <span className="font-bold text-emerald-600">{payments.completed || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Processing with Bank Gateway</span>
                <span className="font-bold text-indigo-600">{payments.processing || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Pending Treasury Approval</span>
                <span className="font-bold text-amber-600">{payments.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Bank Rejected / On Hold</span>
                <span className="font-bold text-rose-600">{payments.failed || 0}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total Disbursed:</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                ₹{parseFloat(summary.total_paid_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              onClick={() => onNavigateTo('payments')}
              className="w-full mt-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
            >
              Manage Payments & Advices
            </button>
          </div>
        </div>
      </div>

      {/* Top 5 Vendors by Spend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Vendor-wise Analytics (Top Suppliers by Spend)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-semibold">Vendor Code</th>
                <th className="pb-2 font-semibold">Vendor Name</th>
                <th className="pb-2 font-semibold">MSME Status</th>
                <th className="pb-2 font-semibold">Invoices Count</th>
                <th className="pb-2 font-semibold text-right">Total Invoiced (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topVendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    No supplier records available.
                  </td>
                </tr>
              ) : (
                topVendors.map((v) => (
                  <tr key={v.vendor_code} className="hover:bg-slate-50">
                    <td className="py-2.5 font-mono text-slate-600">{v.vendor_code}</td>
                    <td className="py-2.5 font-medium text-slate-900">{v.name}</td>
                    <td className="py-2.5">
                      {v.is_msme ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          MSME Registered
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Standard</span>
                      )}
                    </td>
                    <td className="py-2.5">{v.invoices}</td>
                    <td className="py-2.5 font-bold text-slate-900 text-right font-mono">
                      ₹{parseFloat(v.spend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
