import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown } from 'lucide-react';

export default function Navbar({ currentUser, onSwitchRole, pendingApprovalsCount, activeExceptionsCount }) {
  const [selectedRole, setSelectedRole] = useState(
    currentUser?.profile?.role || localStorage.getItem('user_role') || 'AP_CLERK'
  );

  const personas = [
    {
      key: 'AP_CLERK',
      name: 'Priya Sharma',
      roleTitle: 'AP Specialist',
      initials: 'PS',
      limit: '₹25,000 Limit',
      avatarBg: 'bg-indigo-600'
    },
    {
      key: 'FINANCE_MANAGER',
      name: 'Ananya Roy',
      roleTitle: 'Finance Manager',
      initials: 'AR',
      limit: '₹5,00,000 Limit',
      avatarBg: 'bg-emerald-600'
    },
    {
      key: 'CFO',
      name: 'Vikram Malhotra',
      roleTitle: 'Chief Financial Officer',
      initials: 'VM',
      limit: '₹1,00,00,000 Limit',
      avatarBg: 'bg-purple-600'
    },
    {
      key: 'PURCHASING',
      name: 'Rahul Verma',
      roleTitle: 'Purchasing Officer',
      initials: 'RV',
      limit: '₹1,00,000 Limit',
      avatarBg: 'bg-amber-600'
    },
    {
      key: 'WAREHOUSE',
      name: 'Suresh Kumar',
      roleTitle: 'Warehouse Officer',
      initials: 'SK',
      limit: '₹50,000 Limit',
      avatarBg: 'bg-blue-600'
    },
    {
      key: 'ADMIN',
      name: 'System Admin',
      roleTitle: 'Full Access Administrator',
      initials: 'SA',
      limit: 'Unlimited',
      avatarBg: 'bg-slate-700'
    },
  ];

  const currentPersona = personas.find((p) => p.key === selectedRole) || personas[0];

  useEffect(() => {
    if (currentUser?.profile?.role) {
      setSelectedRole(currentUser.profile.role);
    }
  }, [currentUser?.profile?.role]);

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setSelectedRole(newRole);
    onSwitchRole(newRole);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Organization */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm ring-1 ring-black/5">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              Templegate AP Automation
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Enterprise AP
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Intelligent OCR & 3-Way Matching Platform
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* Action Counters (Exceptions & Approvals) */}
        <div className="flex items-center space-x-2">
          {activeExceptionsCount > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              <span>{activeExceptionsCount} Exceptions</span>
            </div>
          )}
          {pendingApprovalsCount > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
              <span>{pendingApprovalsCount} Approvals Due</span>
            </div>
          )}
        </div>

        {/* Enterprise User Persona Switcher */}
        <div className="relative flex items-center bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-1.5 transition-all shadow-2xs">
          {/* Avatar Initials */}
          <div className={`w-7 h-7 rounded-lg ${currentPersona.avatarBg} text-white font-bold text-[11px] flex items-center justify-center mr-2.5 shadow-xs`}>
            {currentPersona.initials}
          </div>

          {/* User & Role Details */}
          <div className="text-left pr-6">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-900 leading-tight">
                {currentPersona.name}
              </span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-200/70 text-slate-700 font-medium hidden sm:inline">
                {currentPersona.limit}
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500">
              {currentPersona.roleTitle}
            </p>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />

          {/* Invisible Overlay Select for Smooth Role Switching */}
          <select
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={selectedRole}
            onChange={handleRoleChange}
            title="Switch User Persona"
          >
            {personas.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} — {p.roleTitle} ({p.limit})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
