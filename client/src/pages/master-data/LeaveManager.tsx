import React, { useState, useEffect } from 'react';
import { LeaveAllocation, LeaveRequest } from './types';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../../components/shared/RoleContext';
import { StatusBadge } from '../../components/shared/StatusBadge';

interface LeaveManagerProps {
  employeeId?: number;
  initialTab?: 'requests' | 'allocations';
  onUpdated?: () => void;
}

interface BalanceItem {
  holiday_type: string;
  year: number;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
}

export const LeaveManager: React.FC<LeaveManagerProps> = ({
  employeeId,
  initialTab = 'requests',
  onUpdated,
}) => {
  const { user } = useAuth();
  const { canApproveTimeOff, canManageHR, isSelfServiceOnly } = useRole();
  const effectiveEmployeeId = employeeId || user?.employee_id || 1;
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'allocations'>(initialTab);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [allocations, setAllocations] = useState<LeaveAllocation[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [requestForm, setRequestForm] = useState({
    holiday_type: 'paid_time_off',
    date_from: '',
    date_to: '',
  });

  const [allocForm, setAllocForm] = useState({
    holiday_type: 'paid_time_off',
    number_of_days: '10',
    year: new Date().getFullYear(),
  });

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('peoplepay360_token') || sessionStorage.getItem('peoplepay360_token');
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchAllocations(), fetchBalances()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const url = employeeId
        ? `/api/v1/master-data/leave-requests?employee_id=${employeeId}`
        : '/api/v1/master-data/leave-requests';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllocations = async () => {
    try {
      const url = employeeId
        ? `/api/v1/master-data/leave-allocations?employee_id=${employeeId}`
        : '/api/v1/master-data/leave-allocations';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllocations(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch(`/api/v1/master-data/leave-allocations/balance/${effectiveEmployeeId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (requestForm.date_from > requestForm.date_to) {
      setErrorMsg('Date From cannot be after Date To.');
      return;
    }

    try {
      const res = await fetch('/api/v1/master-data/leave-requests', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          employee_id: effectiveEmployeeId,
          holiday_type: requestForm.holiday_type,
          date_from: requestForm.date_from,
          date_to: requestForm.date_to,
          status: 'draft',
        }),
      });

      if (res.ok) {
        setShowRequestModal(false);
        setRequestForm({
          holiday_type: 'paid_time_off',
          date_from: '',
          date_to: '',
        });
        fetchData();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || 'Failed to submit leave request');
      }
    } catch (err) {
      setErrorMsg('Unexpected network error.');
    }
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/master-data/leave-allocations', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          employee_id: effectiveEmployeeId,
          holiday_type: allocForm.holiday_type,
          number_of_days: parseFloat(allocForm.number_of_days),
          year: allocForm.year,
          status: 'approved',
        }),
      });

      if (res.ok) {
        setShowAllocModal(false);
        fetchData();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || 'Failed to create allocation');
      }
    } catch (err) {
      setErrorMsg('Unexpected error.');
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      const res = await fetch(`/api/v1/master-data/leave-requests/${requestId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchData();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Approval failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefuse = async (requestId: number) => {
    try {
      const res = await fetch(`/api/v1/master-data/leave-requests/${requestId}/refuse`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchData();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Action failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balances Summary Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.holiday_type} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {b.holiday_type.replace(/_/g, ' ')}
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-slate-900">{b.remaining_days}</span>
                  <span className="text-xs text-slate-400 font-normal">days left</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                <span>Allocated: <strong className="font-mono font-medium text-slate-700">{b.allocated_days}d</strong></span>
                <span>Used: <strong className="font-mono font-medium text-slate-700">{b.used_days}d</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Leave View Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200/80 gap-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveSubTab('requests')}
              className={`text-xs font-semibold pb-2 border-b-2 transition-colors ${
                activeSubTab === 'requests'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Time Off Requests ({requests.length})
            </button>
            {canManageHR && (
              <button
                onClick={() => setActiveSubTab('allocations')}
                className={`text-xs font-semibold pb-2 border-b-2 transition-colors ${
                  activeSubTab === 'allocations'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Allocations ({allocations.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeSubTab === 'requests' ? (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowRequestModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs px-3.5 py-1.5 shadow-2xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Request Time Off
              </button>
            ) : canManageHR ? (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowAllocModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium rounded-lg text-xs px-3.5 py-1.5 shadow-2xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Allocate Days
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading records...</div>
        ) : activeSubTab === 'requests' ? (
          requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No time off requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">
                      {canApproveTimeOff ? 'Actions' : 'Status Info'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 capitalize">
                        {r.holiday_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.date_from} &rarr; {r.date_to}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{r.number_of_days}d</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {canApproveTimeOff ? (
                          <>
                            {r.status !== 'approved' && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium transition-colors shadow-2xs"
                              >
                                Approve
                              </button>
                            )}
                            {r.status !== 'refused' && (
                              <button
                                onClick={() => handleRefuse(r.id)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors shadow-2xs"
                              >
                                Refuse
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            {r.status === 'approved'
                              ? 'Approved'
                              : r.status === 'refused'
                              ? 'Refused'
                              : 'Pending Approval'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : allocations.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">No leave allocations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Allocated Days</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 capitalize">
                      {a.holiday_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{a.year}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{a.number_of_days} days</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Leave Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Request Time Off</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type</label>
                <select
                  value={requestForm.holiday_type}
                  onChange={(e) => setRequestForm({ ...requestForm, holiday_type: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                >
                  <option value="paid_time_off">Paid Time Off (PTO)</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="parental">Parental Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date From *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.date_from}
                    onChange={(e) => setRequestForm({ ...requestForm, date_from: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date To *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.date_to}
                    onChange={(e) => setRequestForm({ ...requestForm, date_to: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Days Modal */}
      {showAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Allocate Leave Days</h3>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAllocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type</label>
                <select
                  value={allocForm.holiday_type}
                  onChange={(e) => setAllocForm({ ...allocForm, holiday_type: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                >
                  <option value="paid_time_off">Paid Time Off (PTO)</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="parental">Parental Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Number of Days *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={allocForm.number_of_days}
                    onChange={(e) => setAllocForm({ ...allocForm, number_of_days: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Allocation Year *</label>
                  <input
                    type="number"
                    required
                    value={allocForm.year}
                    onChange={(e) => setAllocForm({ ...allocForm, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
