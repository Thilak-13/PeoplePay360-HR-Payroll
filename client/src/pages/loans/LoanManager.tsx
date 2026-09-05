import React, { useState, useEffect } from "react";
import { Coins, Plus, CheckCircle, XCircle, Calendar, RefreshCw, Sparkles, FileText } from "lucide-react";
import { fetchLoans, approveLoan, rejectLoan, fetchLoanMetrics, seedSampleLoans } from "./api";
import { EmployeeLoan, LoanMetrics } from "./types";
import { LoanRequestModal } from "./LoanRequestModal";
import { EMIScheduleTable } from "./EMIScheduleTable";

export const LoanManager: React.FC = () => {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [metrics, setMetrics] = useState<LoanMetrics | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<EmployeeLoan | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lData, mData] = await Promise.all([
        fetchLoans(filter),
        fetchLoanMetrics(),
      ]);
      setLoans(lData);
      setMetrics(mData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (loanId: number) => {
    try {
      await approveLoan(loanId);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to approve loan");
    }
  };

  const handleReject = async (loanId: number) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason !== null) {
      try {
        await rejectLoan(loanId, reason);
        loadData();
      } catch (err: any) {
        alert(err.response?.data?.detail || err.message || "Failed to reject loan");
      }
    }
  };

  const handleSeed = async () => {
    try {
      await seedSampleLoans();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to seed loans");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Active</span>;
      case "pending_approval":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending</span>;
      case "repaid":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Repaid</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Rejected</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-7 h-7 text-indigo-600" />
            Employee Loans & Salary Advances
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage company loans, automated monthly EMI deductions, and balances.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-500" /> Demo Seed
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Request Loan / Advance
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Active Loans</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.active_loans_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-amber-600">Pending Review</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.pending_loans_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Disbursed</span>
            <div className="text-2xl font-bold text-indigo-700 mt-1">₹{Number(metrics.total_disbursed || 0).toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-600">Outstanding Balance</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">₹{Number(metrics.total_outstanding_balance || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Loan Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {["all", "pending_approval", "active", "repaid", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filter === st ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Loan # & Employee</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Principal</th>
                <th className="py-3 px-4">Monthly EMI</th>
                <th className="py-3 px-4">Remaining Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No loans found matching filter.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        #{loan.id} - {loan.employee ? `${loan.employee.first_name} ${loan.employee.last_name || ""}` : `Employee #${loan.employee_id}`}
                      </div>
                      <div className="text-xs text-slate-400">{loan.employee?.email || ""}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-800">{loan.loan_type.replace("_", " ")}</td>
                    <td className="py-3 px-4 font-mono text-slate-900">₹{Number(loan.principal_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-indigo-600 font-semibold">₹{Number(loan.monthly_emi).toLocaleString()}/mo</td>
                    <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">₹{Number(loan.remaining_balance).toLocaleString()}</td>
                    <td className="py-3 px-4">{getStatusBadge(loan.status)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedLoanForSchedule(loan)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition"
                      >
                        Schedule
                      </button>
                      {loan.status === "pending_approval" && (
                        <>
                          <button
                            onClick={() => handleApprove(loan.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(loan.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LoanRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadData}
      />

      <EMIScheduleTable
        loan={selectedLoanForSchedule}
        isOpen={!!selectedLoanForSchedule}
        onClose={() => setSelectedLoanForSchedule(null)}
      />
    </div>
  );
};
