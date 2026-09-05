import React, { useState, useEffect } from 'react';
import {
  Calculator,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Info,
  Send,
  Building,
  HeartPulse,
  Home,
  Briefcase
} from 'lucide-react';
import { submitTaxDeclaration, calculateTDS, fetchTaxDeclaration } from './api';
import { RegimeComparisonResult, TaxDeclaration } from './types';

export const TaxDeclarationPortal: React.FC = () => {
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [financialYear, setFinancialYear] = useState<string>('2024-2025');
  const [annualGross, setAnnualGross] = useState<number>(1200000);
  const [selectedRegime, setSelectedRegime] = useState<'new' | 'old'>('new');

  // Deductions
  const [sec80c, setSec80c] = useState<number>(150000);
  const [sec80d, setSec80d] = useState<number>(25000);
  const [hraRent, setHraRent] = useState<number>(120000);
  const [homeLoan, setHomeLoan] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');

  const [calcResult, setCalcResult] = useState<RegimeComparisonResult | null>(null);
  const [existingDeclaration, setExistingDeclaration] = useState<TaxDeclaration | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    runCalculation();
  }, [annualGross, sec80c, sec80d, hraRent, homeLoan]);

  useEffect(() => {
    loadDeclaration();
  }, [employeeId, financialYear]);

  const loadDeclaration = async () => {
    try {
      const decl = await fetchTaxDeclaration(employeeId, financialYear);
      setExistingDeclaration(decl);
      if (decl) {
        setSelectedRegime(decl.regime);
        setSec80c(decl.section_80c_amount);
        setSec80d(decl.section_80d_amount);
        setHraRent(decl.hra_rent_paid);
        setHomeLoan(decl.home_loan_interest);
        setRemarks(decl.remarks || '');
      }
    } catch (e) {
      // ignore
    }
  };

  const runCalculation = async () => {
    try {
      const res = await calculateTDS({
        annual_gross: Number(annualGross) || 0,
        section_80c_amount: Number(sec80c) || 0,
        section_80d_amount: Number(sec80d) || 0,
        hra_rent_paid: Number(hraRent) || 0,
        home_loan_interest: Number(homeLoan) || 0,
      });
      setCalcResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const decl = await submitTaxDeclaration({
        employee_id: employeeId,
        financial_year: financialYear,
        regime: selectedRegime,
        section_80c_amount: Number(sec80c) || 0,
        section_80d_amount: Number(sec80d) || 0,
        hra_rent_paid: Number(hraRent) || 0,
        home_loan_interest: Number(homeLoan) || 0,
        remarks: remarks || 'Annual investment declaration submitted by employee',
      });
      setExistingDeclaration(decl);
      setFeedback({ type: 'success', message: `Tax declaration for FY ${financialYear} submitted successfully! Status: ${decl.status.toUpperCase()}` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to submit declaration' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-indigo-600" />
            Statutory Tax & Investment Declarations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Compare New vs Old Tax Regimes, submit Chapter VI-A investment proofs, and project your monthly TDS deductions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Employee ID</label>
            <input
              type="number"
              min={1}
              value={employeeId}
              onChange={(e) => setEmployeeId(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Financial Year</label>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="2024-2025">FY 2024-2025</option>
              <option value="2025-2026">FY 2025-2026</option>
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {existingDeclaration && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileCheck className="w-6 h-6 text-indigo-600" />
            <div>
              <span className="text-xs font-semibold uppercase text-indigo-600 tracking-wider">Active Declaration Found</span>
              <p className="text-sm text-indigo-950 font-medium">
                Current Regime: <span className="font-bold capitalize">{existingDeclaration.regime} Regime</span> | Status: <span className={`font-semibold px-2 py-0.5 rounded text-xs ${existingDeclaration.status === 'verified' ? 'bg-emerald-200 text-emerald-800' : existingDeclaration.status === 'rejected' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'}`}>{existingDeclaration.status.toUpperCase()}</span>
              </p>
            </div>
          </div>
          {existingDeclaration.remarks && (
            <p className="text-xs text-indigo-700 italic">Remarks: {existingDeclaration.remarks}</p>
          )}
        </div>
      )}

      {/* Comparison Overview Cards */}
      {calcResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* New Regime Card */}
          <div className={`p-5 rounded-xl border-2 transition-all ${selectedRegime === 'new' ? 'border-indigo-600 bg-white shadow-md' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Default Option</span>
                <h3 className="text-lg font-bold text-slate-900">New Tax Regime (Sec 115BAC)</h3>
              </div>
              {calcResult.recommended_regime === 'new' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Recommended
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Standard Deduction:</span>
                <span className="font-semibold text-slate-800">₹{calcResult.new_regime.standard_deduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Income:</span>
                <span className="font-semibold text-slate-800">₹{calcResult.new_regime.taxable_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-medium text-slate-900">Annual Tax Liability:</span>
                <span className="font-bold text-indigo-600">₹{calcResult.new_regime.total_annual_tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Estimated Monthly TDS:</span>
                <span className="font-semibold text-slate-700">₹{calcResult.new_regime.monthly_tds.toLocaleString()}/mo</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRegime('new')}
              className={`w-full mt-4 py-2 text-sm font-semibold rounded-lg transition-colors ${selectedRegime === 'new' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              {selectedRegime === 'new' ? 'Selected Regime' : 'Choose New Regime'}
            </button>
          </div>

          {/* Old Regime Card */}
          <div className={`p-5 rounded-xl border-2 transition-all ${selectedRegime === 'old' ? 'border-indigo-600 bg-white shadow-md' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Deductions Heavy</span>
                <h3 className="text-lg font-bold text-slate-900">Old Tax Regime</h3>
              </div>
              {calcResult.recommended_regime === 'old' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Recommended
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Total Exemptions & 80C:</span>
                <span className="font-semibold text-slate-800">₹{(calcResult.old_regime.standard_deduction + calcResult.old_regime.chapter_6a_deductions).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Income:</span>
                <span className="font-semibold text-slate-800">₹{calcResult.old_regime.taxable_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-medium text-slate-900">Annual Tax Liability:</span>
                <span className="font-bold text-purple-600">₹{calcResult.old_regime.total_annual_tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Estimated Monthly TDS:</span>
                <span className="font-semibold text-slate-700">₹{calcResult.old_regime.monthly_tds.toLocaleString()}/mo</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRegime('old')}
              className={`w-full mt-4 py-2 text-sm font-semibold rounded-lg transition-colors ${selectedRegime === 'old' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              {selectedRegime === 'old' ? 'Selected Regime' : 'Choose Old Regime'}
            </button>
          </div>

          {/* Savings Summary Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-900 to-slate-900 text-white flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Tax Optimization Insight</span>
              <h3 className="text-xl font-bold mt-1">
                {calcResult.annual_savings > 0
                  ? `Save ₹${calcResult.annual_savings.toLocaleString()} annually`
                  : 'Identical Tax Liability'}
              </h3>
              <p className="text-slate-300 text-xs mt-2">
                Opting for the <strong className="text-amber-400 capitalize">{calcResult.recommended_regime} Regime</strong> maximizes your monthly take-home salary by ₹{calcResult.monthly_savings.toLocaleString()}/month.
              </p>
            </div>
            <div className="mt-4 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs text-indigo-200">
                <Info className="w-4 h-4 text-indigo-300 flex-shrink-0" />
                <span>New Regime offers flat ₹75k std deduction without needing receipt proofs.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Declaration Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Investment & Exemption Declarations (Chapter VI-A)
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Amounts entered below are considered for tax exemptions under Old Tax Regime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gross Annual CTC */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" />
              Estimated Annual Gross Salary (₹)
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={annualGross}
              onChange={(e) => setAnnualGross(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>

          {/* Section 80C */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-500" />
                Section 80C (PPF, ELSS, EPF, LIC)
              </span>
              <span className="text-xs text-slate-400">Max ₹1,50,000</span>
            </label>
            <input
              type="number"
              min={0}
              max={150000}
              value={sec80c}
              onChange={(e) => setSec80c(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Section 80D */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-500" />
                Section 80D (Health Insurance Premium)
              </span>
              <span className="text-xs text-slate-400">Max ₹25,000</span>
            </label>
            <input
              type="number"
              min={0}
              max={50000}
              value={sec80d}
              onChange={(e) => setSec80d(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* HRA Rent Paid */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-500" />
              Annual Rent Paid (HRA Exemption)
            </label>
            <input
              type="number"
              min={0}
              value={hraRent}
              onChange={(e) => setHraRent(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Home Loan Interest */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-500" />
                Home Loan Interest (Section 24b)
              </span>
              <span className="text-xs text-slate-400">Max ₹2,00,000</span>
            </label>
            <input
              type="number"
              min={0}
              max={200000}
              value={homeLoan}
              onChange={(e) => setHomeLoan(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Employee Declaration Notes / Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Attached ELSS mutual fund statement and rent receipts"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Form Action */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Official Declaration'}
          </button>
        </div>
      </form>
    </div>
  );
};
