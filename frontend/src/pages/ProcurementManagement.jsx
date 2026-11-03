import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Package,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowRight,
  Database
} from 'lucide-react';

export default function ProcurementManagement() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'grns' | 'importer'
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Importer states
  const [importType, setImportType] = useState('PO');
  const [selectedFile, setSelectedFile] = useState(null);
  const [importBatch, setImportBatch] = useState(null);
  const [uploadingImport, setUploadingImport] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, grnsRes] = await Promise.all([
        api.getPurchaseOrders(),
        api.getGoodsReceipts()
      ]);
      setPurchaseOrders(posRes.data.results ? posRes.data.results : posRes.data);
      setGoodsReceipts(grnsRes.data.results ? grnsRes.data.results : grnsRes.data);
    } catch (err) {
      console.error('Failed to load procurement data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImportFile = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploadingImport(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('batch_type', importType);

      const res = await api.uploadImportBatch(formData);
      setImportBatch(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Import validation failed');
    } finally {
      setUploadingImport(false);
    }
  };

  const handleCommitBatch = async () => {
    if (!importBatch) return;

    try {
      setCommitting(true);
      const res = await api.commitImportBatch(importBatch.id);
      alert(res.data.message || 'Import committed successfully to PostgreSQL!');
      setImportBatch(null);
      setSelectedFile(null);
      setActiveTab(importType === 'PO' ? 'pos' : 'grns');
    } catch (err) {
      alert(err.response?.data?.error || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module 4: Purchasing & Warehouse (PO & GRN)</h2>
          <p className="text-xs text-slate-500">
            Internal procurement records and Excel/CSV bulk ingestion engine with row-level error reporting
          </p>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl space-x-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('grns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'grns' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Goods Receipts (GRN) ({goodsReceipts.length})
          </button>
          <button
            onClick={() => setActiveTab('importer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
              activeTab === 'importer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel / CSV Bulk Importer</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Purchase Orders */}
      {activeTab === 'pos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">PO Number</th>
                  <th className="py-3 px-4 font-semibold">Supplier</th>
                  <th className="py-3 px-4 font-semibold">Issue Date</th>
                  <th className="py-3 px-4 font-semibold">Line Items</th>
                  <th className="py-3 px-4 font-semibold">Total Amount</th>
                  <th className="py-3 px-4 font-semibold">Fulfillment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Loading purchase orders...</td>
                  </tr>
                ) : purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{po.po_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{po.vendor_details?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{po.issue_date}</td>
                    <td className="py-3 px-4">
                      {po.items.map((it) => (
                        <div key={it.id} className="text-[11px] text-slate-700">
                          • {it.description} ({parseFloat(it.ordered_quantity)} ordered, {parseFloat(it.received_quantity)} received)
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-slate-900">
                      ₹{parseFloat(po.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                        {po.status_display}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Goods Receipt Notes (GRN) */}
      {activeTab === 'grns' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">GRN Number</th>
                  <th className="py-3 px-4 font-semibold">PO Reference</th>
                  <th className="py-3 px-4 font-semibold">Vendor</th>
                  <th className="py-3 px-4 font-semibold">Receipt Date</th>
                  <th className="py-3 px-4 font-semibold">Challan / Delivery Note #</th>
                  <th className="py-3 px-4 font-semibold">Accepted Quantity</th>
                  <th className="py-3 px-4 font-semibold">Inspection Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Loading goods receipts...</td>
                  </tr>
                ) : goodsReceipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{grn.grn_number}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{grn.po_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{grn.vendor_name}</td>
                    <td className="py-3 px-4 text-slate-600">{grn.receipt_date}</td>
                    <td className="py-3 px-4 font-mono">{grn.delivery_note_number || 'N/A'}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {grn.items.map((it) => (
                        <div key={it.id}>{it.description}: {parseFloat(it.accepted_quantity)} {it.uom}</div>
                      ))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {grn.status_display}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Excel & CSV Bulk Importer (Templegate Challenge 2.6) */}
      {activeTab === 'importer' && (
        <div className="space-y-6">
          {/* Upload Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Bulk Import PO or GRN Data (Excel / CSV)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Templegate Challenge 2.6: Previews rows, reports column/data errors per row, and requires user confirmation before database commit.
            </p>

            <form onSubmit={handleUploadImportFile} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Dataset Type</label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
                >
                  <option value="PO">Purchase Orders (PO Batch)</option>
                  <option value="GRN">Goods Receipt Notes (GRN Batch)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select File (.xlsx, .csv)</label>
                <input
                  type="file"
                  required
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                />
              </div>

              <button
                type="submit"
                disabled={uploadingImport || !selectedFile}
                className="w-full py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {uploadingImport ? 'Validating Dataset...' : 'Upload & Validate Preview'}
              </button>
            </form>
          </div>

          {/* Validation & Preview Report */}
          {importBatch && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Import Batch Validation Report: {importBatch.file_name}
                  </h4>
                  <div className="flex items-center space-x-3 text-xs mt-1">
                    <span className="text-slate-500">Total Rows: <b>{importBatch.total_rows}</b></span>
                    <span className="text-emerald-700 font-bold">✓ Valid: {importBatch.valid_rows}</span>
                    <span className="text-rose-700 font-bold">✕ Invalid / Rejected: {importBatch.invalid_rows}</span>
                  </div>
                </div>

                {importBatch.valid_rows > 0 && importBatch.status === 'PREVIEW' && (
                  <button
                    onClick={handleCommitBatch}
                    disabled={committing}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Database className="w-4 h-4" />
                    <span>Commit Valid Rows to PostgreSQL</span>
                  </button>
                )}
              </div>

              {/* Row-Level Errors Report (Templegate Challenge 2.6) */}
              {importBatch.row_errors && importBatch.row_errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2">
                  <h5 className="font-bold text-rose-900 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Row-Level Data Errors ({importBatch.row_errors.length})</span>
                  </h5>
                  <div className="divide-y divide-rose-200/50 max-h-40 overflow-y-auto">
                    {importBatch.row_errors.map((err) => (
                      <div key={err.id} className="py-1.5 flex items-center justify-between text-rose-800">
                        <span>Row {err.row_number} [{err.field_name}]: {err.error_message}</span>
                        {err.rejected_value && <span className="font-mono text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">Value: {err.rejected_value}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {importBatch.preview_data && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Row #</th>
                        <th className="py-2 px-3">Reference #</th>
                        <th className="py-2 px-3">Entity</th>
                        <th className="py-2 px-3">Material</th>
                        <th className="py-2 px-3">Quantity</th>
                        <th className="py-2 px-3 text-right">Row Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importBatch.preview_data.map((row, idx) => (
                        <tr key={idx} className={row.is_valid ? 'hover:bg-slate-50' : 'bg-rose-50/40'}>
                          <td className="py-2 px-3 font-mono">{row.row}</td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-700">{row.po_number || row.grn_number}</td>
                          <td className="py-2 px-3">{row.vendor_code || 'Warehouse'}</td>
                          <td className="py-2 px-3">{row.material_code || row.description}</td>
                          <td className="py-2 px-3 font-mono font-bold">{row.quantity || row.accepted_quantity}</td>
                          <td className="py-2 px-3 text-right">
                            {row.is_valid ? (
                              <span className="text-emerald-700 font-bold">Valid</span>
                            ) : (
                              <span className="text-rose-700 font-bold">{row.errors?.[0] || 'Invalid'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
