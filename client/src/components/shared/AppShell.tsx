import React, { useState } from 'react';
import { RoleProvider } from './RoleContext';
import { TopNavBar } from './TopNavBar';
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
import {
  LoginModal,
} from '../../pages/auth';

export const AppShell: React.FC = () => {
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

  // Auth modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
    <RoleProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        {/* Global Navigation Header with Role Switcher */}
        <TopNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Sub-Navigation Bar: Master Data */}
        {activeTab === 'master-data' && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between no-print">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setMasterSubTab('employees');
                  setSelectedEmployeeId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  masterSubTab === 'employees'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Employees Directory
              </button>
              <button
                onClick={() => {
                  setMasterSubTab('contracts');
                  setSelectedEmployeeId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  masterSubTab === 'contracts'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Contracts Manager
              </button>
              <button
                onClick={() => {
                  setMasterSubTab('leaves');
                  setSelectedEmployeeId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  masterSubTab === 'leaves'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Time Off & Leaves
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Bar: Payroll */}
        {activeTab === 'payroll' && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between no-print">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setPayrollSubTab('payruns');
                  setSelectedPayrunId(null);
                  setSelectedPayslipId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  payrollSubTab === 'payruns' && !selectedPayslipId
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  payrollSubTab === 'structures'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Salary Structures & Rules
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Bar: Attendance */}
        {activeTab === 'attendance' && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between no-print">
            <div className="flex space-x-2">
              <button
                onClick={() => setAttendanceSubTab('tracker')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  attendanceSubTab === 'tracker'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Clock-In & Biometrics
              </button>
              <button
                onClick={() => setAttendanceSubTab('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  attendanceSubTab === 'daily'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Daily Punches Matrix
              </button>
              <button
                onClick={() => setAttendanceSubTab('shifts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  attendanceSubTab === 'shifts'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Shift Management & Rosters
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Bar: Loans */}
        {activeTab === 'loans' && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between no-print">
            <div className="flex space-x-2">
              <button
                onClick={() => setLoansSubTab('manager')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  loansSubTab === 'manager'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Loan Applications & Advances
              </button>
              <button
                onClick={() => setLoansSubTab('schedule')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  loansSubTab === 'schedule'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                EMI Schedule Breakdown
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Bar: Tax */}
        {activeTab === 'tax' && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between no-print">
            <div className="flex space-x-2">
              <button
                onClick={() => setTaxSubTab('portal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  taxSubTab === 'portal'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tax Calculator & Declaration Portal
              </button>
              <button
                onClick={() => setTaxSubTab('verification')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  taxSubTab === 'verification'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                HR Proof Verification Portal
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

        {/* Global Login & Auth Modal */}
        {isAuthModalOpen && (
          <LoginModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onLoginSuccess={() => setIsAuthModalOpen(false)}
          />
        )}
      </div>
    </RoleProvider>
  );
};
