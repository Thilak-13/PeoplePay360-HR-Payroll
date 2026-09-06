import React from 'react';
import { Menu, User as UserIcon, LogOut } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '../../pages/auth/AuthContext';
import { useRole } from './RoleContext';

interface TopBarProps {
  activeTab: string;
  activeSubTab?: string;
  selectedEmployeeId?: number | null;
  selectedPayrunId?: number | null;
  selectedPayslipId?: number | null;
  onNavigate: (tab: string, subTab?: string) => void;
  onResetEmployee?: () => void;
  onResetPayrun?: () => void;
  onResetPayslip?: () => void;
  onOpenProfile: () => void;
  onToggleMobileSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  activeSubTab,
  selectedEmployeeId,
  selectedPayrunId,
  selectedPayslipId,
  onNavigate,
  onResetEmployee,
  onResetPayrun,
  onResetPayslip,
  onOpenProfile,
  onToggleMobileSidebar,
}) => {
  const { user, logout } = useAuth();
  const { roleInfo } = useRole();

  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="h-15 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs no-print">
      {/* Left: Mobile menu toggle + Breadcrumbs */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumbs */}
        <Breadcrumbs
          activeTab={activeTab}
          activeSubTab={activeSubTab}
          selectedEmployeeId={selectedEmployeeId}
          selectedPayrunId={selectedPayrunId}
          selectedPayslipId={selectedPayslipId}
          onNavigate={onNavigate}
          onResetEmployee={onResetEmployee}
          onResetPayrun={onResetPayrun}
          onResetPayslip={onResetPayslip}
        />
      </div>

      {/* Right: profile summary + Sign Out */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Profile Pill Trigger */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 p-1 pr-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          title="Account Settings"
        >
          <div className="w-6 h-6 rounded-md bg-slate-800 text-white font-medium text-[11px] flex items-center justify-center">
            {initials}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <span className="font-medium text-slate-800 block leading-tight max-w-[140px] truncate">
              {user?.email || 'Account'}
            </span>
          </div>
        </button>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
          title="Sign Out / Back to Login"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
};
