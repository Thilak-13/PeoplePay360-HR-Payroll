import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  AlertCircle,
  Check,
  DollarSign,
  Calendar,
  Percent,
  FileText,
  User,
} from 'lucide-react';
import { LoanType, LoanApplyRequest, CalculateEMIResponse } from './types';
import { applyLoan, calculateEMI } from './api';

interface LoanRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoanRequestModal: React.FC<LoanRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [loanType, setLoanType] = useState<LoanType>('salary_advance');
  const [principalAmount, setPrincipalAmount] = useState<number>(20000);
  const [tenureMonths, setTenureMonths] = useState<number>(6);
  const [interestRate, setInterestRate] = useState<number>(0.0);
  const [reason, setReason] = useState<string>('');

  const [emiCalculation, setEmiCalculation] = useState<CalculateEMIResponse | null>(null);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Set default interest rate based on loan type
  const handleLoanTypeChange = (type: LoanType) => {
    setLoanType(type);
    if (type === 'salary_advance') {
      setInterestRate(0.0);
      if (tenureMonths > 12) setTenureMonths(6);
    } else if (type === 'equipment_loan') {
      setInterestRate(5.0);
    } else if (type === 'emergency_loan') {
      setInterestRate(8.0);
    }
  };

  // Live EMI calculation whenever principal, tenure, or interest changes
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      if (principalAmount <= 0 || tenureMonths <= 0) return;
      try {
        setCalculating(true);
        const result = await calculateEMI(principalAmount, tenureMonths, interestRate);
        setEmiCalculation(result);
      } catch (err: any) {
        console.error('Failed to compute live EMI:', err);
      } finally {
        setCalculating(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [principalAmount, tenureMonths, interestRate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || employeeId <= 0) {
      setError('Please provide a valid Employee ID');
      return;
    }
    if (principalAmount <= 0) {
      setError('Principal amount must be greater than 0');
      return;
    }
    if (tenureMonths <= 0) {
      setError('Tenure must be at least 1 month');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: LoanApplyRequest = {
        employee_id: employeeId,
        loan_type: loanType,
        principal_amount: principalAmount,
        tenure_months: tenureMonths,
        interest_rate: interestRate,
        reason: reason.trim() || undefined,
      };

      await applyLoan(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to apply for loan:', err);
      setError(err.message || 'Failed to submit loan application');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Calculator className="w-6 h-6 text-white" />
            <h3 className="text-lg font-bold">New Loan / Salary Advance Request</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white hover:text-gray-200 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 text-sm rounded-lg flex items-center space-x-2 border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Employee ID */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Employee ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="1"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(parseInt(e.target.value) || 1)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 1"
              />
            </div>
          </div>

          {/* Loan Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Loan Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'salary_advance', label: 'Salary Advance', desc: '0% Interest short-term' },
                { id: 'emergency_loan', label: 'Emergency Loan', desc: 'Financial contingency' },
                { id: 'equipment_loan', label: 'Equipment Loan', desc: 'Work equipment asset' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleLoanTypeChange(item.id as LoanType)}
                  className={`p-3 text-left border rounded-lg transition-all ${
                    loanType === item.id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500 ring-opacity-30'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Principal Amount */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Principal Amount (₹) <span className="text-red-500">*</span>
              </label>
              <span className="text-sm font-bold text-blue-700 font-mono">
                ₹{principalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="1000"
                max="1000000"
                step="500"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <input
              type="range"
              min="2000"
              max="200000"
              step="1000"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(parseFloat(e.target.value))}
              className="w-full mt-2 accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Tenure and Interest Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Tenure (Months) <span className="text-red-500">*</span>
                </label>
                <span className="text-sm font-bold text-blue-700">
                  {tenureMonths} mo
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(parseInt(e.target.value))}
                className="w-full mt-2 accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Annual Interest Rate (%)
                </label>
                <span className="text-sm font-bold text-emerald-700">
                  {interestRate}%
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Percent className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full mt-2 accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Reason / Remarks */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Purpose / Reason
            </label>
            <div className="relative">
              <div className="absolute top-2.5 left-3 pointer-events-none text-gray-400">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for loan application (optional)"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Live Preview Calculation Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-900 mb-2 flex items-center justify-between">
              <span>Real-Time EMI Projection</span>
              {calculating && <span className="text-xs text-blue-600 animate-pulse">Calculating...</span>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                <div className="text-xs text-gray-500 mb-0.5">Monthly Deduction</div>
                <div className="text-lg font-extrabold text-blue-700 font-mono">
                  ₹{emiCalculation ? emiCalculation.monthly_emi.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                <div className="text-xs text-gray-500 mb-0.5">Total Interest</div>
                <div className="text-lg font-extrabold text-emerald-700 font-mono">
                  ₹{emiCalculation ? emiCalculation.total_interest.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                <div className="text-xs text-gray-500 mb-0.5">Total Repayable</div>
                <div className="text-lg font-extrabold text-gray-900 font-mono">
                  ₹{emiCalculation ? emiCalculation.total_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end space-x-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
