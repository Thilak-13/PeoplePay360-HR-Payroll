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
  LineChart,
  Line,
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
      setActiveToast({
        type: 'success',
        title: result.toast?.title || 'Payslips Dispatched',
        description: 'Payslips queued and dispatched to employee emails',
      });
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

  const monthlyTrendsData = (data?.monthly_trends && data.monthly_trends.length > 0)
    ? data.monthly_trends.map((item) => {
        let label = item.month || item.period_start || 'Period';
        if (item.period_start) {
          try {
            const d = new Date(item.period_start);
            label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          } catch {
            label = item.period_start;
          }
        }
        return {
          name: label,
          net_wage: Number(item.net_wage) || 0,
          gross_wage: Number(item.gross_wage) || Number(item.net_wage) || 0,
          payslips: item.payslip_count || 0,
        };
      })
    : [
        { name: 'May 2026', net_wage: 6500, gross_wage: 8000, payslips: 1 },
        { name: 'Jun 2026', net_wage: 7000, gross_wage: 8200, payslips: 1 },
        { name: 'Jul 2026', net_wage: 7200, gross_wage: 8300, payslips: 1 },
        { name: 'Aug 2026', net_wage: data?.kpis?.total_net_paid || 7500, gross_wage: data?.kpis?.total_gross_paid || 8500, payslips: data?.kpis?.payslip_count || 1 },
      ];

  const unbankedAlerts = (data?.attention_alerts && data.attention_alerts.length > 0)
    ? data.attention_alerts
    : (data?.compliance_alerts?.filter(
        (a) => a.type === 'missing_banking' || (a.issue && a.issue.toLowerCase().includes('bank')) || a.message.toLowerCase().includes('bank')
      ) || []);

  const sidebarAlerts = unbankedAlerts.length > 0
    ? unbankedAlerts
    : (data?.compliance_alerts?.filter((a) => a.severity === 'warning') || []);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Payroll & Workforce Overview
              </h1>
              <p className="text-xs text-slate-500">
                Real-time disbursements, department spending, and compliance monitoring.
              </p>
            </div>
          </div>
        </div>

        {/* Global Batch Utility Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600">
            <span>Payrun:</span>
            <select
              value={selectedPayrunId}
              onChange={(e) => setSelectedPayrunId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-semibold text-slate-800 focus:outline-none text-xs"
            >
              <option value={1}>#1 (August 2026 Monthly)</option>
              <option value={2}>#2 (September 2026 Monthly)</option>
            </select>
          </div>

          <button
            onClick={handleExportBankFile}
            disabled={isExporting}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Export standard bank payment CSV"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Bank CSV'}</span>
          </button>

          <button
            onClick={handleSendPayslips}
            disabled={isSendingEmails}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Batch dispatch payslip emails to employees"
          >
            {isSendingEmails ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isSendingEmails ? 'Sending...' : 'Send Payslips'}</span>
          </button>

          {onViewPrintablePayslip && (
            <button
              onClick={() => onViewPrintablePayslip(1)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Open print-ready payslip layout"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sample Slip</span>
            </button>
          )}

          <button
            onClick={fetchDashboardData}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Net Paid */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Total Net Disbursed
            </span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {data ? formatCurrency(data.kpis.total_net_paid) : '₹0.00'}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Current period payroll payout
            </p>
          </div>
        </div>

        {/* KPI 2: Payslip Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Generated Payslips
            </span>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {data ? data.kpis.payslip_count : 0}
            </div>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">
              Processed & verified slips
            </p>
          </div>
        </div>

        {/* KPI 3: Average Salary */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Average Base Wage
            </span>
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {data ? formatCurrency(data.kpis.avg_salary) : '₹0.00'}
            </div>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              Active contracts baseline
            </p>
          </div>
        </div>

        {/* KPI 4: Approved Leave Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Approved Leaves
            </span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {data ? `${data.kpis.approved_leave_days} Days` : '0 Days'}
            </div>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              Total period time off
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Department Spend Chart & Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Charts (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Department Spend Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Department Gross Spend</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gross payroll distribution across organization departments.
                </p>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                <span className="inline-block w-2.5 h-2.5 bg-indigo-600 rounded-sm"></span>
                <span>Gross Spend (₹)</span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              {data && data.department_spend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.department_spend}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="department_name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(val) => `₹${val / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Gross Spend']}
                      labelStyle={{ fontWeight: '600', color: '#0f172a' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar
                      dataKey="spend"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                      name="Gross Spend"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No department spend data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Monthly Salary Disbursement Trends (LineChart) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Salary Trends</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Monthly progression of net payouts and gross wages.
                </p>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              {monthlyTrendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyTrendsData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(val) => `₹${val / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value)),
                        name === 'net_wage' ? 'Net Payout' : 'Gross Wage'
                      ]}
                      labelStyle={{ fontWeight: '600', color: '#0f172a' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      formatter={(value) => (
                        <span className="text-xs font-medium text-slate-600">
                          {value === 'net_wage' ? 'Net Payout' : 'Gross Wage'}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="net_wage"
                      name="net_wage"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4f46e5' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gross_wage"
                      name="gross_wage"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No monthly trend data available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Operational Compliance Alerts & Workforce Overview (1 col) */}
        <div className="lg:col-span-1 space-y-5">
          {/* Operational Compliance Alerts Widget */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Compliance Alerts
                </h2>
              </div>
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {sidebarAlerts.length} Warning{sidebarAlerts.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pre-validation checks requiring review before payment.
            </p>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {sidebarAlerts.length > 0 ? (
                sidebarAlerts.map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-lg space-y-1.5 hover:bg-amber-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-900">
                        {alert.employee_name || 'Unassigned Employee'}
                      </div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                        Warning
                      </span>
                    </div>

                    <p className="text-xs text-amber-900">
                      {alert.issue || alert.message || 'Missing Bank Account or IFSC'}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-200/50 text-[11px]">
                      <span className="text-slate-500">
                        {alert.department_name || 'General'}
                      </span>
                      {alert.employee_id && onNavigateToEmployee ? (
                        <button
                          onClick={() => onNavigateToEmployee(alert.employee_id!)}
                          className="inline-flex items-center space-x-1 font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="font-medium text-amber-700">Action Required</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                  All active employees have verified banking details.
                </div>
              )}
            </div>
          </div>

          {/* Workforce Summary Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Workforce Summary</span>
            </h2>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                <span className="font-medium text-slate-600">Active Headcount</span>
                <span className="font-bold text-slate-900">
                  {data ? data.kpis.active_employees_count : 0} Employees
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                <span className="font-medium text-slate-600">Total Gross Paid</span>
                <span className="font-bold text-slate-900">
                  {data ? formatCurrency(data.kpis.total_gross_paid) : '₹0.00'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                <span className="font-medium text-slate-600">Total Payrun Batches</span>
                <span className="font-bold text-slate-900">
                  {data ? data.kpis.total_payruns_count : 0} Batches
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Compliance Alerts Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Pre-Validation & Compliance Flags
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live checks identified in master data and payrun batches.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setAlertFilter('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({data?.compliance_alerts.length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('critical')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-rose-600'
              }`}
            >
              Critical ({data?.compliance_alerts.filter((a) => a.severity === 'critical').length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('warning')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'warning'
                  ? 'bg-amber-500 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              Warnings ({data?.compliance_alerts.filter((a) => a.severity === 'warning').length || 0})
            </button>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Alert Details</th>
                <th className="py-2.5 px-4">Affected Employee</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      {alert.severity === 'critical' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Warning
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{alert.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{alert.message}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {alert.employee_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {alert.department_name || 'General'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {alert.employee_id && onNavigateToEmployee ? (
                        <button
                          onClick={() => onNavigateToEmployee(alert.employee_id!)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Pre-Validation</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No compliance alerts matching current filter.
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
