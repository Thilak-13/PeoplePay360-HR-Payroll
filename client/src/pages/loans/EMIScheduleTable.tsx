import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Percent,
  X,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { EMIScheduleItem, EmployeeLoan } from './types';
import { fetchLoanSchedule } from './api';

interface EMIScheduleTableProps {
  loan: EmployeeLoan;
  isOpen: boolean;
  onClose: () => void;
}

export const EMIScheduleTable: React.FC<EMIScheduleTableProps> = ({
  loan,
  isOpen,
  onClose,
}) => {
  const [schedule, setSchedule] = useState<EMIScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !loan.id) return;

    const loadSchedule = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLoanSchedule(loan.id);
        setSchedule(data.schedule || []);
      } catch (err: any) {
        console.error('Failed to fetch schedule:', err);
        setError(err.message || 'Failed to load installment schedule');
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [isOpen, loan.id]);

  if (!isOpen) return null;

  // Calculate repayment metrics
  const totalPrincipal = Number(loan.principal_amount);
  const remaining = Number(loan.remaining_balance);
  const recoveredAmount = Math.max(0, totalPrincipal - remaining);
  const progressPercent =
    totalPrincipal > 0
      ? Math.min(100, Math.round((recoveredAmount / totalPrincipal) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-10 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                EMI Repayment Schedule — Loan #{loan.id}
              </h3>
              <p className="text-xs text-blue-100">
                {loan.employee_name || `Employee #${loan.employee_id}`} •{' '}
                {loan.loan_type.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white hover:text-gray-200 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loan Summary Info Cards */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <DollarSign className="w-3.5 h-3.5 mr-1 text-blue-600" />
                <span>Principal</span>
              </div>
              <div className="text-base font-semibold text-gray-800">
                ₹{Number(loan.principal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Percent className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Interest Rate</span>
              </div>
              <div className="text-base font-semibold text-gray-800">
                {loan.interest_rate}% p.a.
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                <span>Monthly EMI</span>
              </div>
              <div className="text-base font-semibold text-indigo-700">
                ₹{Number(loan.monthly_emi).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                <span>Remaining Balance</span>
              </div>
              <div className="text-base font-semibold text-gray-800">
                ₹{Number(loan.remaining_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center text-xs text-gray-600 mb-1.5 font-medium">
              <span>Repayment Progress</span>
              <span>
                {progressPercent}% Complete (₹
                {recoveredAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} of ₹
                {totalPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  progressPercent >= 100
                    ? 'bg-emerald-500'
                    : progressPercent > 50
                    ? 'bg-blue-600'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500">Generating amortization schedule...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : schedule.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No installment schedule entries found.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">#</th>
                    <th className="py-3 px-4 text-left">Due Date</th>
                    <th className="py-3 px-4 text-right">Principal</th>
                    <th className="py-3 px-4 text-right">Interest</th>
                    <th className="py-3 px-4 text-right">EMI Amount</th>
                    <th className="py-3 px-4 text-right">Remaining Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {schedule.map((row) => (
                    <tr
                      key={row.installment_number}
                      className={
                        row.is_paid
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className="py-2.5 px-4 font-medium text-gray-800">
                        {row.installment_number}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">
                        {row.due_date}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600">
                        ₹{Number(row.principal_component || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600">
                        ₹{Number(row.interest_component || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-gray-900">
                        ₹{Number(row.emi_amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600 font-mono">
                        ₹{Number(row.balance_after).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {row.is_paid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            <Clock className="w-3 h-3 mr-1 text-gray-400" />
                            Scheduled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
