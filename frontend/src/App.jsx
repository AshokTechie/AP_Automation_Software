import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InvoiceCapture from './pages/InvoiceCapture';
import InvoicesList from './pages/InvoicesList';
import OCRReview from './pages/OCRReview';
import MatchingInspection from './pages/MatchingInspection';
import ExceptionQueue from './pages/ExceptionQueue';
import ApprovalInbox from './pages/ApprovalInbox';
import VendorManagement from './pages/VendorManagement';
import ProcurementManagement from './pages/ProcurementManagement';
import PaymentProcessing from './pages/PaymentProcessing';
import Reports from './pages/Reports';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [activeExceptionsCount, setActiveExceptionsCount] = useState(0);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadNotificationCounts();
  }, [activeTab]);

  const loadCurrentUser = async () => {
    try {
      const res = await api.getCurrentUser();
      setCurrentUser(res.data);
      if (res.data?.profile?.role) {
        localStorage.setItem('user_role', res.data.profile.role);
      }
    } catch (err) {
      console.log('No logged in user session, using demo default');
    }
  };

  const loadNotificationCounts = async () => {
    try {
      const [appRes, excRes] = await Promise.all([
        api.getApprovalRequests({ status: 'PENDING' }),
        api.getExceptions({ resolved: 'false' })
      ]);
      const appCount = appRes.data.results ? appRes.data.results.length : appRes.data.length;
      const excCount = excRes.data.results ? excRes.data.results.length : excRes.data.length;
      setPendingApprovalsCount(appCount);
      setActiveExceptionsCount(excCount);
    } catch (err) {
      console.error('Failed to load notification counts', err);
    }
  };

  const handleSwitchRole = async (newRole) => {
    try {
      localStorage.setItem('user_role', newRole);
      const res = await api.switchRole(newRole);
      setCurrentUser(res.data.user);
      loadNotificationCounts();
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  const navigateToReview = (invId) => {
    setSelectedInvoiceId(invId);
    setActiveTab('ocr-review');
  };

  const navigateToMatching = (invId) => {
    setSelectedInvoiceId(invId);
    setActiveTab('matching');
  };

  const navigateToApprovals = () => {
    setActiveTab('approvals');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
          pendingApprovalsCount={pendingApprovalsCount}
          activeExceptionsCount={activeExceptionsCount}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard onNavigateTo={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'upload' && (
            <InvoiceCapture onSelectInvoiceForReview={navigateToReview} />
          )}

          {activeTab === 'invoices' && (
            <InvoicesList
              onSelectInvoiceForReview={navigateToReview}
              onSelectInvoiceForMatching={navigateToMatching}
            />
          )}

          {activeTab === 'ocr-review' && (
            <OCRReview
              invoiceId={selectedInvoiceId}
              onBackToList={() => setActiveTab('invoices')}
              onNavigateToMatching={navigateToMatching}
            />
          )}

          {activeTab === 'matching' && (
            <MatchingInspection
              invoiceId={selectedInvoiceId}
              onBackToList={() => setActiveTab('invoices')}
              onNavigateToApprovals={navigateToApprovals}
            />
          )}

          {activeTab === 'exceptions' && (
            <ExceptionQueue onSelectInvoiceForReview={navigateToReview} />
          )}

          {activeTab === 'approvals' && (
            <ApprovalInbox
              currentUser={currentUser}
              onSelectInvoiceForReview={navigateToReview}
            />
          )}

          {activeTab === 'vendors' && <VendorManagement />}

          {activeTab === 'procurement' && <ProcurementManagement />}

          {activeTab === 'payments' && <PaymentProcessing />}

          {activeTab === 'reports' && <Reports />}
        </main>
      </div>
    </div>
  );
}
