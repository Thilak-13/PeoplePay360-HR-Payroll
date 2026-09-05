import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Search, RefreshCw, FileText, Check, X } from 'lucide-react';
import { fetchAllTaxDeclarations, verifyTaxDeclaration } from './api';
import { TaxDeclaration } from './types';

export const ProofVerification: React.FC = () => {
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [financialYearFilter, setFinancialYearFilter] = useState<string>('2024-2025');
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, financialYearFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllTaxDeclarations(statusFilter, financialYearFilter);
      setDeclarations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number, status: 'verified' | 'rejected') => {
    const remarks = prompt(
      status === 'verified'
        ? 'Verification remarks (optional):'
        : 'Reason for rejection:'
    );
    if (status === 'rejected' && remarks === null) return;

    setActionInProgress(id);
    try {
      await verifyTaxDeclaration(id, {
        status,
        verified_by: 1,
        remarks: remarks || (status === 'verified' ? 'Approved by HR' : 'Rejected due to missing proofs'),
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Tax Proof Verification Portal
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review, verify, and approve employee statutory tax declarations and Chapter VI-A investment proofs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">ID / Emp ID</th>
                <th className="px-6 py-4">Financial Year</th>
                <th className="px-6 py-4">Regime</th>
                <th className="px-6 py-4">Section 80C</th>
                <th className="px-6 py-4">Section 80D</th>
                <th className="px-6 py-4">HRA Rent</th>
                <th className="px-6 py-4">Home Loan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {declarations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No tax declarations found matching current filter.
                  </td>
                </tr>
              ) : (
                declarations.map((decl) => (
                  <tr key={decl.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      #{decl.id} (Emp #{decl.employee_id})
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{decl.financial_year}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${decl.regime === 'new' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                        {decl.regime}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-800">₹{decl.section_80c_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-slate-800">₹{decl.section_80d_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-slate-800">₹{decl.hra_rent_paid.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-slate-800">₹{decl.home_loan_interest.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          decl.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : decl.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {decl.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {decl.status === 'submitted' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerify(decl.id, 'verified')}
                            disabled={actionInProgress === decl.id}
                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                            title="Verify and Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleVerify(decl.id, 'rejected')}
                            disabled={actionInProgress === decl.id}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Completed</span>
                      )}
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
