import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Send,
  XCircle,
  Plus,
  Clock,
  ShieldCheck
} from 'lucide-react';

export default function PaymentProcessing() {
  const [payments, setPayments] = useState([]);
  const [approvedInvoices, setApprovedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [tdsRate, setTdsRate] = useState('0.10');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const [payRes, invRes] = await Promise.all([
        api.getPayments(),
        api.getInvoices({ status: 'APPROVED' })
      ]);
      const pList = payRes.data.results ? payRes.data.results : payRes.data;
      const iList = invRes.data.results ? invRes.data.results : invRes.data;
      setPayments(pList);
      setApprovedInvoices(iList);
      if (iList.length > 0 && !selectedInvoiceId) {
        setSelectedInvoiceId(iList[0].id);
      }
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceId) return;

    try {
      setSubmitting(true);
      await api.generatePaymentRequest({
        invoice_id: selectedInvoiceId,
        tds_rate_percent: parseFloat(tdsRate) || 0.10,
        payment_mode: paymentMode
      });
      setCreateModal(false);
      await loadPayments();
      alert('Payment request generated! In status PENDING_APPROVAL.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate payment request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (paymentId) => {
    try {
      await api.dispatchPaymentToBank(paymentId);
      alert('Payment dispatched to core banking gateway. Status: PROCESSING.');
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Dispatch failed');
    }
  };

  const handleConfirmSettlement = async (paymentId) => {
    try {
      const res = await api.confirmPaymentSettlement(paymentId);
      alert(res.data.message || 'Payment confirmed by bank. UTR issued and Payment Advice PDF generated!');
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Confirmation failed');
    }
  };

  const handleFailSettlement = async (paymentId) => {
    const reason = prompt('Enter bank rejection reason (e.g. Invalid IFSC / Account Frozen):', 'Account Frozen / KYC Incomplete');
    if (!reason) return;

    try {
      await api.failPaymentSettlement(paymentId, reason);
      alert('Payment marked as FAILED with bank response recorded in audit trail.');
      await loadPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Rejection failed');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
      FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
      ON_HOLD: 'bg-orange-50 text-orange-700 border-orange-200',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${map[status] || 'bg-slate-100 text-slate-700'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 7: Payment Processing & Bank Settlements</h2>
          <p className="text-xs text-slate-500">
            Templegate Rule 11: Invoices are never marked paid without verified bank confirmation and UTR reconciliation
          </p>
        </div>

        <button
          onClick={() => setCreateModal(true)}
          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center space-x-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create Payment Request</span>
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Payment Ref / Invoice #</th>
                <th className="py-3 px-4 font-semibold">Beneficiary Supplier</th>
                <th className="py-3 px-4 font-semibold">Bank Details (Masked)</th>
                <th className="py-3 px-4 font-semibold text-right">Gross (₹)</th>
                <th className="py-3 px-4 font-semibold text-right">TDS u/s 194Q</th>
                <th className="py-3 px-4 font-semibold text-right">Net Payable (₹)</th>
                <th className="py-3 px-4 font-semibold text-center">Settlement Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading payment requests...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No payment records found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-indigo-700">{p.invoice_number}</div>
                      <div className="text-[10px] text-slate-400">Mode: {p.payment_mode}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.vendor_name}</td>
                    <td className="py-3 px-4 font-mono">
                      <div>{p.bank_name}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{p.bank_account_masked}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-600">
                      ₹{parseFloat(p.gross_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-rose-600">
                      -₹{parseFloat(p.tds_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-right text-slate-900">
                      ₹{parseFloat(p.net_payable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div>{getStatusBadge(p.status)}</div>
                      {p.utr_number && (
                        <div className="text-[10px] font-mono text-emerald-800 font-bold mt-1">
                          UTR: {p.utr_number}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {p.status === 'PENDING_APPROVAL' && (
                        <button
                          onClick={() => handleDispatch(p.id)}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm"
                        >
                          Dispatch to Bank
                        </button>
                      )}

                      {p.status === 'PROCESSING' && (
                        <>
                          <button
                            onClick={() => handleConfirmSettlement(p.id)}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm"
                          >
                            Simulate Settle (UTR)
                          </button>
                          <button
                            onClick={() => handleFailSettlement(p.id)}
                            className="px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {p.status === 'COMPLETED' && p.advice_pdf_url && (
                        <a
                          href={p.advice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Payment Advice PDF</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Payment Request Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Generate Payment Request (Pre-Settlement)
            </h3>
            <p className="text-xs text-slate-500">
              Select an approved invoice to schedule payment and compute statutory TDS deductions.
            </p>

            <form onSubmit={handleGeneratePayment} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Approved Invoice</label>
                {approvedInvoices.length === 0 ? (
                  <p className="text-xs text-rose-600 font-medium">No approved invoices awaiting payment.</p>
                ) : (
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
                  >
                    {approvedInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} – {inv.vendor_details?.name} (₹{parseFloat(inv.grand_total).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">TDS Rate % (Sec 194Q)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tdsRate}
                    onChange={(e) => setTdsRate(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="NEFT">NEFT Batch</option>
                    <option value="RTGS">RTGS Immediate</option>
                    <option value="IMPS">IMPS Instant</option>
                    <option value="NACH">NACH Corporate</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || approvedInvoices.length === 0}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  Generate Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
