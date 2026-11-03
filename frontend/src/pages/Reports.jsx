import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('aging'); // 'aging' | 'gst' | 'audit'
  const [agingData, setAgingData] = useState([]);
  const [gstReport, setGstReport] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [activeTab]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'aging') {
        const res = await api.getInvoices();
        const list = res.data.results ? res.data.results : res.data;
        setAgingData(list);
      } else if (activeTab === 'gst') {
        const res = await api.getGSTReport();
        setGstReport(res.data);
      } else if (activeTab === 'audit') {
        const res = await api.getAuditLogs();
        const list = res.data.results ? res.data.results : res.data;
        setAuditLogs(list);
      }
    } catch (err) {
      console.error('Failed to load report data', err);
    } finally {
      setLoading(false);
    }
  };

  const getAgingDays = (invDate) => {
    if (!invDate) return 0;
    const diff = Math.floor((new Date() - new Date(invDate)) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 9: Compliance, Aging & Audit Reports</h2>
          <p className="text-xs text-slate-500">
            Statutory AP aging, Indian GST tax reconciliation, and immutable system audit trail
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl space-x-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('aging')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'aging' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AP Aging Report
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'gst' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GST Tax Report
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Central Audit Logs
          </button>
        </div>
      </div>

      {/* TAB 1: AP Aging Report */}
      {activeTab === 'aging' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Accounts Payable Aging Schedule</h3>
              <p className="text-xs text-slate-500">Age calculated from invoice date across outstanding liabilities</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Invoice Date</th>
                  <th className="py-2.5 px-3 text-center">Days Elapsed</th>
                  <th className="py-2.5 px-3">Aging Bracket</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 text-center">MSME Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingData.map((inv) => {
                  const days = getAgingDays(inv.invoice_date);
                  let bracket = '0 - 30 Days';
                  let bracketColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (days > 90) {
                    bracket = '90+ Days';
                    bracketColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (days > 60) {
                    bracket = '61 - 90 Days';
                    bracketColor = 'bg-orange-50 text-orange-700 border-orange-200';
                  } else if (days > 30) {
                    bracket = '31 - 60 Days';
                    bracketColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  const isMsme = inv.vendor_details?.is_msme;
                  const msmeRisk = isMsme && days >= 35;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{inv.invoice_number}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{inv.vendor_details?.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inv.invoice_date || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono">{days} days</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bracketColor}`}>
                          {bracket}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right text-slate-900">
                        ₹{parseFloat(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {msmeRisk ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            ⚠ 45-Day Overdue Warning
                          </span>
                        ) : isMsme ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            MSME Within Limit
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Non-MSME</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GST Tax Reconciliation Report */}
      {activeTab === 'gst' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Indian GST Tax Reconciliation Log</h3>
              <p className="text-xs text-slate-500">Taxable values, tax components, and supplier GSTIN matching for GSTR-2B</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier Legal Name</th>
                  <th className="py-2.5 px-3">Supplier GSTIN</th>
                  <th className="py-2.5 px-3 text-right">Taxable Amount (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST Tax (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total Invoice (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gstReport.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{row.invoice_number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.invoice_date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.vendor_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 font-bold">{row.vendor_gstin}</td>
                    <td className="py-2.5 px-3 font-mono text-right">₹{parseFloat(row.taxable_subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3 font-mono text-right text-indigo-700 font-bold">₹{parseFloat(row.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-900">₹{parseFloat(row.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Immutable Central Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Central Immutable Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Templegate Rule 10 & Section 12: Every transaction, OCR extraction, manual edit, approval decision, and payment confirmation is permanently recorded.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor / User</th>
                  <th className="py-2.5 px-3">Action Performed</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Audit Details & Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{log.user_display}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {log.entity_type} #{log.entity_id ? String(log.entity_id).slice(0, 8) : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-sm truncate">
                      {log.reason ? `Reason: "${log.reason}" | ` : ''}
                      {log.details ? JSON.stringify(log.details) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
