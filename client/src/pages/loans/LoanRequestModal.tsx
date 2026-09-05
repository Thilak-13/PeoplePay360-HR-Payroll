import React, { useState } from "react";
import { Coins, X, Calculator } from "lucide-react";
import { applyForLoan } from "./api";
import { LoanType } from "./types";

interface LoanRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const LoanRequestModal: React.FC<LoanRequestModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [employeeId, setEmployeeId] = useState(1);
  const [loanType, setLoanType] = useState<LoanType>("personal_loan");
  const [principal, setPrincipal] = useState(50000);
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenure, setTenure] = useState(12);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const calculateEstimate = () => {
    const P = principal;
    const r = interestRate / 12 / 100;
    const n = tenure;
    if (r === 0) return Math.round(P / n);
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await applyForLoan({
        employee_id: employeeId,
        loan_type: loanType,
        principal_amount: principal,
        interest_rate: interestRate,
        tenure_months: tenure,
        reason,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to apply for loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">New Loan / Advance Application</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
              <input
                type="number"
                min={1}
                value={employeeId}
                onChange={(e) => setEmployeeId(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loan Type</label>
              <select
                value={loanType}
                onChange={(e) => {
                  const val = e.target.value as LoanType;
                  setLoanType(val);
                  if (val === "salary_advance") setInterestRate(0);
                  else if (val === "emergency_loan") setInterestRate(5.0);
                  else setInterestRate(8.5);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="personal_loan">Personal Loan (8.5% p.a.)</option>
                <option value="salary_advance">Salary Advance (0% Interest)</option>
                <option value="emergency_loan">Emergency Loan (5.0% p.a.)</option>
                <option value="equipment_loan">Equipment Loan (4.0% p.a.)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Principal (₹)</label>
              <input
                type="number"
                min={1000}
                step={5000}
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Interest %</label>
              <input
                type="number"
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tenure (Months)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={tenure}
                onChange={(e) => setTenure(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Medical emergency / Home relocation advance"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
            />
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex justify-between items-center text-xs">
            <span className="text-indigo-900 font-medium flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-indigo-600" /> Estimated Monthly EMI:
            </span>
            <span className="text-sm font-bold text-indigo-700 font-mono">₹{calculateEstimate().toLocaleString()}/mo</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm"
            >
              {submitting ? "Submitting..." : "Submit Loan Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
