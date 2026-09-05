import React, { useState, useEffect } from 'react';
import { Payrun, SalaryStructure, PayrollMetrics } from './types';
import { PayrunWizardModal } from './PayrunWizardModal';
import { StatusBadge } from '../../components/shared/StatusBadge';

interface PayrunListProps {
  onSelectPayrun: (payrunId: number) => void;
  onNavigateStructures?: () => void;
}

export const PayrunList: React.FC<PayrunListProps> = ({
  onSelectPayrun,
  onNavigateStructures,
}) => {
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [metrics, setMetrics] = useState<PayrollMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payrunsRes, structRes, metricsRes] = await Promise.all([
        fetch('/api/v1/payroll/payruns'),
        fetch('/api/v1/payroll/structures'),
        fetch('/api/v1/payroll/metrics'),
      ]);

      if (payrunsRes.ok) {
        const pData: Payrun[] = await payrunsRes.json();
        setPayruns(pData);
      }
      if (structRes.ok) {
        const sData: SalaryStructure[] = await structRes.json();
        setStructures(sData);
      }
      if (metricsRes.ok) {
        const mData: PayrollMetrics = await metricsRes.json();
        setMetrics(mData);
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPayruns = payruns.filter((p) => {
    const matchesTab = activeTab === 'all' || p.status === activeTab;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.structure_name && p.structure_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Payroll Engine & Payruns</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated salary calculations, temporal contract resolution, and compliance state transitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateStructures && (
            <button
              onClick={onNavigateStructures}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Salary Structures
            </button>
          )}
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Generate Payrun (Wizard)
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Active Payrun Batches</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total_payruns}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.draft_payruns} draft &bull; {metrics.computed_payruns} computed
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Current Month Payout</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              ₹{Number(metrics.current_month_net_payout).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Net disbursements</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Total Paid (YTD)</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ₹{Number(metrics.total_paid_ytd).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{metrics.paid_payruns} finalized batches</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Unresolved Warnings</div>
            <div className={`text-2xl font-black mt-1 ${metrics.pending_warnings > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {metrics.pending_warnings}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Validation barrier flags</div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {['all', 'draft', 'computed', 'validated', 'paid'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search payrun batches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Payrun Batches List */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 text-sm">
          <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p>Loading Payrun Batches...</p>
        </div>
      ) : filteredPayruns.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-xl">
            💳
          </div>
          <h3 className="text-base font-bold text-slate-800">No Payrun Batches Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Get started by launching the Payrun Generation Wizard to compute salary structures.
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
          >
            Launch Wizard &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPayruns.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectPayrun(p.id)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-slate-400">#{p.id}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.date_start} &rarr; {p.date_end}
                </p>

                {p.warning_count > 0 && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>{p.warning_count} unresolved compliance warning(s)</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Net Payout</div>
                  <div className="text-sm font-black text-slate-900">
                    ₹{Number(p.total_net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Employees</div>
                  <div className="text-sm font-bold text-indigo-600">{p.payslip_count}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payrun Wizard Modal */}
      <PayrunWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onPayrunCreated={(newPayrun) => {
          fetchData();
          onSelectPayrun(newPayrun.id);
        }}
        structures={structures}
      />
    </div>
  );
};
