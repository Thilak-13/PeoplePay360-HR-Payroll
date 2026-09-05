import React, { useState } from 'react';
import { useAuth } from '../../pages/auth/AuthContext';
import { useRole } from './RoleContext';
import { TopNavBar } from './TopNavBar';
import { LoginScreen, UserProfile } from '../../pages/auth';
import { PayrollDashboard, PrintablePayslip } from '../../pages/dashboard';
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
import {
  LoanManager,
  EMIScheduleTable,
} from '../../pages/loans';
import {
  ExpenseList,
} from '../../pages/expenses';
import {
  TaxDeclarationPortal,
  ProofVerification,
} from '../../pages/tax';
import {
  NotificationCenter,
} from '../../pages/notifications';
import { X } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { canManageEmployees, canRunPayroll, isSelfServiceOnly } = useRole();

  const [activeTab, setActiveTab] = useState<string>('analytics');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);
  const [selectedPayrunId, setSelectedPayrunId] = useState<number | null>(null);

  // Sub-tabs for domain navigation
  const [masterSubTab, setMasterSubTab] = useState<'employees' | 'contracts' | 'leaves'>('employees');
  const [payrollSubTab, setPayrollSubTab] = useState<'payruns' | 'structures'>('payruns');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'tracker' | 'daily' | 'shifts'>('tracker');
  const [loansSubTab, setLoansSubTab] = useState<'manager' | 'schedule'>('manager');
  const [taxSubTab, setTaxSubTab] = useState<'portal' | 'verification'>('portal');

  // Profile modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // 1. Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading PeoplePay360 Session...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

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
    setActiveTab('printable-payslip');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Global Navigation Header with Role Switcher & User Profile */}
      <TopNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Sub-Navigation Bar: Master Data */}
      {activeTab === 'master-data' && canManageEmployees && (
        <div className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between no-print">
          <div className="flex space-x-1.5">
            <button
              onClick={() => {
                setMasterSubTab('employees');
                setSelectedEmployeeId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                masterSubTab === 'employees'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Employees Directory
            </button>
            <button
              onClick={() => {
                setMasterSubTab('contracts');
                setSelectedEmployeeId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                masterSubTab === 'contracts'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Contracts
            </button>
            <button
              onClick={() => {
                setMasterSubTab('leaves');
                setSelectedEmployeeId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                masterSubTab === 'leaves'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Time Off & Leaves
            </button>
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar: Payroll */}
      {activeTab === 'payroll' && !isSelfServiceOnly && (
        <div className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between no-print">
          <div className="flex space-x-1.5">
            <button
              onClick={() => {
                setPayrollSubTab('payruns');
                setSelectedPayrunId(null);
                setSelectedPayslipId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                payrollSubTab === 'payruns' && !selectedPayslipId
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Payrun Batches
            </button>
            <button
              onClick={() => {
                setPayrollSubTab('structures');
                setSelectedPayrunId(null);
                setSelectedPayslipId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                payrollSubTab === 'structures'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Salary Structures & Rules
            </button>
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar: Attendance */}
      {activeTab === 'attendance' && !isSelfServiceOnly && (
        <div className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between no-print">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setAttendanceSubTab('tracker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                attendanceSubTab === 'tracker'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Clock-In & Status
            </button>
            <button
              onClick={() => setAttendanceSubTab('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                attendanceSubTab === 'daily'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Daily Punches
            </button>
            <button
              onClick={() => setAttendanceSubTab('shifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                attendanceSubTab === 'shifts'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Shift Rosters
            </button>
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar: Loans */}
      {activeTab === 'loans' && !isSelfServiceOnly && (
        <div className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between no-print">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setLoansSubTab('manager')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                loansSubTab === 'manager'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Loan Applications
            </button>
            <button
              onClick={() => setLoansSubTab('schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                loansSubTab === 'schedule'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              EMI Schedules
            </button>
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar: Tax */}
      {activeTab === 'tax' && !isSelfServiceOnly && (
        <div className="bg-white border-b border-slate-200/80 px-6 py-2 flex items-center justify-between no-print">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setTaxSubTab('portal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                taxSubTab === 'portal'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Tax Calculator & Declarations
            </button>
            <button
              onClick={() => setTaxSubTab('verification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                taxSubTab === 'verification'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Proof Verification
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
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
            {masterSubTab === 'contracts' && <ContractManager />}
            {masterSubTab === 'leaves' && <LeaveManager />}
          </div>
        )}

        {/* 3. Time, Attendance & Shifts */}
        {activeTab === 'attendance' && (
          <div>
            {attendanceSubTab === 'tracker' && <AttendanceTracker />}
            {attendanceSubTab === 'daily' && <DailyPunches />}
            {attendanceSubTab === 'shifts' && <ShiftManager />}
          </div>
        )}

        {/* 4. Payroll Engine Domain */}
        {activeTab === 'payroll' && (
          <div>
            {selectedPayslipId ? (
              <PayslipDetail
                payslipId={selectedPayslipId}
                onBack={() => setSelectedPayslipId(null)}
              />
            ) : payrollSubTab === 'structures' && canRunPayroll ? (
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

        {/* 5. Loans & Advances EMI */}
        {activeTab === 'loans' && (
          <div>
            {loansSubTab === 'manager' && <LoanManager />}
            {loansSubTab === 'schedule' && (
              <div className="p-6 max-w-7xl mx-auto">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Sample Active Loan Schedule</h2>
                <EMIScheduleTable loanId={1} />
              </div>
            )}
          </div>
        )}

        {/* 6. Expenses & Reimbursements */}
        {activeTab === 'expenses' && (
          <div>
            <ExpenseList />
          </div>
        )}

        {/* 7. Statutory Tax & Proof Declarations */}
        {activeTab === 'tax' && (
          <div>
            {taxSubTab === 'portal' && <TaxDeclarationPortal />}
            {taxSubTab === 'verification' && <ProofVerification />}
          </div>
        )}

        {/* 8. Notification & PDF Dispatch Center */}
        {activeTab === 'notifications' && (
          <div>
            <NotificationCenter />
          </div>
        )}

        {/* 9. Printable Payslip View */}
        {activeTab === 'printable-payslip' && (
          <PrintablePayslip
            payslipId={selectedPayslipId || 1}
            onBack={() => setActiveTab('analytics')}
          />
        )}
      </main>

      {/* User Profile & Password Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-slate-900 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <span className="font-semibold text-sm text-slate-900">Account & Security</span>
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

