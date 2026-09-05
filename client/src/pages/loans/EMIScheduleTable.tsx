import React from "react";
import { Calendar, CheckCircle, Clock, X } from "lucide-react";
import { EmployeeLoan } from "./types";

interface EMIScheduleTableProps {
  loan: EmployeeLoan | null;
  loanId?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const EMIScheduleTable: React.FC<EMIScheduleTableProps> = ({ loan, isOpen = true, onClose }) => {
  if (!loan && !isOpen) return null;

  const total = Number(loan?.total_repayable || 120000);
  const remaining = Number(loan?.remaining_balance || 83740);
  const recovered = total - remaining;
  const progressPct = total > 0 ? Math.min(100, Math.round((recovered / total) * 100)) : 0;

  const count = loan?.tenure_months || 12;
  const emi = Number(loan?.monthly_emi || 10467.58);

  const installments = [];
  for (let i = 1; i <= count; i++) {
    const isPaid = i <= (count - Math.round(remaining / emi));
    installments.push({
      number: i,
      amount: emi,
      isPaid,
      paidDate: isPaid ? `2026-${String(i).padStart(2, "0")}-01` : null,
      balanceAfter: Math.max(0, total - i * emi),
    });
  }

  const content = (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-start border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Loan #{loan?.id || 1} - Repayment & EMI Schedule
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {loan?.employee ? `${loan.employee.first_name} ${loan.employee.last_name || ""}` : `Employee #${loan?.employee_id || 1}`} • {(loan?.loan_type || "personal_loan").replace("_", " ").toUpperCase()}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Recovery Progress Bar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">Recovery Progress: <strong className="text-slate-900">{progressPct}%</strong></span>
          <span className="text-slate-600">Outstanding: <strong className="text-indigo-600 font-mono">₹{remaining.toLocaleString()}</strong></span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
            <tr>
              <th className="py-2.5 px-3 rounded-l-lg">Inst. #</th>
              <th className="py-2.5 px-3">EMI Amount</th>
              <th className="py-2.5 px-3">Remaining Balance</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 rounded-r-lg">Payment Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {installments.map((inst) => (
              <tr key={inst.number} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-semibold text-slate-900">Month #{inst.number}</td>
                <td className="py-2.5 px-3 font-mono font-medium text-slate-800">₹{inst.amount.toLocaleString()}</td>
                <td className="py-2.5 px-3 font-mono text-slate-500">₹{inst.balanceAfter.toLocaleString()}</td>
                <td className="py-2.5 px-3">
                  {inst.isPaid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" /> Deducted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Clock className="w-3.5 h-3.5" /> Upcoming
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400">{inst.paidDate || "Scheduled via Payrun"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
        <div className="w-full max-w-2xl">{content}</div>
      </div>
    );
  }

  return content;
};
