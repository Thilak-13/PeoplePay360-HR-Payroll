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
    canAccessPayroll,
    canManageUsers,
    canViewDashboard,
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

  const sections: NavSection[] = isSelfServiceOnly
    ? [
        {
          title: 'My Self-Service',
          items: [
            {
              id: 'master-data',
              subTab: 'employees',
              label: 'My Details',
              icon: Users,
              visible: true,
            },
            {
              id: 'attendance',
              subTab: 'daily',
              label: 'Attendance Records',
              icon: CalendarDays,
              visible: true,
            },
            {
              id: 'master-data',
              subTab: 'leaves',
              label: 'Leave Balances & Time Off',
              icon: Calendar,
              visible: true,
            },
            {
              id: 'attendance',
              subTab: 'tracker',
              label: 'Clock-In Entry',
              icon: Clock,
              visible: true,
            },
            {
              id: 'payroll',
              subTab: 'payslips',
              label: 'My Payslips',
              icon: CreditCard,
              visible: true,
            },
          ],
        },
      ]
    : [
        {
          title: 'Overview',
          items: [
            { id: 'analytics', label: 'Dashboard', icon: TrendingUp, visible: canViewDashboard },
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
              visible: true,
            },
            {
              id: 'master-data',
              subTab: 'contracts',
              label: 'Contracts',
              icon: FileCheck,
              visible: canManageEmployees,
            },
            {
              id: 'attendance',
              subTab: 'shifts',
              label: 'Working Schedules',
              icon: Shuffle,
              visible: canManageEmployees,
            },
            {
              id: 'master-data',
              subTab: 'leaves',
              label: 'Time Off & Leaves',
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
              label: 'Clock-In & Status',
              icon: Clock,
              visible: true,
            },
            {
              id: 'attendance',
              subTab: 'daily',
              label: 'Attendance Records',
              icon: CalendarDays,
              visible: true,
            },
          ],
        },
        {
          title: 'Payroll',
          items: [
            {
              id: 'payroll',
              subTab: 'payruns',
              label: 'Payruns & Payslips',
              icon: CreditCard,
              visible: canAccessPayroll,
            },
            {
              id: 'payroll',
              subTab: 'structures',
              label: 'Salary Structures & Rules',
              icon: Sliders,
              visible: canAccessPayroll,
            },
          ],
        },
        {
          title: 'Administration',
          items: [
            {
              id: 'user-management',
              label: 'User Management & Roles',
              icon: Shield,
              visible: canManageUsers,
            },
          ],
        },
      ];

  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'U';

  const handleBrandClick = () => {
    if (isSelfServiceOnly || !canViewDashboard) {
      if (canAccessPayroll) {
        onNavigate('payroll', 'payruns');
      } else {
        onNavigate('master-data', 'employees');
      }
    } else {
      onNavigate('analytics');
    }
  };

  return (
    <aside
      className={`bg-[#0f172a] border-r border-slate-800/80 flex flex-col transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-15 px-4 border-b border-slate-800/80 flex items-center justify-between">
        {!isCollapsed ? (
          <div
            className="flex items-center space-x-2.5 cursor-pointer min-w-0"
            onClick={handleBrandClick}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              P
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-tight text-white truncate block">
                PeoplePay<span className="text-slate-400">360</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide truncate block">
                {isSelfServiceOnly ? 'Employee Portal' : !canAccessPayroll ? 'HR Management' : 'HR & Payroll Workspace'}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-sm shadow-xs mx-auto cursor-pointer"
            onClick={handleBrandClick}
            title="PeoplePay360"
          >
            P
          </div>
        )}

        {/* Toggle Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
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
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-xs transition cursor-pointer ${
              isCollapsed ? 'justify-center px-1.5' : ''
            }`}
            title={`Active Role: ${roleInfo.name}`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">
                    Role Persona
                  </span>
                  <span className="text-xs font-medium text-slate-200 truncate block">
                    {roleInfo.name}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {/* Role Dropdown */}
          {roleDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl shadow-xl bg-slate-900 border border-slate-800 divide-y divide-slate-800 z-50 text-slate-200">
              <div className="px-3 py-2 bg-slate-950/50 rounded-t-xl">
                <p className="text-xs font-semibold text-white">Switch Persona</p>
                <p className="text-[10px] text-slate-400">Test access per enterprise role</p>
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
                          ? 'bg-slate-800 text-white font-medium'
                          : 'hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="truncate block font-medium">{acc.label}</span>
                          {acc.userName && (
                            <span className="text-[10px] text-slate-400 truncate block">{acc.userName} ({acc.email})</span>
                          )}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
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
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                          ? 'bg-slate-800 text-white font-medium border-l-2 border-indigo-400 pl-2'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      } ${isCollapsed ? 'justify-center px-2' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSubTabActive ? 'text-indigo-400' : 'text-slate-400'
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

      {/* Footer / User Profile & Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/30">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 text-left p-1 rounded-lg hover:bg-slate-800/60 transition cursor-pointer min-w-0"
            title="Account settings"
          >
            <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 text-white font-medium text-xs flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-200 block truncate">
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
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition cursor-pointer"
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
