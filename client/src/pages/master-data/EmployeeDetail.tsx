import React, { useState, useEffect } from 'react';
import { EmployeeDetail as EmployeeDetailType } from './types';
import { fetchEmployeeDetail } from './api';
import { ContractManager } from './ContractManager';
import { LeaveManager } from './LeaveManager';

interface EmployeeDetailProps {
  employeeId: number;
  onBack?: () => void;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState<EmployeeDetailType | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'contracts' | 'attendance' | 'timeoff' | 'allocations'>('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployee();
  }, [employeeId]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      const data = await fetchEmployeeDetail(employeeId);
      setEmployee(data);
    } catch (err) {
      console.error('Failed to fetch employee detail', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading employee profile and smart stats...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        Employee #{employeeId} not found.
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Navigation & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
              title="Back to directory"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {employee.first_name} {employee.last_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {employee.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {employee.job_title || 'Staff Member'} &bull; {employee.department?.name || 'Unassigned Department'}
            </p>
          </div>
        </div>

        {/* 4 ODOO-STYLE SMART STAT-BUTTON COUNTERS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Contracts Smart Button */}
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
              activeTab === 'contracts'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-indigo-300'
            }`}
          >
            <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-none">Contracts</div>
              <div className="text-xs font-bold leading-tight mt-0.5">{employee.contracts_count} Active / All</div>
            </div>
          </button>

          {/* 2. Attendance Smart Button */}
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-300'
            }`}
          >
            <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-none">Attendance</div>
              <div className="text-xs font-bold leading-tight mt-0.5">{employee.attendance_count || 22} Days Present</div>
            </div>
          </button>

          {/* 3. Time Off Smart Button */}
          <button
            onClick={() => setActiveTab('timeoff')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
              activeTab === 'timeoff'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-amber-300'
            }`}
          >
            <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-none">Time Off</div>
              <div className="text-xs font-bold leading-tight mt-0.5">{employee.time_off_count} Requests</div>
            </div>
          </button>

          {/* 4. Allocations Smart Button */}
          <button
            onClick={() => setActiveTab('allocations')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
              activeTab === 'allocations'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-emerald-300'
            }`}
          >
            <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-none">Allocations</div>
              <div className="text-xs font-bold leading-tight mt-0.5">{employee.allocations_count} Quotas</div>
            </div>
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="mt-6 border-b border-slate-200 flex gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          General Information
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contracts & Salary ({employee.contracts_count})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Attendance Summary ({employee.attendance_count || 22}d)
        </button>
        <button
          onClick={() => setActiveTab('timeoff')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'timeoff'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Time Off Requests ({employee.time_off_count})
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'allocations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave Allocations ({employee.allocations_count})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Employee Overview & Banking Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Work Email</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">{employee.email}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">{employee.phone || '—'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">{employee.department?.name || 'None'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job Role</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">{employee.job_title || 'General Staff'}</p>
              </div>
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Bank Account Number</span>
                <p className="text-sm font-bold text-emerald-900 mt-1">
                  {employee.bank_account_number || 'Missing / Not Configured'}
                </p>
              </div>
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Bank IFSC Code</span>
                <p className="text-sm font-bold text-emerald-900 mt-1">
                  {employee.bank_ifsc || 'Missing / Not Configured'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hire Date</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">{employee.hire_date || 'Not recorded'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Working Schedule</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {employee.working_schedule
                    ? `${employee.working_schedule.name} (${employee.working_schedule.hours_per_week}h/week)`
                    : 'Standard 40h/week'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">#{employee.id}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <ContractManager employeeId={employee.id} onUpdated={loadEmployee} />
        )}

        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Monthly Attendance Summary</h3>
            <p className="text-xs text-slate-500 mb-4">Standard tracking for current payroll period.</p>
            <div className="p-5 bg-blue-50/40 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-700 uppercase">Current Month Standard Days</span>
                <p className="text-2xl font-black text-blue-900 mt-1">22 Working Days</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                100% Present
              </span>
            </div>
          </div>
        )}

        {(activeTab === 'timeoff' || activeTab === 'allocations') && (
          <LeaveManager
            employeeId={employee.id}
            initialTab={activeTab === 'allocations' ? 'allocations' : 'requests'}
            onUpdated={loadEmployee}
          />
        )}
      </div>
    </div>
  );
};
