import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  FileCheck,
  Calendar,
  Clock,
  CalendarDays,
  Shuffle,
  CreditCard,
  Sliders,
  Coins,
  Receipt,
  Calculator,
  FileBadge,
  Radio,
  Printer,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from '../../pages/auth/AuthContext';
import { useRole } from './RoleContext';
import { UserRole } from '../../pages/auth/types';

interface SidebarProps {
  activeTab: string;
  activeSubTab?: string;
  onNavigate: (tab: string, subTab?: string) => void;
  onOpenProfile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeSubTab,
  onNavigate,
  onOpenProfile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const {
    currentRole,
    roleInfo,
    allRoles,
    switchPersona,
    isSelfServiceOnly,
    canManageEmployees,
    canRunPayroll,
  } = useRole();

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleRoleSwitch = async (targetRole: UserRole) => {
    setSwitching(true);
    try {
      await switchPersona(targetRole);
      setRoleDropdownOpen(false);
    } finally {
      setSwitching(false);
    }
  };

  interface NavSection {
    title: string;
    items: {
      id: string;
      subTab?: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      visible: boolean;
    }[];
  }

  const sections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { id: 'analytics', label: 'Dashboard', icon: TrendingUp, visible: true },
      ],
    },
    {
      title: 'Workforce & HR',
      items: [
        {
          id: 'master-data',
          subTab: 'employees',
          label: 'Employees',
          icon: Users,
          visible: canManageEmployees,
        },
        {
          id: 'master-data',
          subTab: 'contracts',
          label: 'Contracts',
          icon: FileCheck,
          visible: canManageEmployees,
        },
        {
          id: 'master-data',
          subTab: 'leaves',
          label: isSelfServiceOnly ? 'My Time Off' : 'Time Off & Leaves',
          icon: Calendar,
          visible: true,
        },
      ],
    },
    {
      title: 'Attendance',
      items: [
        {
          id: 'attendance',
          subTab: 'tracker',
          label: isSelfServiceOnly ? 'My Clock-In' : 'Clock-In & Status',
          icon: Clock,
          visible: true,
        },
        {
          id: 'attendance',
          subTab: 'daily',
          label: 'Daily Punches',
          icon: CalendarDays,
          visible: !isSelfServiceOnly,
        },
        {
          id: 'attendance',
          subTab: 'shifts',
          label: 'Shift Rosters',
          icon: Shuffle,
          visible: !isSelfServiceOnly,
        },
      ],
    },
    {
      title: 'Payroll',
      items: [
        {
          id: 'payroll',
          subTab: 'payruns',
          label: isSelfServiceOnly ? 'My Payslips' : 'Payrun Batches',
          icon: CreditCard,
          visible: canRunPayroll || isSelfServiceOnly,
        },
        {
          id: 'payroll',
          subTab: 'structures',
          label: 'Salary Structures',
          icon: Sliders,
          visible: canRunPayroll,
        },
      ],
    },
    {
      title: 'Financials',
      items: [
        {
          id: 'loans',
          subTab: 'manager',
          label: isSelfServiceOnly ? 'My Loans' : 'Loans & Advances',
          icon: Coins,
          visible: true,
        },
        {
          id: 'expenses',
          label: isSelfServiceOnly ? 'My Expenses' : 'Expense Claims',
          icon: Receipt,
          visible: true,
        },
      ],
    },
    {
      title: 'Tax & Compliance',
      items: [
        {
          id: 'tax',
          subTab: 'portal',
          label: 'Tax Declarations',
          icon: Calculator,
          visible: true,
        },
        {
          id: 'tax',
          subTab: 'verification',
          label: 'Proof Verification',
          icon: FileBadge,
          visible: !isSelfServiceOnly,
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          id: 'notifications',
          label: 'Dispatch Center',
          icon: Radio,
          visible: !isSelfServiceOnly,
        },
        {
          id: 'printable-payslip',
          label: 'Sample Payslip',
          icon: Printer,
          visible: true,
        },
      ],
    },
  ];

  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      className={`bg-white border-r border-slate-200/80 flex flex-col transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-15 px-4 border-b border-slate-100 flex items-center justify-between">
        {!isCollapsed ? (
          <div
            className="flex items-center space-x-2.5 cursor-pointer min-w-0"
            onClick={() => onNavigate('analytics')}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              P
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold tracking-tight text-slate-900 truncate block">
                PeoplePay<span className="text-indigo-600">360</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide truncate block">
                HR &amp; Payroll Workspace
              </span>
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs mx-auto cursor-pointer"
            onClick={() => onNavigate('analytics')}
            title="PeoplePay360"
          >
            P
          </div>
        )}

        {/* Toggle Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Role Switcher Pill in Sidebar */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-xs transition cursor-pointer ${
              isCollapsed ? 'justify-center px-1.5' : ''
            }`}
            title={`Active Role: ${roleInfo.name}`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <Shield className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Role
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate block">
                    {roleInfo.name}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {/* Role Dropdown */}
          {roleDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl shadow-lg bg-white border border-slate-200 ring-1 ring-black/5 divide-y divide-slate-100 z-50 text-slate-900">
              <div className="px-3 py-2 bg-slate-50 rounded-t-xl">
                <p className="text-xs font-semibold text-slate-900">Switch Persona</p>
                <p className="text-[10px] text-slate-500">Test access per role</p>
              </div>
              <div className="p-1 space-y-0.5 max-h-56 overflow-y-auto">
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
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className={`w-3.5 h-3.5 ${acc.color} flex-shrink-0`} />
                        <span className="truncate">{acc.label}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-4 no-scrollbar">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isTabActive = activeTab === item.id;
                  const isSubTabActive = item.subTab
                    ? activeSubTab === item.subTab && isTabActive
                    : isTabActive;

                  return (
                    <button
                      key={`${item.id}-${item.subTab || 'root'}`}
                      onClick={() => onNavigate(item.id, item.subTab)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isSubTabActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      } ${isCollapsed ? 'justify-center px-2' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSubTabActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / User Profile Profile & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 text-left p-1 rounded-lg hover:bg-white transition cursor-pointer min-w-0"
            title="Account settings"
          >
            <div className="w-7 h-7 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-800 block truncate">
                  {user?.email ? user.email.split('@')[0] : 'User'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {roleInfo.name}
                </span>
              </div>
            )}
          </button>

          {!isCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
