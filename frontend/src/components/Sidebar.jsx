import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  ScanEye,
  GitCompare,
  AlertTriangle,
  CheckCircle,
  Building2,
  Package,
  CreditCard,
  BarChart3,
  BookOpen
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Invoice Capture', icon: UploadCloud, badge: 'Dropzone' },
    { id: 'invoices', label: 'All Invoices', icon: FileText },
    { id: 'ocr-review', label: 'Side-by-Side OCR Review', icon: ScanEye },
    { id: 'matching', label: 'PO / GRN Matching', icon: GitCompare },
    { id: 'exceptions', label: 'Exception Queue', icon: AlertTriangle },
    { id: 'approvals', label: 'Approval Inbox', icon: CheckCircle },
    { id: 'vendors', label: 'Vendor Master', icon: Building2 },
    { id: 'procurement', label: 'POs & GRNs (Excel Import)', icon: Package },
    { id: 'payments', label: 'Payment Processing', icon: CreditCard },
    { id: 'reports', label: 'Reports & Audit Logs', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 min-h-screen">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Navigation Menu
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-slate-400 text-[11px] leading-relaxed">
        <p className="font-medium text-slate-300">Templegate Technologies</p>
        <p>Assignment Submission Build</p>
        <p className="text-slate-500 mt-1">Django 5 + ReactJS + PostgreSQL</p>
      </div>
    </aside>
  );
}
