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
  Building,
  Activity,
  User,
  Key,
} from 'lucide-react';
import { useRole } from './RoleContext';
import { UserRole } from '../../pages/dashboard/types';

interface TopNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAuth?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ activeTab, onTabChange, onOpenAuth }) => {
  const { currentRole, setCurrentRole, roleInfo, allRoles } = useRole();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
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

  const navItems = [
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'master-data', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance & Shifts', icon: Clock },
    { id: 'payroll', label: 'Payroll Batches', icon: CreditCard },
    { id: 'loans', label: 'Loans & EMI', icon: Coins },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'tax', label: 'Statutory Tax', icon: Calculator },
    { id: 'notifications', label: 'Dispatch Center', icon: Radio },
  ];

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
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab.startsWith(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold transition border-b-2 ${
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

          {/* Right Section: System Indicator & Role-Switcher Dropdown */}
          <div className="flex items-center space-x-3">
            {/* Quick Printable Payslip Link */}
            <button
              onClick={() => onTabChange('printable-payslip')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'printable-payslip'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Print Sample Payslip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Sample Slip</span>
            </button>

            {/* Active Role-Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline text-gray-500 font-normal">Role:</span>
                <span className="font-bold text-gray-900">{roleInfo.name}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
              </button>

              {/* Role Dropdown Menu */}
              {dropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-72 rounded-xl shadow-lg bg-white ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-hidden z-50">
                  <div className="px-4 py-3 bg-gray-50/70 rounded-t-xl">
                    <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600" /> Granular RBAC Persona Switcher
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Switch user role to test granular module restrictions & field permissions.
                    </p>
                  </div>
                  <div className="py-1">
                    {allRoles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => {
                          setCurrentRole(role.id as UserRole);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-indigo-50/50 transition ${
                          currentRole === role.id ? 'bg-indigo-50/80 text-indigo-900 font-bold' : 'text-gray-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                            {role.name}
                            {role.id === 'super_admin' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-100 text-purple-700 font-bold">
                                Super
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-normal">{role.description}</div>
                        </div>
                        {currentRole === role.id && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auth / Login Modal trigger */}
            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition"
                title="Authentication & Users"
              >
                <Key className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row (Horizontal Scroll) */}
        <div className="xl:hidden flex items-center space-x-2 py-2 overflow-x-auto no-scrollbar border-t border-slate-100">
          {navItems.map((item) => {
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
