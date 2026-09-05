import React, { useState, useEffect } from 'react';
import { Payslip, PayslipLine } from './types';

interface PayslipDetailProps {
  payslipId: number;
  onBack: () => void;
}

export const PayslipDetail: React.FC<PayslipDetailProps> = ({
  payslipId,
  onBack,
}) => {
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [recomputing, setRecomputing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPayslip = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/payroll/payslips/${payslipId}`);
      if (!res.ok) throw new Error(`Failed to load payslip #${payslipId}`);
      const data: Payslip = await res.json();
      setPayslip(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching payslip');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslip();
  }, [payslipId]);

  const handleRecompute = async () => {
    setRecomputing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/payroll/payslips/${payslipId}/compute`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Recompute failed');
      }
      const data: Payslip = await res.json();
      setPayslip(data);
      setSuccessMsg('Payslip successfully recomputed from active contract and rules!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recomputing payslip');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading Payslip Breakdown...</p>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-rose-600 font-semibold mb-3">Payslip #{payslipId} Not Found</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          ← Back
        </button>
      </div>
    );
  }

  const isPaid = payslip.status === 'paid';

  const categoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'BASIC':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ALLOWANCE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'GROSS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold';
      case 'DEDUCTION':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'NET':
        return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-indigo-600 font-medium">
              ← Back to Payrun Batch
            </button>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Payslip #{payslip.id}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {payslip.employee_name || `Employee #${payslip.employee_id}`}
          </h1>
          <p className="text-xs text-slate-500">
            Period: <strong>{payslip.date_from}</strong> to <strong>{payslip.date_to}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
          {!isPaid && (
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {recomputing ? 'Recomputing...' : 'Recompute Rules'}
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMsg}</span>
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

      {/* Compliance Warning Banner */}
      {payslip.has_warning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div className="font-bold text-amber-950">Pre-Validation Compliance Warning Flagged</div>
            <div className="mt-0.5 text-amber-800">{payslip.warning_message}</div>
            <div className="mt-1 text-[11px] text-amber-700">
              Note: This warning blocks the payrun batch from moving to 'validated' status until resolved.
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Employee Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Employee Profile
          </div>
          <div className="text-sm font-bold text-slate-900">
            {payslip.employee_name || `Employee #${payslip.employee_id}`}
          </div>
          <div className="text-xs text-slate-500">{payslip.employee_email}</div>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex justify-between">
            <span className="text-slate-400">Department:</span>
            <span className="font-semibold">{payslip.department_name || '—'}</span>
          </div>
          <div className="text-xs text-slate-600 flex justify-between">
            <span className="text-slate-400">Designation:</span>
            <span className="font-semibold">{payslip.job_title || '—'}</span>
          </div>
        </div>

        {/* Banking & Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Disbursement & Banking
          </div>
          <div className="text-xs text-slate-600 flex justify-between">
            <span className="text-slate-400">Bank Account:</span>
            <span className="font-mono font-semibold text-slate-900">
              {payslip.bank_account || <span className="text-rose-500">Unspecified</span>}
            </span>
          </div>
          <div className="text-xs text-slate-600 flex justify-between">
            <span className="text-slate-400">IFSC Code:</span>
            <span className="font-mono font-semibold text-slate-900">
              {payslip.ifsc_code || <span className="text-rose-500">Unspecified</span>}
            </span>
          </div>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-slate-400">Status:</span>
            <span className="capitalize font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full text-[11px]">
              {payslip.status}
            </span>
          </div>
        </div>

        {/* Net Take-Home Card */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Net Take-Home Salary
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-2">
              ₹{Number(payslip.net_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800 text-xs flex justify-between text-slate-300">
            <span>Gross: ₹{Number(payslip.gross_wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span>Ded: ₹{Number(payslip.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Sequenced Salary Rules Breakdown Snapshot */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Itemized Salary Rules Breakdown</h2>
            <p className="text-xs text-slate-500">
              Sequenced calculation pipeline (BASIC → ALLOWANCE → GROSS → DEDUCTION → NET).
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Snapshot Items: <strong>{payslip.lines?.length || 0}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-12">Seq</th>
                <th className="py-2.5 px-4">Rule Name</th>
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Rate % / Value</th>
                <th className="py-2.5 px-4 text-right">Calculated Amount</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!payslip.lines || payslip.lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No snapshot line items recorded for this payslip yet. Click "Recompute Rules" to evaluate.
                  </td>
                </tr>
              ) : (
                payslip.lines.map((l: PayslipLine) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 font-semibold">{l.sequence}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{l.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{l.code}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${categoryColor(
                          l.category
                        )}`}
                      >
                        {l.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 font-mono">
                      {Number(l.rate).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 font-medium">
                      ₹{Number(l.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        l.category === 'DEDUCTION'
                          ? 'text-rose-600'
                          : l.category === 'NET'
                          ? 'text-emerald-700 text-sm'
                          : 'text-slate-900'
                      }`}
                    >
                      {l.category === 'DEDUCTION' ? '-' : ''}₹
                      {Number(l.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
