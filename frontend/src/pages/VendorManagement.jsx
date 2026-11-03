import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  Search,
  ExternalLink,
  Plus
} from 'lucide-react';

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const res = await api.getVendors();
      const list = res.data.results ? res.data.results : res.data;
      setVendors(list);
    } catch (err) {
      console.error('Failed to load vendors', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBank = async (vendorId, accountId = null) => {
    try {
      setActionLoading(true);
      const res = await api.verifyVendorBank(vendorId, accountId);
      alert(res.data.message || 'Bank account successfully verified via Penny Drop!');
      await loadVendors();
    } catch (err) {
      alert(err.response?.data?.error || 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyGSTIN = async (vendorId) => {
    try {
      setActionLoading(true);
      const res = await api.verifyVendorGSTIN(vendorId);
      alert(res.data.message || 'GSTIN verified on Government GST Portal!');
      await loadVendors();
    } catch (err) {
      alert(err.response?.data?.error || 'GSTIN verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_code.toLowerCase().includes(search.toLowerCase()) ||
    v.gstin.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 6: Vendor Management</h2>
          <p className="text-xs text-slate-500">
            Supplier master records, GSTIN validation, and bank detail penny-drop verification
          </p>
        </div>

        <div className="relative w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vendor name, code, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Vendor Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs">
            Loading vendor master records...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs">
            No matching vendor records found.
          </div>
        ) : (
          filteredVendors.map((vendor) => {
            const primaryBank = vendor.primary_bank;
            return (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-3 border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {vendor.vendor_code}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">{vendor.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{vendor.address_line}, {vendor.city}, {vendor.state} - {vendor.pincode}</p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      vendor.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : vendor.status === 'BLOCKED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {vendor.status_display}
                  </span>
                </div>

                {/* Tax & Compliance Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">GSTIN / TAX ID</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-bold text-slate-900">{vendor.gstin}</span>
                      {vendor.is_gstin_verified ? (
                        <span className="text-emerald-600 text-[10px] font-bold flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerifyGSTIN(vendor.id)}
                          className="text-indigo-600 hover:underline text-[10px] font-bold"
                        >
                          Verify Now
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">MSME CATEGORY</span>
                    <div className="mt-0.5">
                      {vendor.is_msme ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          MSME (45-Day Rule)
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium">Standard Vendor</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bank Account Details (Masked) */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Beneficiary Bank Account</span>
                    </span>
                    {primaryBank?.is_verified ? (
                      <span className="text-emerald-700 text-[10px] font-bold bg-emerald-100/70 px-2 py-0.5 rounded flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Penny Drop Verified
                      </span>
                    ) : (
                      <span className="text-amber-700 text-[10px] font-bold bg-amber-100/70 px-2 py-0.5 rounded flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Unverified Account
                      </span>
                    )}
                  </div>

                  {primaryBank ? (
                    <div className="font-mono text-slate-800 text-[11px] flex justify-between pt-1">
                      <span>{primaryBank.bank_name}</span>
                      <span className="font-bold tracking-wider">{primaryBank.masked_account_number}</span>
                      <span>IFSC: {primaryBank.ifsc_code}</span>
                    </div>
                  ) : (
                    <p className="text-rose-500 text-[11px]">No bank account on file (Payment will be held on hold)</p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Payment Terms: <b>Net {vendor.payment_terms_days} Days</b>
                  </span>

                  {primaryBank && !primaryBank.is_verified && (
                    <button
                      onClick={() => handleVerifyBank(vendor.id, primaryBank?.id)}
                      disabled={actionLoading}
                      className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                    >
                      Verify via Penny Drop
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
