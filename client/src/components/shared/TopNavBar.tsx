import React, { useState, useRef, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  CreditCard,
  Printer,
  Clock,
  Coins,
  Receipt,
  Calculator,
  Radio,
  ChevronDown,
  Shield,
  Check,
  User as UserIcon,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../pages/auth/AuthContext';
import { useRole } from './RoleContext';
import { UserRole } from '../../pages/auth/types';

interface TopNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenProfile?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ activeTab, onTabChange, onOpenProfile }) => {
  const { user, logout } = useAuth();
  const { currentRole, roleInfo, allRoles, switchPersona, isSelfServiceOnly, canManageEmployees, canRunPayroll } = useRole();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [switching, setSwitching] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSwitch = async (targetRole: UserRole) => {
    setSwitching(true);
    try {
      await switchPersona(targetRole);
      setDropdownOpen(false);
    } finally {
      setSwitching(false);
    }
  };

  // Role-gated Navigation items
  const allNavItems = [
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, visible: true },
    { id: 'master-data', label: 'Employees', icon: Users, visible: canManageEmployees },
    { id: 'attendance', label: isSelfServiceOnly ? 'My Attendance' : 'Attendance & Shifts', icon: Clock, visible: true },
    { id: 'payroll', label: isSelfServiceOnly ? 'My Payslips' : 'Payroll Batches', icon: CreditCard, visible: canRunPayroll || isSelfServiceOnly },
    { id: 'loans', label: isSelfServiceOnly ? 'My Loans' : 'Loans & EMI', icon: Coins, visible: true },
    { id: 'expenses', label: isSelfServiceOnly ? 'My Expenses' : 'Expenses', icon: Receipt, visible: true },
    { id: 'tax', label: isSelfServiceOnly ? 'Tax Declarations' : 'Statutory Tax', icon: Calculator, visible: true },
    { id: 'notifications', label: 'Dispatch Center', icon: Radio, visible: !isSelfServiceOnly },
  ];

  const visibleNavItems = allNavItems.filter((i) => i.visible);

  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => onTabChange('analytics')}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                P
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-gray-900">
                  PeoplePay<span className="text-indigo-600">360</span>
                </span>
                <span className="block text-[9px] uppercase font-bold tracking-wider text-gray-400 -mt-1">
                  Enterprise HR & Payroll ERP
                </span>
              </div>
            </div>

            {/* Main Navigation Links */}
            <nav className="hidden xl:flex space-x-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab.startsWith(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold transition border-b-2 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/70 text-indigo-700 border-indigo-600 rounded-t-lg'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent rounded-lg'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Persona Switcher, User Avatar, Sign Out */}
          <div className="flex items-center space-x-3">
            {/* Quick Printable Payslip Link */}
            <button
              onClick={() => onTabChange('printable-payslip')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                activeTab === 'printable-payslip'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Print Sample Payslip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Sample Slip</span>
            </button>

            {/* Active Role & Persona Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline text-gray-500 font-normal">Role:</span>
                <span className="font-bold text-gray-900">{roleInfo.name}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
              </button>

              {/* Role Dropdown Menu */}
              {dropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl bg-slate-900 border border-slate-800 ring-1 ring-black/5 divide-y divide-slate-800 focus:outline-none z-50 text-slate-100 animate-fade-in">
                  <div className="px-4 py-3 bg-slate-950/60 rounded-t-2xl">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Instant Persona Switcher
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Switch authenticated accounts to test role-specific portals and permissions.
                    </p>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {allRoles.map((acc) => {
                      const isCurrent = currentRole === acc.role;
                      return (
                        <button
                          key={acc.role}
                          disabled={switching}
                          onClick={() => handleRoleSwitch(acc.role)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-950/80 border border-indigo-700/80 text-white font-bold'
                              : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="mt-0.5">
                              <Shield className={`w-3.5 h-3.5 ${acc.color}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{acc.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">{acc.email}</div>
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Button */}
            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                title="Account Settings"
              >
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center">
                  {initials}
                </div>
                <span className="text-xs font-semibold text-slate-700 hidden md:inline truncate max-w-[120px]">
                  {user?.email ? user.email.split('@')[0] : 'Account'}
                </span>
              </button>
            )}

            {/* Real Sign Out Button */}
            <button
              onClick={logout}
              className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row (Horizontal Scroll) */}
        <div className="xl:hidden flex items-center space-x-2 py-2 overflow-x-auto no-scrollbar border-t border-slate-100">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab.startsWith(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold whitespace-nowrap rounded-lg transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 bg-gray-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

