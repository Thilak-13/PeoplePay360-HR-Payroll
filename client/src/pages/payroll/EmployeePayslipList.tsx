import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, ArrowUpRight, Search, FileText } from 'lucide-react';
import { Payslip } from './types';

interface EmployeePayslipListProps {
  onSelectPayslip: (payslipId: number) => void;
}

export const EmployeePayslipList: React.FC<EmployeePayslipListProps> = ({
  onSelectPayslip,
}) => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [error, setError] = useState<string | null>(null);

  const fetchPayslips = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/payroll/payslips');
      if (!res.ok) {
        throw new Error('Failed to load payslips');
      }
      const data: Payslip[] = await res.json();
      setPayslips(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching payslips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  const filteredPayslips = payslips
    .filter((p) => {
      const query = searchQuery.toLowerCase();
      const period = ((p.date_from || '') + ' ' + (p.date_to || '')).toLowerCase();
      const status = (p.status || '').toLowerCase();
      return period.includes(query) || status.includes(query);
    })
    .sort((a, b) => {
      const dateA = new Date(a.date_from).getTime();
      const dateB = new Date(b.date_from).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const latestPayslip = payslips.length > 0
    ? [...payslips].sort((a, b) => new Date(b.date_from).getTime() - new Date(a.date_from).getTime())[0]
    : null;

  const totalPaid = payslips
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.net_wage || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        );
      case 'validated':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Validated
          </span>
        );
      case 'computed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Computed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            My Payslips
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your salary statements, earnings breakdown, and payment history.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Latest Net Pay
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {latestPayslip ? `₹${Number(latestPayslip.net_wage).toLocaleString('en-IN')}` : '—'}
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {latestPayslip ? `Period: ${latestPayslip.date_from} to ${latestPayslip.date_to}` : 'No payslips issued yet'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Total Payslips
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{payslips.length}</span>
            <span className="text-xs text-slate-400">issued statements</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {payslips.filter((p) => p.status === 'paid').length} marked as paid
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Total Disbursed (YTD)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">
              ₹{totalPaid.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Cumulative net salary received</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by date (YYYY-MM-DD) or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Sort by Date:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Payslips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Loading your payslips...</p>
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No Payslips Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No statements match your current search query.'
                : 'No payroll statements have been generated for your profile yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Payslip #</th>
                  <th className="px-6 py-3.5">Pay Period</th>
                  <th className="px-6 py-3.5 text-right">Gross Earnings</th>
                  <th className="px-6 py-3.5 text-right">Deductions</th>
                  <th className="px-6 py-3.5 text-right">Net Pay</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayslips.map((payslip) => (
                  <tr
                    key={payslip.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => onSelectPayslip(payslip.id)}
                  >
                    <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900">
                      #{payslip.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{payslip.date_from}</span>
                        <span className="text-slate-400">to</span>
                        <span>{payslip.date_to}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700 text-xs">
                      ₹{Number(payslip.gross_wage || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-rose-600 text-xs">
                      -₹{Number(payslip.total_deductions || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 text-sm">
                      ₹{Number(payslip.net_wage || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(payslip.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayslip(payslip.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                      >
                        View Statement
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePayslipList;
