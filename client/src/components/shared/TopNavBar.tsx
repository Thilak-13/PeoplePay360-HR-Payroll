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
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => onTabChange('analytics')}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                P
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-slate-900">
                  PeoplePay<span className="text-indigo-600">360</span>
                </span>
              </div>
            </div>

            {/* Main Navigation Links */}
            <nav className="hidden xl:flex items-center space-x-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab.startsWith(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
          <div className="flex items-center space-x-2.5">
            {/* Quick Printable Payslip Link */}
            <button
              onClick={() => onTabChange('printable-payslip')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer ${
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
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline text-slate-400 font-normal">Role:</span>
                <span className="font-semibold text-slate-900">{roleInfo.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>

              {/* Clean Role Dropdown Menu */}
              {dropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-72 rounded-xl shadow-lg bg-white border border-slate-200 ring-1 ring-black/5 divide-y divide-slate-100 focus:outline-none z-50 text-slate-900">
                  <div className="px-3.5 py-2.5 bg-slate-50 rounded-t-xl">
                    <p className="text-xs font-semibold text-slate-900">
                      Switch Role View
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Test permissions and UI layouts across roles.
                    </p>
                  </div>
                  <div className="p-1 space-y-0.5">
                    {allRoles.map((acc) => {
                      const isCurrent = currentRole === acc.role;
                      return (
                        <button
                          key={acc.role}
                          disabled={switching}
                          onClick={() => handleRoleSwitch(acc.role)}
                          className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-50 text-indigo-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="mt-0.5">
                              <Shield className={`w-3.5 h-3.5 ${acc.color}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{acc.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">{acc.email}</div>
                            </div>
                          </div>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
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
                <span className="text-xs font-medium text-slate-700 hidden md:inline truncate max-w-[120px]">
                  {user?.email ? user.email.split('@')[0] : 'Account'}
                </span>
              </button>
            )}

            {/* Sign Out Button */}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition cursor-pointer"
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
                className={`inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-medium whitespace-nowrap rounded-lg transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100'
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

