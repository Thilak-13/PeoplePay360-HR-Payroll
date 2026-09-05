import React, { useState } from 'react';
import { useAuth } from '../../pages/auth/AuthContext';
import { useRole } from './RoleContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { LoginScreen, UserProfile } from '../../pages/auth';
import { PayrollDashboard } from '../../pages/dashboard';
import {
  EmployeeList,
  EmployeeDetail,
  ContractManager,
  LeaveManager,
} from '../../pages/master-data';
import {
  PayrunList,
  PayrunDetail,
  SalaryStructureManager,
  PayslipDetail,
} from '../../pages/payroll';
import {
  AttendanceTracker,
  DailyPunches,
  ShiftManager,
} from '../../pages/attendance';
import { UserManagement } from '../../pages/admin/UserManagement';
import { X } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { canManageEmployees, canRunPayroll, isSelfServiceOnly } = useRole();

  const [activeTab, setActiveTab] = useState<string>('analytics');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);
  const [selectedPayrunId, setSelectedPayrunId] = useState<number | null>(null);

  // Sub-tabs for domain navigation
  const [masterSubTab, setMasterSubTab] = useState<'employees' | 'contracts' | 'leaves' | 'schedules'>('employees');
  const [payrollSubTab, setPayrollSubTab] = useState<'payruns' | 'structures'>('payruns');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'tracker' | 'daily' | 'shifts'>('tracker');

  // Sidebar collapse state & mobile drawer state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Profile modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // 1. Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-200">
        <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-400">Loading PeoplePay360...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleNavigate = (tab: string, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'master-data') {
      if (subTab) setMasterSubTab(subTab as any);
      setSelectedEmployeeId(null);
    } else if (tab === 'payroll') {
      if (subTab) setPayrollSubTab(subTab as any);
      setSelectedPayrunId(null);
      setSelectedPayslipId(null);
    } else if (tab === 'attendance') {
      if (subTab) setAttendanceSubTab(subTab as any);
    }
    setIsMobileSidebarOpen(false);
  };

  const handleNavigateToEmployee = (employeeId: number) => {
    setSelectedEmployeeId(employeeId);
    setActiveTab('master-data');
    setMasterSubTab('employees');
  };

  const handleNavigateToPayslip = (payslipId: number) => {
    setSelectedPayslipId(payslipId);
    setActiveTab('payroll');
  };

  const handleNavigateToPayrun = (payrunId: number) => {
    setSelectedPayrunId(payrunId);
    setActiveTab('payroll');
    setPayrollSubTab('payruns');
  };

  const handleViewPrintablePayslip = (payslipId: number = 1) => {
    setSelectedPayslipId(payslipId);
    setActiveTab('payroll');
  };

  const currentSubTab =
    activeTab === 'master-data'
      ? masterSubTab
      : activeTab === 'payroll'
      ? payrollSubTab
      : activeTab === 'attendance'
      ? attendanceSubTab
      : undefined;

  return (
    <div className="min-h-screen bg-slate-50/50 flex font-sans text-slate-900">
      {/* 1. VERTICAL SIDEBAR MENU (DESKTOP) */}
      <div className="hidden md:flex flex-shrink-0 sticky top-0 h-screen no-print">
        <Sidebar
          activeTab={activeTab}
          activeSubTab={currentSubTab}
          onNavigate={handleNavigate}
          onOpenProfile={() => setIsProfileOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* MOBILE SIDEBAR DRAWER OVERLAY */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-50 h-full shadow-2xl">
            <Sidebar
              activeTab={activeTab}
              activeSubTab={currentSubTab}
              onNavigate={handleNavigate}
              onOpenProfile={() => {
                setIsMobileSidebarOpen(false);
                setIsProfileOpen(true);
              }}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 2. MAIN COLUMN (TOPBAR WITH BREADCRUMBS + PAGE CONTENT) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with dynamic Breadcrumbs */}
        <TopBar
          activeTab={activeTab}
          activeSubTab={currentSubTab}
          selectedEmployeeId={selectedEmployeeId}
          selectedPayrunId={selectedPayrunId}
          selectedPayslipId={selectedPayslipId}
          onNavigate={handleNavigate}
          onResetEmployee={() => setSelectedEmployeeId(null)}
          onResetPayrun={() => setSelectedPayrunId(null)}
          onResetPayslip={() => setSelectedPayslipId(null)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden">
          {/* 1. Analytics Dashboard */}
          {activeTab === 'analytics' && (
            <PayrollDashboard
              onNavigateToEmployee={handleNavigateToEmployee}
              onNavigateToPayslip={handleNavigateToPayslip}
              onNavigateToPayrun={handleNavigateToPayrun}
              onViewPrintablePayslip={handleViewPrintablePayslip}
            />
          )}

          {/* 2. Master Data Domain */}
          {activeTab === 'master-data' && (
            <div>
              {masterSubTab === 'employees' && (
                selectedEmployeeId ? (
                  <EmployeeDetail
                    employeeId={selectedEmployeeId}
                    onBack={() => setSelectedEmployeeId(null)}
                  />
                ) : (
                  <EmployeeList onSelectEmployee={setSelectedEmployeeId} />
                )
              )}
              {masterSubTab === 'contracts' && canManageEmployees && <ContractManager />}
              {masterSubTab === 'schedules' && canManageEmployees && <ShiftManager />}
              {masterSubTab === 'leaves' && <LeaveManager />}
            </div>
          )}

          {/* 3. Time, Attendance & Shifts */}
          {activeTab === 'attendance' && (
            <div>
              {attendanceSubTab === 'tracker' && <AttendanceTracker />}
              {attendanceSubTab === 'daily' && <DailyPunches />}
              {attendanceSubTab === 'shifts' && canManageEmployees && <ShiftManager />}
            </div>
          )}

          {/* 4. Payroll Engine Domain */}
          {activeTab === 'payroll' && canRunPayroll && (
            <div>
              {selectedPayslipId ? (
                <PayslipDetail
                  payslipId={selectedPayslipId}
                  onBack={() => setSelectedPayslipId(null)}
                />
              ) : payrollSubTab === 'structures' ? (
                <SalaryStructureManager />
              ) : selectedPayrunId ? (
                <PayrunDetail
                  payrunId={selectedPayrunId}
                  onBack={() => setSelectedPayrunId(null)}
                />
              ) : (
                <PayrunList onSelectPayrun={setSelectedPayrunId} />
              )}
            </div>
          )}

          {/* 5. Admin User Management & RBAC */}
          {activeTab === 'user-management' && (
            <UserManagement />
          )}
        </main>
      </div>

      {/* User Profile & Password Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-slate-900 my-8 animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <span className="font-semibold text-sm text-slate-900">Account &amp; Security</span>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <UserProfile
                user={user}
                onLogout={() => {
                  setIsProfileOpen(false);
                  logout();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppShell;
