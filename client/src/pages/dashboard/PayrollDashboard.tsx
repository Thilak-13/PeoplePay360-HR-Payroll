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
  ChevronRight,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  CreditCard,
  Layers,
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
  DispatchToast,
} from './types';
import { StatusBadge } from '../../components/shared/StatusBadge';

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
        description: `Standard bank payout CSV for Payrun #${selectedPayrunId} downloaded.`,
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
      maximumFractionDigits: 0,
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
        { name: 'May 2026', net_wage: 65000, gross_wage: 82000, payslips: 4 },
        { name: 'Jun 2026', net_wage: 70000, gross_wage: 88000, payslips: 4 },
        { name: 'Jul 2026', net_wage: 72000, gross_wage: 91000, payslips: 4 },
        { name: 'Aug 2026', net_wage: data?.kpis?.total_net_paid || 75000, gross_wage: data?.kpis?.total_gross_paid || 95000, payslips: data?.kpis?.payslip_count || 4 },
      ];

  const warningAlertsCount = data?.compliance_alerts.filter((a) => a.severity === 'warning').length || 0;
  const criticalAlertsCount = data?.compliance_alerts.filter((a) => a.severity === 'critical').length || 0;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 text-slate-900 font-sans">
      {/* Toast Notification */}
      {activeToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl shadow-lg flex items-start space-x-3 transition-all ${
            activeToast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          {activeToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{activeToast.title}</h4>
            <p className="text-xs mt-0.5 text-slate-600">{activeToast.description}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP HEADER & OPERATIONAL CONTEXT */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Operations &amp; Payroll Workspace</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Workforce &amp; Payroll Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time disbursement metrics, department cost allocations, and compliance audit.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Period Selector */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600">
            <span>Cycle:</span>
            <select
              value={selectedPayrunId}
              onChange={(e) => setSelectedPayrunId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-md px-2 py-0.5 font-medium text-slate-800 focus:outline-none text-xs cursor-pointer"
            >
              <option value={1}>#1 (August 2026 Monthly)</option>
              <option value={2}>#2 (September 2026 Monthly)</option>
            </select>
          </div>

          <button
            onClick={handleExportBankFile}
            disabled={isExporting}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="Download bank payout CSV"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSendPayslips}
            disabled={isSendingEmails}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="Dispatch payslip emails to employees"
          >
            {isSendingEmails ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
            <span>Send Slips</span>
          </button>

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
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. EXECUTIVE FINANCIAL & WORKFORCE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Net Disbursed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Net Disbursed</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {data ? formatCurrency(data.kpis.total_net_paid) : '₹0'}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Net take-home payout
            </p>
          </div>
        </div>

        {/* KPI 2: Gross Spend */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Gross Spend</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {data ? formatCurrency(data.kpis.total_gross_paid) : '₹0'}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Gross payroll expense
            </p>
          </div>
        </div>

        {/* KPI 3: Active Employees */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Headcount</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {data ? data.kpis.active_employees_count : 0} <span className="text-sm font-normal text-slate-500 font-sans">Staff</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Onboarded &amp; active
            </p>
          </div>
        </div>

        {/* KPI 4: Average Salary */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Average Salary</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {data ? formatCurrency(data.kpis.avg_salary) : '₹0'}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Active contracts baseline
            </p>
          </div>
        </div>

        {/* KPI 5: Approved Leaves */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Approved Time Off</span>
            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
              {data ? `${data.kpis.approved_leave_days}` : '0'} <span className="text-sm font-normal text-slate-500 font-sans">Days</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Processed leave quota
            </p>
          </div>
        </div>
      </div>

      {/* 3. OPERATIONAL PAYROLL PIPELINE FLOW */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span>Monthly Payroll Processing Pipeline</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              End-to-end execution flow for active Payrun Cycle #{selectedPayrunId}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-500">Pipeline Status:</span>
            <StatusBadge status="active" label="In Progress" />
          </div>
        </div>

        {/* 5-Stage Visual Workflow Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {/* Step 1 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stage 01</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-semibold text-xs text-slate-900">Contracts &amp; Wage Sync</div>
            <p className="text-[11px] text-slate-500">
              Active running contracts and base compensation verified.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stage 02</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-semibold text-xs text-slate-900">Attendance &amp; LOP</div>
            <p className="text-[11px] text-slate-500">
              Biometric punches and approved leaves mapped to worked days.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Stage 03</span>
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
            </div>
            <div className="font-semibold text-xs text-indigo-950">Salary Rules Batch</div>
            <p className="text-[11px] text-indigo-900/80">
              Sequenced calculation for allowances, deductions, and tax withholdings.
            </p>
          </div>

          {/* Step 4 */}
          <div
            className={`p-3 rounded-xl space-y-1.5 border ${
              criticalAlertsCount > 0
                ? 'bg-rose-50/70 border-rose-200'
                : warningAlertsCount > 0
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Stage 04</span>
              {criticalAlertsCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              ) : warningAlertsCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div className="font-semibold text-xs text-slate-900">Compliance Audit</div>
            <p className="text-[11px] text-slate-600">
              {criticalAlertsCount > 0
                ? `${criticalAlertsCount} critical blocking item`
                : warningAlertsCount > 0
                ? `${warningAlertsCount} unbanked disbursement warning`
                : 'Pre-validation audit checks clean'}
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Stage 05</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="font-semibold text-xs text-slate-900">Bank Disbursement</div>
            <p className="text-[11px] text-slate-500">
              Automated CSV export and payslip distribution ready.
            </p>
          </div>
        </div>
      </div>

      {/* 4. VISUAL ANALYTICS & SPEND BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Department Gross Spend (Bar Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>Department Gross Spend</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Current cycle payroll cost allocation per department
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 bg-slate-700 rounded-xs inline-block"></span>
              <span>Gross (₹)</span>
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
                    fill="#334155"
                    radius={[4, 4, 0, 0]}
                    name="Gross Spend"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No department spend data recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Monthly Salary Disbursement Progression (Line Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                <span>Monthly Disbursement Progression</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Historical comparison of Net Payouts vs. Gross Wages
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-0.5 bg-slate-900 inline-block"></span>
                <span className="text-slate-600 font-medium">Net</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block"></span>
                <span className="text-slate-600 font-medium">Gross</span>
              </div>
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
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#0f172a' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gross_wage"
                    name="gross_wage"
                    stroke="#94a3b8"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#94a3b8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No monthly trend records available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. ACTIONABLE COMPLIANCE AUDIT & RESOLUTION QUEUE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Compliance &amp; Disbursement Audit Queue
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Automated pre-validation checks across master records and payment setups.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200/80">
            <button
              onClick={() => setAlertFilter('all')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Flags ({data?.compliance_alerts.length || 0})
            </button>
            <button
              onClick={() => setAlertFilter('critical')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'critical'
                  ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Critical ({criticalAlertsCount})
            </button>
            <button
              onClick={() => setAlertFilter('warning')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                alertFilter === 'warning'
                  ? 'bg-white text-amber-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Warnings ({warningAlertsCount})
            </button>
          </div>
        </div>

        {/* Audit Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/70 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Audit Finding / Discrepancy</th>
                <th className="py-2.5 px-4">Affected Employee</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      {alert.severity === 'critical' ? (
                        <StatusBadge status="refused" label="Critical Block" />
                      ) : (
                        <StatusBadge status="pending" label="Warning" />
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
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
                        >
                          <span>Review &amp; Fix</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Verified</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    All compliance pre-checks passed! No alerts matching current filter.
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
