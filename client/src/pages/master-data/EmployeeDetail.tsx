import React, { useState, useEffect } from 'react';
import { EmployeeDetail as EmployeeDetailType } from './types';
import { ContractManager } from './ContractManager';
import { LeaveManager } from './LeaveManager';
import { StatusBadge } from '../../components/shared/StatusBadge';

interface EmployeeDetailProps {
  employeeId: number;
  onBack?: () => void;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState<EmployeeDetailType | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'contracts' | 'timeoff' | 'allocations'>('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeDetail();
  }, [employeeId]);

  const fetchEmployeeDetail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('peoplepay360_token') || sessionStorage.getItem('peoplepay360_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/master-data/employees/${employeeId}/detail`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEmployee(data);
      }
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
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer"
              title="Back to directory"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {employee.first_name} {employee.last_name}
              </h1>
              <StatusBadge status={employee.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {employee.job_title || 'Team Member'} &bull; {employee.department?.name || 'General Department'}
            </p>
          </div>
        </div>

        {/* TOP SMART-STAT BUTTONS */}
        <div className="flex items-center gap-2">
          {/* Contracts Smart-Stat Button */}
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer shadow-2xs ${
              activeTab === 'contracts'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase leading-tight font-semibold">Contracts</span>
              <span className="font-semibold">{employee.contracts_count} Active</span>
            </div>
          </button>

          {/* Time Off Smart-Stat Button */}
          <button
            onClick={() => setActiveTab('timeoff')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer shadow-2xs ${
              activeTab === 'timeoff'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase leading-tight font-semibold">Time Off</span>
              <span className="font-semibold">{employee.time_off_count} Requests</span>
            </div>
          </button>

          {/* Allocations Smart-Stat Button */}
          <button
            onClick={() => setActiveTab('allocations')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer shadow-2xs ${
              activeTab === 'allocations'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block uppercase leading-tight font-semibold">Allocations</span>
              <span className="font-semibold">{employee.allocations_count} Quotas</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mt-5 border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          General Overview
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'contracts'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contracts &amp; Salary ({employee.contracts_count})
        </button>
        <button
          onClick={() => setActiveTab('timeoff')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'timeoff'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave Requests ({employee.time_off_count})
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'allocations'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave Balances ({employee.allocations_count})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-5">
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Employee Overview &amp; Placement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Work Email</span>
                <p className="text-sm font-semibold font-mono text-slate-900 mt-1">{employee.email}</p>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{employee.phone || 'Not recorded'}</p>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Department</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{employee.department?.name || 'Unassigned'}</p>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Working Schedule</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {employee.working_schedule
                    ? `${employee.working_schedule.name} (${employee.working_schedule.hours_per_week}h/week)`
                    : 'Standard 40h/week'}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hire Date</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{employee.hire_date || 'Not recorded'}</p>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Employee ID</span>
                <p className="text-sm font-semibold font-mono text-slate-900 mt-1">#{employee.id}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <ContractManager employeeId={employee.id} onUpdated={fetchEmployeeDetail} />
        )}

        {(activeTab === 'timeoff' || activeTab === 'allocations') && (
          <LeaveManager
            employeeId={employee.id}
            initialTab={activeTab === 'allocations' ? 'allocations' : 'requests'}
            onUpdated={fetchEmployeeDetail}
          />
        )}
      </div>
    </div>
  );
};
