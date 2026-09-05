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

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('analytics');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);
  const [selectedPayrunId, setSelectedPayrunId] = useState<number | null>(null);
  const [masterSubTab, setMasterSubTab] = useState<'employees' | 'contracts' | 'leaves'>('employees');
  const [payrollSubTab, setPayrollSubTab] = useState<'payruns' | 'structures'>('payruns');

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
        <TopNavBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Sub-Navigation Bar for Module-Specific Views */}
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

          {/* 3. Payroll Engine Domain */}
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

          {/* 4. Printable Payslip View */}
          {activeTab === 'printable-payslip' && (
            <PrintablePayslip
              payslipId={selectedPayslipId || 1}
              onBack={() => setActiveTab('analytics')}
            />
          )}
        </main>
      </div>
    </RoleProvider>
  );
};
