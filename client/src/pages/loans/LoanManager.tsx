import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  Eye,
  Check,
  X,
  CreditCard,
  Building2,
  User,
  FileSpreadsheet,
} from 'lucide-react';
import { EmployeeLoan, LoanStatus, LoansListResponse } from './types';
import { fetchLoans, approveLoan, rejectLoan, recordDeduction } from './api';
import { LoanRequestModal } from './LoanRequestModal';
import { EMIScheduleTable } from './EMIScheduleTable';

export const LoanManager: React.FC = () => {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [summary, setSummary] = useState({
    total_active_loans: 0,
    total_disbursed: 0,
    total_recovered: 0,
    pending_approvals: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<EmployeeLoan | null>(null);

  // Quick Action Modal: Record Deduction
  const [deductionLoan, setDeductionLoan] = useState<EmployeeLoan | null>(null);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionNotes, setDeductionNotes] = useState<string>('');
  const [deductionLoading, setDeductionLoading] = useState<boolean>(false);

  // Rejection modal
  const [rejectingLoanId, setRejectingLoanId] = useState<number | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState<string>('');
  const [rejectLoading, setRejectLoading] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: LoansListResponse = await fetchLoans(
        activeTab === 'all' ? undefined : activeTab
      );
      setLoans(res.loans || []);
      setSummary({
        total_active_loans: res.total_active_loans,
        total_disbursed: res.total_disbursed,
        total_recovered: res.total_recovered,
        pending_approvals: res.pending_approvals,
      });
    } catch (err: any) {
      console.error('Error fetching loans:', err);
      setError(err.message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, [activeTab]);

  const handleApprove = async (loanId: number) => {
    try {
      await approveLoan(loanId);
      showToast(`Loan #${loanId} approved and activated successfully!`, 'success');
      loadLoans();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve loan', 'error');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingLoanId) return;
    try {
      setRejectLoading(true);
      await rejectLoan(rejectingLoanId, rejectRemarks);
      showToast(`Loan #${rejectingLoanId} rejected.`, 'info');
      setRejectingLoanId(null);
      setRejectRemarks('');
      loadLoans();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject loan', 'error');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleRecordDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductionLoan || deductionAmount <= 0) return;

    try {
      setDeductionLoading(true);
      const res = await recordDeduction({
        loan_id: deductionLoan.id,
        amount: deductionAmount,
        notes: deductionNotes.trim() || undefined,
      });

      showToast(
        `Payment of ₹${res.amount_paid.toLocaleString('en-IN')} recorded! Remaining balance: ₹${res.balance_after.toLocaleString('en-IN')}`,
        'success'
      );
      setDeductionLoan(null);
      setDeductionAmount(0);
      setDeductionNotes('');
      loadLoans();
    } catch (err: any) {
      showToast(err.message || 'Failed to record deduction', 'error');
    } finally {
      setDeductionLoading(false);
    }
  };

  const openDeductionModal = (loan: EmployeeLoan) => {
    setDeductionLoan(loan);
    setDeductionAmount(Number(loan.monthly_emi) || Number(loan.remaining_balance));
    setDeductionNotes(`Manual EMI deduction for Loan #${loan.id}`);
  };

  // Filtered loans list
  const filteredLoans = loans.filter((loan) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesId = loan.id.toString().includes(term);
    const matchesEmpId = loan.employee_id.toString().includes(term);
    const matchesEmpName = (loan.employee_name || '').toLowerCase().includes(term);
    const matchesType = loan.loan_type.toLowerCase().includes(term);
    return matchesId || matchesEmpId || matchesEmpName || matchesType;
  });

  const getStatusBadge = (status: LoanStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Active
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </span>
        );
      case 'repaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Repaid
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getLoanTypeBadge = (type: string) => {
    switch (type) {
      case 'salary_advance':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Salary Advance
          </span>
        );
      case 'emergency_loan':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
            Emergency Loan
          </span>
        );
      case 'equipment_loan':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">
            Equipment Loan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toastMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
          {toastMessage.type === 'info' && <Clock className="w-5 h-5 mr-2 flex-shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-700" />
            Employee Loans & Advances
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage employee loan requests, automated EMI payroll deductions, and amortization tracking.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadLoans}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Apply for Loan
          </button>
        </div>
      </div>

      {/* KPI Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Loans</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_active_loans}</p>
            <p className="text-xs text-gray-500 mt-1">Currently in repayment</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Disbursed</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₹{summary.total_disbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Across approved loans</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Recovered</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₹{summary.total_recovered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Via payroll deductions</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending Approvals</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.pending_approvals}</p>
            <p className="text-xs text-gray-500 mt-1">Requires HR authorization</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Controls & Tab Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg self-start md:self-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'pending_approval', label: 'Pending Approval' },
              { id: 'repaid', label: 'Repaid' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, or type..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loans Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
              <tr>
                <th className="py-3 px-4 text-left">Loan ID</th>
                <th className="py-3 px-4 text-left">Employee</th>
                <th className="py-3 px-4 text-left">Type</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Interest</th>
                <th className="py-3 px-4 text-right">Monthly EMI</th>
                <th className="py-3 px-4 text-left">Repayment Progress</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading && loans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading loans and salary advances...</p>
                  </td>
                </tr>
              ) : filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    No loan records found for this filter.
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const principal = Number(loan.principal_amount);
                  const remaining = Number(loan.remaining_balance);
                  const recovered = Math.max(0, principal - remaining);
                  const progress = principal > 0 ? Math.min(100, Math.round((recovered / principal) * 100)) : 0;

                  return (
                    <tr key={loan.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Loan ID */}
                      <td className="py-3 px-4 font-mono font-medium text-gray-900">
                        #{loan.id}
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {loan.employee_name || `Employee #${loan.employee_id}`}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          ID: {loan.employee_id}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        {getLoanTypeBadge(loan.loan_type)}
                      </td>

                      {/* Principal */}
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        ₹{principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Interest */}
                      <td className="py-3 px-4 text-right text-gray-600">
                        {loan.interest_rate}% ({loan.tenure_months}m)
                      </td>

                      {/* Monthly EMI */}
                      <td className="py-3 px-4 text-right font-semibold text-indigo-700">
                        ₹{Number(loan.monthly_emi).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Repayment Progress */}
                      <td className="py-3 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{progress}%</span>
                            <span>Bal: ₹{remaining.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress >= 100
                                  ? 'bg-emerald-500'
                                  : progress > 50
                                  ? 'bg-blue-600'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(loan.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Schedule Button */}
                          <button
                            onClick={() => setSelectedLoanForSchedule(loan)}
                            className="p-1.5 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            title="View EMI Schedule"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>

                          {/* Action for Pending: Approve & Reject */}
                          {loan.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprove(loan.id)}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm transition-colors flex items-center space-x-1"
                                title="Approve & Activate Loan"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingLoanId(loan.id);
                                  setRejectRemarks('');
                                }}
                                className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors"
                                title="Reject Loan"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {/* Action for Active: Record Deduction */}
                          {loan.status === 'active' && (
                            <button
                              onClick={() => openDeductionModal(loan)}
                              className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition-colors flex items-center space-x-1"
                              title="Record Monthly Deduction"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Deduct</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan Request Modal */}
      <LoanRequestModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          showToast('Loan application submitted successfully!', 'success');
          loadLoans();
        }}
      />

      {/* EMI Schedule Modal */}
      {selectedLoanForSchedule && (
        <EMIScheduleTable
          loan={selectedLoanForSchedule}
          isOpen={!!selectedLoanForSchedule}
          onClose={() => setSelectedLoanForSchedule(null)}
        />
      )}

      {/* Quick Action: Record Deduction Modal */}
      {deductionLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-indigo-700 text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Record EMI Deduction — Loan #{deductionLoan.id}
              </h3>
              <button
                onClick={() => setDeductionLoan(null)}
                className="text-white hover:bg-white/10 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordDeduction} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-semibold text-gray-800">
                  {deductionLoan.employee_name || `Employee #${deductionLoan.employee_id}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Monthly EMI</span>
                  <span className="font-bold text-gray-800">
                    ₹{Number(deductionLoan.monthly_emi).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Remaining Balance</span>
                  <span className="font-bold text-gray-800">
                    ₹{Number(deductionLoan.remaining_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Deduction Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={Number(deductionLoan.remaining_balance)}
                  required
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={deductionNotes}
                  onChange={(e) => setDeductionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDeductionLoan(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deductionLoading || deductionAmount <= 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg shadow-sm transition-colors"
                >
                  {deductionLoading ? 'Processing...' : 'Confirm Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingLoanId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Reject Loan #{rejectingLoanId}
              </h3>
              <button
                onClick={() => setRejectingLoanId(null)}
                className="text-white hover:bg-white/10 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reject this loan application? You can provide optional remarks below.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Rejection Remarks
                </label>
                <textarea
                  rows={3}
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Reason for rejection (e.g. probationary period, insufficient tenure)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectingLoanId(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rejectLoading}
                  onClick={handleConfirmReject}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg shadow-sm transition-colors"
                >
                  {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
