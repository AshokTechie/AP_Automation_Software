import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Mail,
  ArrowRight,
  FileText,
  CheckCircle2,
  Trash2,
  Building2,
  Send,
  Sparkles,
  Inbox
} from 'lucide-react';

export default function InvoiceCapture({ onSelectInvoiceForReview }) {
  const [activeChannel, setActiveChannel] = useState('email'); // 'email' | 'upload'
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  // Email Ingestion State
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customGstin, setCustomGstin] = useState('');

  const acceptedFormats = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
  const acceptedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const res = await api.getVendors();
      const list = res.data.results ? res.data.results : res.data;
      if (Array.isArray(list) && list.length > 0) {
        setVendors(list);
        setSelectedVendorId(list[0].id);
      } else {
        setVendors([]);
        setSelectedVendorId('CUSTOM');
      }
    } catch (err) {
      console.error('Failed to load vendors from API:', err);
      setVendors([]);
      setSelectedVendorId('CUSTOM');
    }
  };

  const handleFiles = (files) => {
    setErrorMessage(null);
    const valid = [];
    const invalid = [];

    Array.from(files).forEach((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (acceptedExtensions.includes(ext) || acceptedFormats.includes(file.type)) {
        valid.push(file);
      } else {
        invalid.push(file.name);
      }
    });

    if (invalid.length > 0) {
      setErrorMessage(`Unsupported format in file(s): ${invalid.join(', ')}. Only PDF, JPG, PNG, and TIFF are accepted.`);
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setErrorMessage(null);
    const uploadedInvoices = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.uploadInvoice(formData);
        uploadedInvoices.push({ file: file.name, success: true, data: res.data });
      } catch (err) {
        uploadedInvoices.push({
          file: file.name,
          success: false,
          error: err.response?.data?.error || 'Upload/OCR extraction failed'
        });
      }
    }

    setResults(uploadedInvoices);
    setSelectedFiles([]);
    setUploading(false);
  };

  // Simulate Email Ingestion with Dynamic Vendor Selection
  const handleSimulateEmailIngestion = async () => {
    setUploading(true);
    setErrorMessage(null);

    const payload = {};
    if (selectedVendorId === 'CUSTOM') {
      if (!customCompany.trim()) {
        setErrorMessage('Please enter a company name for the custom supplier.');
        setUploading(false);
        return;
      }
      payload.custom_company = customCompany.trim();
      payload.sender_email = customEmail.trim() || `billing@${customCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      payload.custom_gstin = customGstin.trim() || '29AAACC1234F1Z5';
    } else {
      payload.vendor_id = selectedVendorId;
    }

    try {
      const res = await api.simulateEmailIngestion(payload);
      const invoiceData = res.data.invoice || res.data;
      const vendorName = invoiceData.vendor_details?.name || customCompany || 'Supplier';

      setResults([{
        file: `Email_Attachment_${invoiceData.invoice_number}.pdf`,
        success: true,
        data: invoiceData,
        isEmail: true,
        vendorName: vendorName,
        senderEmail: payload.sender_email || selectedVendor?.email
      }]);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Email ingestion webhook failed');
    } finally {
      setUploading(false);
    }
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Module 1: Invoice Capture & Automated Ingestion</h2>
        <p className="text-xs text-slate-500 mt-1">
          Ingest supplier invoices via Direct Document Upload or simulate Automated Inbound Supplier Email transmissions.
        </p>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveChannel('email')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeChannel === 'email'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Automated Email Ingestion (Multi-Company)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('upload')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeChannel === 'upload'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Direct File Upload (PDF, Scans, TIFF)</span>
        </button>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Channel 1: Automated Email Ingestion */}
      {activeChannel === 'email' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Inbound Supplier Mailbox Simulator</h3>
                <p className="text-xs text-slate-500">
                  Select which supplier is sending the invoice to test enterprise automated email ingestion.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Gateway Active: invoices@templegate.corp
            </span>
          </div>

          {/* Supplier Selector */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select Sender Supplier / Company:</span>
            </label>

            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — ({v.email || 'No Email'}) | GSTIN: {v.gstin}
                </option>
              ))}
              <option value="CUSTOM">+ Enter Custom Company / Supplier...</option>
            </select>

            {/* Custom Supplier Fields */}
            {selectedVendorId === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Company Name *</label>
                  <input
                    type="text"
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    placeholder="e.g. Infosys BPM Logistics"
                    className="mt-1 w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Sender Email</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="e.g. billing@infosys.com"
                    className="mt-1 w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={customGstin}
                    onChange={(e) => setCustomGstin(e.target.value)}
                    placeholder="29AAACI1234F1Z1"
                    className="mt-1 w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Email Transmission Preview Card */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-600 uppercase text-[10px] tracking-wide">
                Simulated Inbound Transmission Details
              </span>
              <span className="text-[10px] text-slate-400">Protocol: IMAP / TLS 1.3</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="font-semibold text-slate-500">From: </span>
                <span className="font-bold text-slate-900">
                  {selectedVendorId === 'CUSTOM'
                    ? (customEmail || 'billing@customsupplier.com')
                    : (selectedVendor?.email || 'supplies@supplier.com')}
                </span>
                <span className="text-slate-500">
                  {' '}({selectedVendorId === 'CUSTOM' ? (customCompany || 'Custom Vendor') : selectedVendor?.name})
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">To: </span>
                <span className="font-bold text-indigo-700">invoices@templegate.corp</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Subject: </span>
                <span>
                  TAX INVOICE: {selectedVendorId === 'CUSTOM' ? (customCompany || 'Supplier') : selectedVendor?.name} [Transmitted]
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Attachment: </span>
                <span className="text-slate-800 font-mono">
                  Tax_Invoice_{selectedVendorId === 'CUSTOM' ? 'Custom' : (selectedVendor?.vendor_code || 'Supplier')}.pdf
                </span>
              </div>
            </div>
          </div>

          {/* Trigger Ingestion Action */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Attachment is parsed via OCR engine, line items extracted, and matched with Purchase Order.
            </p>
            <button
              type="button"
              onClick={handleSimulateEmailIngestion}
              disabled={uploading}
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {uploading
                  ? 'Ingesting & Running OCR...'
                  : `Ingest Email Invoice from ${
                      selectedVendorId === 'CUSTOM'
                        ? (customCompany || 'Supplier')
                        : (selectedVendor?.name?.split(' ')[0] || 'Supplier')
                    }`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Channel 2: Direct File Upload */}
      {activeChannel === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              Drag & Drop Invoices Here, or{' '}
              <label className="text-indigo-600 hover:underline cursor-pointer">
                Browse Files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supported formats: Native & Scanned PDF, JPG, PNG, TIFF (up to 50MB per batch)
            </p>
          </div>

          {/* Queued Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Files Ready for Processing ({selectedFiles.length})
                </span>
                <button
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {uploading ? 'Processing OCR Extraction...' : 'Start Extraction Pipeline →'}
                </button>
              </div>

              <div className="divide-y divide-slate-100 mt-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-800">{file.name}</span>
                      <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing Results & Direct Review Link */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Intake & OCR Extraction Outcome</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              {results.length} Document(s) Processed
            </span>
          </div>

          <div className="space-y-2">
            {results.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                  res.success ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {res.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{res.file}</span>
                      {res.isEmail ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                          Via Email: {res.senderEmail || res.data?.vendor_details?.email || 'Supplier Mailbox'}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          Direct File Upload
                        </span>
                      )}
                    </div>

                    {res.success ? (
                      <div className="text-[11px] text-slate-600 flex items-center space-x-3 flex-wrap gap-y-1">
                        <span><strong>Supplier:</strong> {res.data?.vendor_details?.name || res.vendorName || 'Identified'}</span>
                        <span>•</span>
                        <span><strong>Invoice #:</strong> {res.data?.invoice_number}</span>
                        <span>•</span>
                        <span><strong>Grand Total:</strong> ₹{parseFloat(res.data?.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">
                          OCR Confidence: {(parseFloat(res.data?.ocr_confidence_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-rose-700">{res.error}</p>
                    )}
                  </div>
                </div>

                {res.success && (
                  <button
                    onClick={() => onSelectInvoiceForReview(res.data.id)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex-shrink-0 ml-4 transition-all"
                  >
                    <span>Side-by-Side Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}