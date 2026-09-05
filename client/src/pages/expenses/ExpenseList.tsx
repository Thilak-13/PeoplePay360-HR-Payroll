import React, { useState, useEffect } from "react";
import { Receipt, Plus, CheckCircle, XCircle, RefreshCw, Eye, Sparkles, FileText } from "lucide-react";
import { fetchExpenses, approveExpenseClaim, rejectExpenseClaim, fetchExpenseMetrics, seedSampleExpenses } from "./api";
import { ExpenseClaim, ExpenseMetrics } from "./types";
import { ExpenseClaimModal } from "./ExpenseClaimModal";
import { ReceiptViewer } from "./ReceiptViewer";

export const ExpenseList: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseClaim[]>([]);
  const [metrics, setMetrics] = useState<ExpenseMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClaimForViewer, setSelectedClaimForViewer] = useState<ExpenseClaim | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eData, mData] = await Promise.all([
        fetchExpenses(statusFilter, categoryFilter),
        fetchExpenseMetrics(),
      ]);
      setExpenses(eData);
      setMetrics(mData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveExpenseClaim(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to approve expense");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason !== null) {
      try {
        await rejectExpenseClaim(id, reason);
        loadData();
      } catch (err: any) {
        alert(err.response?.data?.detail || err.message || "Failed to reject expense");
      }
    }
  };

  const handleSeed = async () => {
    try {
      await seedSampleExpenses();
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message || "Failed to seed sample expenses");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Approved</span>;
      case "submitted":
        return <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">Pending Approval</span>;
      case "reimbursed":
        return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Reimbursed</span>;
      case "rejected":
        return <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Expense Claims & Reimbursements
          </h1>
          <p className="text-slate-500 text-sm mt-1">Submit employee operational claims, approve proofs, and automate payroll reimbursements.</p>
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
            <Plus className="w-4 h-4" /> File New Claim
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Claims</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.total_claims_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-amber-600">Pending Review</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.submitted_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-600">Approved Total</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">₹{Number(metrics.total_approved_amount || 0).toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-indigo-600">Reimbursed Total</span>
            <div className="text-2xl font-bold text-indigo-700 mt-1">₹{Number(metrics.total_reimbursed_amount || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {["all", "submitted", "approved", "reimbursed", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st === "submitted" ? "Pending Approval" : st}
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
                <th className="py-3 px-4">Claim # & Employee</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Expense Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No expense claims found matching current filter.
                  </td>
                </tr>
              ) : (
                expenses.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        #{claim.id} - {claim.employee ? `${claim.employee.first_name} ${claim.employee.last_name || ""}` : `Employee #${claim.employee_id}`}
                      </div>
                      <div className="text-xs text-slate-400 max-w-xs truncate">{claim.description}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-800">{claim.category.replace("_", " ")}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{Number(claim.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{claim.expense_date}</td>
                    <td className="py-3 px-4">{getStatusBadge(claim.status)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {claim.receipt_url && (
                        <button
                          onClick={() => setSelectedClaimForViewer(claim)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" /> Receipt
                        </button>
                      )}
                      {claim.status === "submitted" && (
                        <>
                          <button
                            onClick={() => handleApprove(claim.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(claim.id)}
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

      <ExpenseClaimModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadData}
      />

      <ReceiptViewer
        claim={selectedClaimForViewer}
        isOpen={!!selectedClaimForViewer}
        onClose={() => setSelectedClaimForViewer(null)}
      />
    </div>
  );
};
