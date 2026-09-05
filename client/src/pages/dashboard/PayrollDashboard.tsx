import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  FileText,
  TrendingUp,
  Calendar,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Download,
  Send,
  RefreshCw,
  Building2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  DashboardAnalyticsResponse,
  KPIsSummary,
  DepartmentSpendItem,
  ComplianceAlertItem,
  DispatchToast,
} from './types';

interface PayrollDashboardProps {
  onNavigateToEmployee?: (employeeId: number) => void;
  onNavigateToPayslip?: (payslipId: number) => void;
  onNavigateToPayrun?: (payrunId: number) => void;
  onViewPrintablePayslip?: (payslipId?: number) => void;
}

export const PayrollDashboard: React.FC<PayrollDashboardProps> = ({
  onNavigateToEmployee,
  onNavigateToPayslip,
  onNavigateToPayrun,
  onViewPrintablePayslip,
}) => {
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [selectedPayrunId, setSelectedPayrunId] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSendingEmails, setIsSendingEmails] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<DispatchToast | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/analytics/dashboard');
      if (!res.ok) {
        throw new Error(`Failed to load analytics dashboard (Status: ${res.status})`);
      }
      const json: DashboardAnalyticsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching dashboard analytics:', err);
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleExportBankFile = async () => {
    try {
      setIsExporting(true);
      const res = await fetch(`/api/v1/analytics/payruns/${selectedPayrunId}/export-bank-file`);
      if (!res.ok) {
        throw new Error('Failed to export bank file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bank_payout_payrun_${selectedPayrunId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setActiveToast({
        type: 'success',
        title: 'Bank File Exported',
        description: `Standard bank payout CSV for Payrun #${selectedPayrunId} successfully downloaded.`,
      });
    } catch (err: any) {
      setActiveToast({
        type: 'error',
        title: 'Export Failed',
        description: err.message || 'Could not export bank payout file.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendPayslips = async () => {
    try {
      setIsSendingEmails(true);
      const res = await fetch(`/api/v1/analytics/payruns/${selectedPayrunId}/send-payslips`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to trigger payslip dispatch');
      }
      const result = await res.json();
      setActiveToast(result.toast);
      fetchDashboardData();
    } catch (err: any) {
      setActiveToast({
        type: 'error',
        title: 'Dispatch Failed',
        description: err.message || 'Could not send batch payslips.',
      });
    } finally {
      setIsSendingEmails(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredAlerts = data?.compliance_alerts.filter((alert) => {
    if (alertFilter === 'all') return true;
    return alert.severity === alertFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 space-y-6">
      {/* Toast Notification */}
      {activeToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl shadow-xl flex items-start space-x-3 transition-all transform animate-bounce-short ${
            activeToast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : 'bg-red-50 border border-red-300 text-red-900'
          }`}
        >
          {activeToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{activeToast.title}</h4>
            <p className="text-xs mt-0.5 text-gray-700">{activeToast.description}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Executive Payroll Dashboard
              </h1>
              <p className="text-sm text-gray-500">
                Live SQL aggregations, department gross payroll spend, and pre-validation compliance monitoring.
              </p>
            </div>
          </div>
        </div>

        {/* Global Batch Utility Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600">
            <span>Active Payrun:</span>
            <select
              value={selectedPayrunId}
              onChange={(e) => setSelectedPayrunId(Number(e.target.value))}
              className="bg-white border border-gray-300 rounded px-2 py-0.5 font-semibold text-gray-800 focus:outline-none"
            >
              <option value={1}>#1 (August 2026 Monthly)</option>
              <option value={2}>#2 (September 2026 Monthly)</option>
            </select>
          </div>

          <button
            onClick={handleExportBankFile}
            disabled={isExporting}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
            title="Export standard bank payment CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>{isExporting ? 'Exporting...' : 'Export Bank File'}</span>
          </button>

          <button
            onClick={handleSendPayslips}
            disabled={isSendingEmails}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
            title="Batch dispatch payslip emails to employees"
          >
            <Send className="w-4 h-4" />
            <span>{isSendingEmails ? 'Dispatching...' : 'Dispatch Payslips'}</span>
          </button>

          {onViewPrintablePayslip && (
            <button
              onClick={() => onViewPrintablePayslip(1)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
              title="Open print-ready payslip layout"
            >
              <FileText className="w-4 h-4" />
              <span>Printable Payslip</span>
            </button>
          )}

          <button
            onClick={fetchDashboardData}
            className="p-2 border border-gray-200 hover:bg-gray-100 rounded-lg text-gray-500 transition"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Net Paid */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Net Paid
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">
              {data ? formatCurrency(data.kpis.total_net_paid) : '₹0.00'}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              Realized net payout to employees
            </p>
          </div>
        </div>

        {/* KPI 2: Payslip Count */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Payslip Count
            </span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">
              {data ? data.kpis.payslip_count : 0}
            </div>
            <p className="text-xs text-blue-600 font-medium mt-1">
              Historical validated & paid slips
            </p>
          </div>
        </div>

        {/* KPI 3: Average Salary */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Avg Contract Salary
            </span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">
              {data ? formatCurrency(data.kpis.avg_salary) : '₹0.00'}
            </div>
            <p className="text-xs text-purple-600 font-medium mt-1">
              Active running contracts average
            </p>
          </div>
        </div>

        {/* KPI 4: Approved Leave Days */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Approved Leave Days
            </span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">
              {data ? `${data.kpis.approved_leave_days} Days` : '0 Days'}
            </div>
            <p className="text-xs text-amber-600 font-medium mt-1">
              Cumulative approved leave requests
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Department Spend Chart & Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Spend Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>Department Gross Spend</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Gross payroll expenditure breakdown across organizational units.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="inline-block w-3 h-3 bg-indigo-600 rounded"></span>
              <span className="text-gray-600 font-medium">Gross Spend (₹)</span>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            {data && data.department_spend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.department_spend}
                  margin={{ top: 10, right: 20, left: 20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="department_name"
                    tick={{ fontSize: 12, fill: '#4b5563' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#4b5563' }}
                    tickFormatter={(val) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Gross Spend']}
                    labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar
                    dataKey="spend"
                    fill="#4f46e5"
                    radius={[6, 6, 0, 0]}
                    name="Gross Spend"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No department spend data available yet.
              </div>
            )}
          </div>
        </div>

        {/* Headcount & Quick Overview Card (1 col) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Workforce Overview</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Current organization composition and active payroll batches.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Active Headcount</span>
                <span className="text-lg font-bold text-gray-900">
                  {data ? data.kpis.active_employees_count : 0} Employees
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Total Gross Paid</span>
                <span className="text-base font-bold text-gray-900">
                  {data ? formatCurrency(data.kpis.total_gross_paid) : '₹0.00'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Payrun Batches</span>
                <span className="text-base font-bold text-gray-900">
                  {data ? data.kpis.total_payruns_count : 0} Total
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-indigo-800 leading-relaxed">
                <strong>Lead Integrator Note:</strong> Master schema holds 11 tables. Compliance audits evaluate temporal contracts and missing banking details prior to payment authorization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Compliance Alerts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-gray-900">
                Operational & Pre-Validation Compliance Alerts
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Live audit flags identified in master data and payrun batches. Critical items must be resolved before payroll validation.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setAlertFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                alertFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All Alerts ({data?.compliance_alerts.length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('critical')}
              className={`px-3 py-1.5 rounded-lg transition ${
                alertFilter === 'critical'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-red-700'
              }`}
            >
              Critical ({data?.compliance_alerts.filter((a) => a.severity === 'critical').length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('warning')}
              className={`px-3 py-1.5 rounded-lg transition ${
                alertFilter === 'warning'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-amber-800'
              }`}
            >
              Warnings ({data?.compliance_alerts.filter((a) => a.severity === 'warning').length || 0})
            </button>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-3 px-6">Severity</th>
                <th className="py-3 px-6">Alert / Discrepancy</th>
                <th className="py-3 px-6">Affected Employee</th>
                <th className="py-3 px-6">Department</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50/80 transition">
                    <td className="py-4 px-6">
                      {alert.severity === 'critical' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                          Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Warning
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-gray-900">{alert.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{alert.message}</div>
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {alert.employee_name || 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {alert.department_name || 'General'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {alert.employee_id && onNavigateToEmployee ? (
                        <button
                          onClick={() => onNavigateToEmployee(alert.employee_id!)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Pre-Validation Flag</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                    No compliance alerts match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
