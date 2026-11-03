import axios from 'axios';

const API_BASE = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const role = localStorage.getItem('user_role');
  if (role) {
    config.headers['X-Persona-Role'] = role;
  }
  return config;
});

export const api = {
  // Authentication & Personas
  getCurrentUser: () => apiClient.get('/core/auth/me/'),
  switchRole: (role) => apiClient.post('/core/auth/switch-role/', { role }),
  getAuditLogs: (params) => apiClient.get('/core/audit-logs/', { params }),

  // Dashboard & Analytics
  getDashboardSummary: () => apiClient.get('/analytics/dashboard-summary/'),
  getGSTReport: () => apiClient.get('/analytics/reports/gst-tax/'),
  getExceptionsSummary: () => apiClient.get('/analytics/reports/exceptions-summary/'),

  // Invoices & OCR
  getInvoices: (params) => apiClient.get('/invoices/invoices/', { params }),
  getInvoice: (id) => apiClient.get(`/invoices/invoices/${id}/`),
  uploadInvoice: (formData) => apiClient.post('/invoices/invoices/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  simulateEmailIngestion: (payload) => apiClient.post('/invoices/invoices/email-ingestion/', payload || {}),
  editInvoiceField: (invoiceId, payload) => apiClient.post(`/invoices/invoices/${invoiceId}/edit-field/`, payload),
  apApproveChanges: (invoiceId, notes) => apiClient.post(`/invoices/invoices/${invoiceId}/ap-approve-changes/`, { notes }),

  // Matching
  evaluateMatch: (invoiceId, tolerance) => apiClient.post(`/matching/evaluate/${invoiceId}/`, { price_tolerance_pct: tolerance }),
  overrideMatch: (invoiceId, reason) => apiClient.post(`/matching/override/${invoiceId}/`, { reason }),

  // Exceptions
  getExceptions: (params) => apiClient.get('/exceptions-mgmt/exceptions/', { params }),
  resolveException: (id, resolution_notes) => apiClient.post(`/exceptions-mgmt/exceptions/${id}/resolve/`, { resolution_notes }),

  // Workflows & Approvals
  getApprovalRequests: (params) => apiClient.get('/workflows/requests/', { params }),
  initiateApproval: (invoiceId) => apiClient.post(`/workflows/initiate/${invoiceId}/`),
  actionApproval: (approvalId, decision, comments) => apiClient.post(`/workflows/requests/${approvalId}/action/`, { decision, comments }),
  getApprovalRules: () => apiClient.get('/workflows/rules/'),

  // Vendors
  getVendors: (params) => apiClient.get('/vendors/vendors/', { params }),
  getVendor: (id) => apiClient.get(`/vendors/vendors/${id}/`),
  verifyVendorBank: (vendorId, accountId) => apiClient.post(`/vendors/vendors/${vendorId}/verify-bank/`, { account_id: accountId }),
  verifyVendorGSTIN: (vendorId) => apiClient.post(`/vendors/vendors/${vendorId}/verify-gstin/`),

  // Procurement (PO & GRN)
  getPurchaseOrders: (params) => apiClient.get('/procurement/purchase-orders/', { params }),
  getGoodsReceipts: (params) => apiClient.get('/procurement/goods-receipts/', { params }),
  uploadImportBatch: (formData) => apiClient.post('/procurement/imports/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  commitImportBatch: (batchId) => apiClient.post(`/procurement/imports/${batchId}/commit/`),

  // Payments
  getPayments: (params) => apiClient.get('/payments/requests/', { params }),
  generatePaymentRequest: (payload) => apiClient.post('/payments/requests/generate-request/', payload),
  dispatchPaymentToBank: (id) => apiClient.post(`/payments/requests/${id}/dispatch-to-bank/`),
  confirmPaymentSettlement: (id, utr_number) => apiClient.post(`/payments/requests/${id}/confirm-settlement/`, { utr_number }),
  failPaymentSettlement: (id, reason) => apiClient.post(`/payments/requests/${id}/fail-settlement/`, { reason }),
};

export default api;
