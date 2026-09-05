import React, { useState, useRef, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  CreditCard,
  Printer,
  ChevronDown,
  Shield,
  Check,
  Building,
  Activity,
} from 'lucide-react';
import { useRole } from './RoleContext';
import { UserRole } from '../../pages/dashboard/types';

interface TopNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ activeTab, onTabChange }) => {
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
    { id: 'analytics', label: 'Analytics Dashboard', icon: TrendingUp },
    { id: 'master-data', label: 'Employees Directory', icon: Users },
    { id: 'payroll', label: 'Payroll Batches', icon: CreditCard },
    { id: 'printable-payslip', label: 'Printable Payslip', icon: Printer },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-8">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => onTabChange('analytics')}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                P
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-gray-900">
                  PeoplePay<span className="text-indigo-600">360</span> ERP
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 -mt-1">
                  Enterprise HR & Payroll
                </span>
              </div>
            </div>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab.startsWith(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`inline-flex items-center space-x-2 px-3.5 py-2 text-sm font-semibold transition border-b-2 ${
                      isActive
                        ? 'bg-indigo-50/70 text-indigo-700 border-indigo-600 rounded-t-lg'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent rounded-lg'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Section: System Indicator & Role-Switcher Dropdown Context */}
          <div className="flex items-center space-x-4">
            {/* System Status Pill */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>API Ready</span>
            </div>

            {/* Active Role-Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-xl border border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-white text-sm font-medium transition shadow-2xs"
                title="Switch Active User Role"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-[10px] uppercase font-bold text-gray-400 leading-tight">
                    Active Context
                  </span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${roleInfo.badgeBg} ${roleInfo.badgeColor} border ${roleInfo.badgeBorder}`}>
                    {currentRole}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Switch Active Role
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Change role context to test authorization tiers and workflows.
                    </p>
                  </div>

                  <div className="py-1">
                    {allRoles.map((role) => {
                      const isSelected = role === currentRole;
                      return (
                        <button
                          key={role}
                          onClick={() => {
                            setCurrentRole(role);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 flex items-start space-x-3 text-sm transition hover:bg-gray-50 ${
                            isSelected ? 'bg-indigo-50/60 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isSelected ? (
                              <Check className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="block text-gray-900">{role}</span>
                            <span className="block text-[11px] text-gray-400 font-normal leading-tight mt-0.5">
                              {role === 'Admin' && 'Full platform and database oversight'}
                              {role === 'HR Manager' && 'Employee and contract management'}
                              {role === 'HR Payroll User' && 'Payrun batch calculation'}
                              {role === 'HR Payroll Manager' && 'Payment and state approvals'}
                              {role === 'Employee' && 'Self-service payslip and leave view'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 rounded-b-2xl">
                    <strong className="text-gray-700">Current Scope:</strong> {roleInfo.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
