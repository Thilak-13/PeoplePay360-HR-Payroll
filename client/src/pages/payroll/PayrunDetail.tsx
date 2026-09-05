import React, { useState, useEffect } from 'react';
import { Payrun, Payslip } from './types';

interface PayrunDetailProps {
  payrunId: number;
  onBack: () => void;
  onSelectPayslip: (payslipId: number) => void;
}

export const PayrunDetail: React.FC<PayrunDetailProps> = ({
  payrunId,
  onBack,
  onSelectPayslip,
}) => {
  const [payrun, setPayrun] = useState<Payrun | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchPayrun = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/payroll/payruns/${payrunId}`);
      if (!res.ok) throw new Error(`Failed to load payrun #${payrunId}`);
      const data: Payrun = await res.json();
      setPayrun(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading payrun');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrun();
  }, [payrunId]);

  // Actions
  const handleComputeBatch = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/payroll/payruns/${payrunId}/compute`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Compute batch failed');
      }
      const data: Payrun = await res.json();
      setPayrun(data);
      setSuccessMsg('Successfully computed all salary rules across batch!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Computation error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStateTransition = async (targetStatus: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/payroll/payruns/${payrunId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_status: targetStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Transition to ${targetStatus} failed`);
      }
      await fetchPayrun();
      setSuccessMsg(`Payrun successfully moved to status: ${targetStatus.toUpperCase()}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'State transition error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading Payrun Details...</p>
      </div>
    );
  }

  if (!payrun) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-rose-600 font-semibold mb-3">Payrun #{payrunId} Not Found</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          ← Back to Payrun Batches
        </button>
      </div>
    );
  }

  const isPaid = payrun.status === 'paid';
  const isDraft = payrun.status === 'draft';
  const isComputed = payrun.status === 'computed';
  const isValidated = payrun.status === 'validated';

  const filteredPayslips = (payrun.payslips || []).filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      (p.employee_name && p.employee_name.toLowerCase().includes(q)) ||
      (p.job_title && p.job_title.toLowerCase().includes(q)) ||
      (p.department_name && p.department_name.toLowerCase().includes(q))
    );
  });

  const statuses = ['draft', 'computed', 'validated', 'paid'];
  const currentStepIdx = statuses.indexOf(payrun.status);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-indigo-600 font-medium">
              Payroll Batches
            </button>
            <span>/</span>
            <span className="text-slate-900 font-semibold">#{payrun.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900">{payrun.name}</h1>
            {isPaid && (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                🔒 Terminal Lock (PAID)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Period: <strong>{payrun.date_start}</strong> to <strong>{payrun.date_end}</strong> &bull; Structure:{' '}
            <strong>{payrun.structure_name || 'Standard Salary Structure'}</strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>

          {!isPaid && (
            <>
              <button
                onClick={handleComputeBatch}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {isDraft ? 'Compute Salary Rules' : 'Recompute Batch'}
              </button>

              {isComputed && (
                <button
                  onClick={() => handleStateTransition('validated')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Validate Payrun (Enforce Barrier)
                </button>
              )}

              {isValidated && (
                <button
                  onClick={() => handleStateTransition('paid')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Confirm & Mark Paid (Lock)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-3">
          <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div className="font-bold">Execution / Validation Alert</div>
            <div>{errorMsg}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* State Machine Statusbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Payrun Lifecycle State Machine
        </div>
        <div className="grid grid-cols-4 gap-2">
          {statuses.map((st, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div
                key={st}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-sm ring-1 ring-indigo-500'
                    : isCompleted
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-400 font-medium'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider">Step {idx + 1}</div>
                <div className="text-sm capitalize flex items-center justify-center gap-1.5 mt-0.5">
                  {isCompleted && <span className="text-emerald-600">✓</span>}
                  {st}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Payslips</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{payrun.payslip_count}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Warnings</div>
          <div
            className={`text-xl font-extrabold mt-1 ${
              payrun.warning_count > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {payrun.warning_count}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Basic</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            ₹{Number(payrun.total_basic).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Gross</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            ₹{Number(payrun.total_gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Deductions</div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">
            ₹
            {Number(payrun.total_gross - payrun.total_net).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-sm">
          <div className="text-xs font-medium text-indigo-200">Total Net Payout</div>
          <div className="text-xl font-extrabold mt-1">
            ₹{Number(payrun.total_net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Payslips List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payslips in Batch</h2>
            <p className="text-xs text-slate-500">
              Itemized snapshot lines and compliance warning status for each employee.
            </p>
          </div>
          <div className="w-full md:w-64">
            <input
              type="text"
              placeholder="Search employee or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Basic Wage</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Compliance Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayslips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payslips match criteria.
                  </td>
                </tr>
              ) : (
                filteredPayslips.map((slip) => (
                  <tr
                    key={slip.id}
                    onClick={() => onSelectPayslip(slip.id)}
                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{slip.employee_name || `Employee #${slip.employee_id}`}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{slip.employee_email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{slip.department_name || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">
                      ₹{Number(slip.basic_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      ₹{Number(slip.gross_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-rose-600">
                      ₹{Number(slip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{Number(slip.net_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {slip.has_warning ? (
                        <span
                          title={slip.warning_message || 'Compliance warning'}
                          className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                        >
                          ⚠ Warning
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
                          ✓ Verified
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayslip(slip.id);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                      >
                        View Breakdown &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
