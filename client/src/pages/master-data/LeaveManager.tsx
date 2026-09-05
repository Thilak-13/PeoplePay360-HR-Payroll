import React, { useState, useEffect } from 'react';
import { LeaveAllocation, LeaveRequest } from './types';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../../components/shared/RoleContext';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Approved</span>;
      case 'confirm':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending Review</span>;
      case 'draft':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Draft</span>;
      case 'refused':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Refused</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Balances Summary Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.holiday_type} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {b.holiday_type.replace(/_/g, ' ')}
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{b.remaining_days}</span>
                <span className="text-xs text-slate-400 font-medium">Days Remaining</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                <span>Allocated: <strong>{b.allocated_days}d</strong></span>
                <span>Used: <strong>{b.used_days}d</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Leave View Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSubTab('requests')}
              className={`text-sm font-bold pb-1 transition-all ${
                activeSubTab === 'requests'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Leave Requests ({requests.length})
            </button>
            {canManageHR && (
              <button
                onClick={() => setActiveSubTab('allocations')}
                className={`text-sm font-bold pb-1 transition-all ${
                  activeSubTab === 'allocations'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Allocations ({allocations.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeSubTab === 'requests' ? (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowRequestModal(true);
                }}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Allocate Days
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-medium">Loading records...</div>
        ) : activeSubTab === 'requests' ? (
          requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No leave requests found.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Holiday Type</th>
                    <th className="py-3 px-4">Period (From &rarr; To)</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">
                      {canApproveTimeOff ? 'Approval Actions' : 'Status Info'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900 capitalize">
                        {r.holiday_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.date_from} &rarr; {r.date_to}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.number_of_days}d</td>
                      <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {canApproveTimeOff ? (
                          <>
                            {r.status !== 'approved' && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
                              >
                                Approve
                              </button>
                            )}
                            {r.status !== 'refused' && (
                              <button
                                onClick={() => handleRefuse(r.id)}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold"
                              >
                                Refuse
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            {r.status === 'approved'
                              ? 'Approved by HR'
                              : r.status === 'refused'
                              ? 'Refused by HR'
                              : 'Pending HR Approval'}
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
          <div className="py-12 text-center text-slate-500 text-sm">No leave allocations found.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Holiday Type</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Allocated Days</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-semibold text-slate-900 capitalize">
                      {a.holiday_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{a.year}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{a.number_of_days} days</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {a.status}
                      </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Request Time Off</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday / Leave Type</label>
                <select
                  value={requestForm.holiday_type}
                  onChange={(e) => setRequestForm({ ...requestForm, holiday_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="paid_time_off">Paid Time Off (PTO)</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="parental">Parental Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date From *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.date_from}
                    onChange={(e) => setRequestForm({ ...requestForm, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date To *</label>
                  <input
                    type="date"
                    required
                    value={requestForm.date_to}
                    onChange={(e) => setRequestForm({ ...requestForm, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Allocate Leave Days</h3>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAllocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday Type</label>
                <select
                  value={allocForm.holiday_type}
                  onChange={(e) => setAllocForm({ ...allocForm, holiday_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="paid_time_off">Paid Time Off (PTO)</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="parental">Parental Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Days *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={allocForm.number_of_days}
                    onChange={(e) => setAllocForm({ ...allocForm, number_of_days: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Allocation Year *</label>
                  <input
                    type="number"
                    required
                    value={allocForm.year}
                    onChange={(e) => setAllocForm({ ...allocForm, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm"
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
