import React, { useState, useEffect } from 'react';
import {
  SalaryStructure,
  EligibleEmployee,
  Step1ValidateResponse,
  Payrun
} from './types';

interface PayrunWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayrunCreated: (payrun: Payrun) => void;
  structures: SalaryStructure[];
}

export const PayrunWizardModal: React.FC<PayrunWizardModalProps> = ({
  isOpen,
  onClose,
  onPayrunCreated,
  structures,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form
  const [name, setName] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [structureId, setStructureId] = useState<number | undefined>(undefined);

  // Step 1 Validation Result
  const [validating, setValidating] = useState<boolean>(false);
  const [step1Result, setStep1Result] = useState<Step1ValidateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2 Employees
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Default dates to current month
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      setName(`${monthName} Regular Payrun`);
      setDateStart(firstDay);
      setDateEnd(lastDay);
      setStep(1);
      setErrorMsg(null);
      setStep1Result(null);
    }
  }, [isOpen]);

  // Trigger Step 1 validation
  const handleValidateStep1 = async () => {
    if (!name || !dateStart || !dateEnd) {
      setErrorMsg('Please enter payrun name and dates');
      return;
    }

    setValidating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/payroll/payruns/wizard/step1-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date_start: dateStart,
          date_end: dateEnd,
          structure_id: structureId ? Number(structureId) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Validation failed');
      }

      const data: Step1ValidateResponse = await res.json();
      setStep1Result(data);

      if (data.valid) {
        // Fetch eligible employees for step 2
        fetchEligibleEmployees();
        setStep(2);
      } else {
        setErrorMsg(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error validating payrun parameters');
    } finally {
      setValidating(false);
    }
  };

  const fetchEligibleEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch(
        `/api/v1/payroll/payruns/wizard/eligible-employees?date_start=${dateStart}&date_end=${dateEnd}`
      );
      if (!res.ok) throw new Error('Failed to load eligible employees');
      const data: EligibleEmployee[] = await res.json();
      setEligibleEmployees(data);
      // Default: select all
      setSelectedEmpIds(data.map((e) => e.employee_id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleToggleEmployee = (id: number) => {
    if (selectedEmpIds.includes(id)) {
      setSelectedEmpIds(selectedEmpIds.filter((empId) => empId !== id));
    } else {
      setSelectedEmpIds([...selectedEmpIds, id]);
    }
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedEmpIds(eligibleEmployees.map((e) => e.employee_id));
    } else {
      setSelectedEmpIds([]);
    }
  };

  const handleConfirmAndCreate = async () => {
    if (selectedEmpIds.length === 0) {
      setErrorMsg('Please select at least one employee for the payrun.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/payroll/payruns/wizard/step2-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date_start: dateStart,
          date_end: dateEnd,
          structure_id: structureId ? Number(structureId) : undefined,
          employee_ids: selectedEmpIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create payrun');
      }

      const createdPayrun: Payrun = await res.json();
      onPayrunCreated(createdPayrun);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating payrun batch');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                Step {step} of 2
              </span>
              <h2 className="text-lg font-bold">Payrun Generation Wizard</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {step === 1
                ? 'Define pay period, salary structure, and check date overlap compliance.'
                : 'Review eligible employees, active contracts, and compliance warnings.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'
              }`}
            >
              1
            </div>
            <span className={step === 1 ? 'font-bold text-slate-900' : 'text-slate-600'}>
              Period & Structure
            </span>
          </div>
          <div className="h-0.5 w-16 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </div>
            <span className={step === 2 ? 'font-bold text-slate-900' : 'text-slate-500'}>
              Eligible Employees & Warnings
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1 Content */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payrun Batch Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., September 2026 Regular Payrun"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period End Date *
                </label>
                <input
                  type="date"
                  required
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Salary Structure
              </label>
              <select
                value={structureId || ''}
                onChange={(e) => setStructureId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Standard Salary Structure (Default)</option>
                {structures.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Overlap warnings notice */}
            {step1Result && step1Result.overlapping_payruns.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Note: Overlapping Batches Detected
                </div>
                <p className="mb-1 text-amber-700">The following payruns overlap with this date range:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-900">
                  {step1Result.overlapping_payruns.map((op, i) => (
                    <li key={i}>{op}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 2 Content */}
        {step === 2 && (
          <div className="p-6 space-y-4 max-h-[460px] overflow-y-auto">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-4">
                <span>
                  Eligible Employees: <strong>{eligibleEmployees.length}</strong>
                </span>
                <span>
                  Selected for Batch: <strong>{selectedEmpIds.length}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {loadingEmployees ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Scanning temporal contracts & auditing compliance...
              </div>
            ) : eligibleEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No active contracts found covering period {dateStart} to {dateEnd}.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            selectedEmpIds.length === eligibleEmployees.length &&
                            eligibleEmployees.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Contract Wage</th>
                      <th className="py-2.5 px-3">Bank Details</th>
                      <th className="py-2.5 px-3">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleEmployees.map((emp) => {
                      const isSelected = selectedEmpIds.includes(emp.employee_id);
                      return (
                        <tr
                          key={emp.employee_id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-indigo-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEmployee(emp.employee_id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div>{emp.employee_name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{emp.employee_email}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{emp.department_name || '—'}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            ₹{Number(emp.wage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3">
                            {emp.has_bank_details ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium text-[11px]">
                                Verified
                              </span>
                            ) : (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-medium text-[11px]">
                                Missing Bank
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {emp.warning ? (
                              <span
                                title={emp.warning}
                                className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium text-[11px] inline-flex items-center gap-1"
                              >
                                ⚠ {emp.warning.slice(0, 24)}...
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium text-[11px]">✓ Passed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidateStep1}
                disabled={validating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {validating ? 'Validating...' : 'Next: Query Eligible Employees →'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ← Back to Step 1
              </button>
              <button
                type="button"
                onClick={handleConfirmAndCreate}
                disabled={submitting || selectedEmpIds.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Generating Payrun...' : `Confirm & Create Payrun (${selectedEmpIds.length})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
