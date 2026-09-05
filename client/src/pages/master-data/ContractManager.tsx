import React, { useState, useEffect } from 'react';
import { Contract } from './types';

interface ContractManagerProps {
  employeeId?: number;
  onUpdated?: () => void;
}

export const ContractManager: React.FC<ContractManagerProps> = ({
  employeeId,
  onUpdated,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employee_id: employeeId || 0,
    wage: '',
    contract_type: 'full_time',
    start_date: '',
    end_date: '',
    status: 'draft',
  });

  useEffect(() => {
    fetchContracts();
  }, [employeeId]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const url = employeeId
        ? `/api/v1/master-data/contracts?employee_id=${employeeId}`
        : '/api/v1/master-data/contracts';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      }
    } catch (err) {
      console.error('Failed to fetch contracts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side date check
    if (formData.end_date && formData.start_date > formData.end_date) {
      setErrorMsg('Start date must be less than or equal to end date.');
      return;
    }

    try {
      const payload = {
        employee_id: employeeId || formData.employee_id,
        wage: parseFloat(formData.wage),
        contract_type: formData.contract_type,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: formData.status,
      };

      const res = await fetch('/api/v1/master-data/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({
          employee_id: employeeId || 0,
          wage: '',
          contract_type: 'full_time',
          start_date: '',
          end_date: '',
          status: 'draft',
        });
        fetchContracts();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || 'Failed to create contract.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
    }
  };

  const handleStatusChange = async (contractId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/master-data/contracts/${contractId}/status?new_status=${newStatus}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchContracts();
        if (onUpdated) onUpdated();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to update contract status');
      }
    } catch (err) {
      console.error('Error changing status', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Running / Active</span>;
      case 'draft':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Draft</span>;
      case 'expired':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Expired</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Contract Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View salary terms, contract dates, and manage contract lifecycles.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Contract
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 font-medium">Loading contracts...</div>
      ) : contracts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500 text-sm">No contracts found for this employee.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-xs text-indigo-600 font-bold hover:underline"
          >
            + Create First Contract
          </button>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Contract ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Wage / Salary</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">End Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {contracts.map((c) => {
                const isActive = c.status === 'active' || c.status === 'running';
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      isActive
                        ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500 font-medium'
                        : 'hover:bg-slate-50/60 border-l-4 border-l-transparent'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      #{c.id} {isActive && <span className="text-[10px] text-emerald-600 font-bold ml-1">(Current)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{c.contract_type.replace('_', ' ')}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">${Number(c.wage).toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-600">{c.start_date}</td>
                    <td className="py-3 px-4 text-slate-600">{c.end_date || 'Open Ended'}</td>
                    <td className="py-3 px-4">{getStatusBadge(c.status)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {c.status === 'draft' && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'active')}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
                        >
                          Activate
                        </button>
                      )}
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'expired')}
                          className="px-2.5 py-1 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded text-xs font-semibold"
                        >
                          Expire
                        </button>
                      )}
                      {c.status !== 'cancelled' && (
                        <button
                          onClick={() => handleStatusChange(c.id, 'cancelled')}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create Employment Contract</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateContract} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contract Type</label>
                <select
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="full_time">Full-Time Permanent</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contractor">Contractor / Freelance</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Basic Wage ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000.00"
                  value={formData.wage}
                  onChange={(e) => setFormData({ ...formData, wage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active / Running</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"
                >
                  Confirm & Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
