import React, { useState, useEffect } from 'react';
import { SalaryStructure, SalaryRule } from './types';

interface SalaryStructureManagerProps {
  onBack?: () => void;
}

export const SalaryStructureManager: React.FC<SalaryStructureManagerProps> = ({
  onBack,
}) => {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddRuleModal, setShowAddRuleModal] = useState<boolean>(false);
  const [showCreateStructModal, setShowCreateStructModal] = useState<boolean>(false);

  // New Rule Form
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleCode, setRuleCode] = useState<string>('');
  const [ruleCategory, setRuleCategory] = useState<string>('ALLOWANCE');
  const [ruleSequence, setRuleSequence] = useState<number>(25);
  const [ruleAmountType, setRuleAmountType] = useState<string>('percentage');
  const [ruleAmount, setRuleAmount] = useState<number>(10);
  const [ruleBase, setRuleBase] = useState<string>('BASIC');

  // New Structure Form
  const [structName, setStructName] = useState<string>('');
  const [structCode, setStructCode] = useState<string>('');

  const fetchStructures = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payroll/structures');
      if (res.ok) {
        const data: SalaryStructure[] = await res.json();
        setStructures(data);
        if (data.length > 0 && !selectedStructure) {
          fetchStructureDetail(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching structures:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructureDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/payroll/structures/${id}`);
      if (res.ok) {
        const data: SalaryStructure = await res.json();
        setSelectedStructure(data);
      }
    } catch (err) {
      console.error('Error fetching structure detail:', err);
    }
  };

  useEffect(() => {
    fetchStructures();
  }, []);

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/payroll/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: structName, code: structCode }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowCreateStructModal(false);
        setStructName('');
        setStructCode('');
        fetchStructures();
        fetchStructureDetail(created.id);
      }
    } catch (err) {
      console.error('Error creating structure:', err);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStructure) return;
    try {
      const res = await fetch(`/api/v1/payroll/structures/${selectedStructure.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structure_id: selectedStructure.id,
          name: ruleName,
          code: ruleCode,
          category: ruleCategory,
          sequence: Number(ruleSequence),
          amount_type: ruleAmountType,
          amount: Number(ruleAmount),
          percentage_base: ruleBase,
        }),
      });
      if (res.ok) {
        setShowAddRuleModal(false);
        setRuleName('');
        setRuleCode('');
        fetchStructureDetail(selectedStructure.id);
      }
    } catch (err) {
      console.error('Error adding rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this salary rule?')) return;
    try {
      const res = await fetch(`/api/v1/payroll/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (res.ok && selectedStructure) {
        fetchStructureDetail(selectedStructure.id);
      }
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-indigo-600 font-medium mb-1 block"
            >
              ← Back to Payruns
            </button>
          )}
          <h1 className="text-2xl font-black text-slate-900">Salary Structures & Rules Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure sequenced calculation pipelines across BASIC, ALLOWANCE, GROSS, DEDUCTION, and NET.
          </p>
        </div>
        <button
          onClick={() => setShowCreateStructModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
        >
          + New Structure
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Structure List Sidebar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Available Structures
          </div>
          {structures.map((s) => (
            <div
              key={s.id}
              onClick={() => fetchStructureDetail(s.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedStructure?.id === s.id
                  ? 'bg-indigo-50/60 border-indigo-400 shadow-sm'
                  : 'hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs font-bold text-slate-900">{s.name}</div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">{s.code}</div>
            </div>
          ))}
        </div>

        {/* Selected Structure Detail & Rules */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedStructure?.name || 'Select a Structure'}
                </h2>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  Code: {selectedStructure?.code}
                </div>
              </div>
              {selectedStructure && (
                <button
                  onClick={() => setShowAddRuleModal(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  + Add Salary Rule
                </button>
              )}
            </div>

            <div className="p-4">
              {!selectedStructure?.rules || selectedStructure.rules.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No rules configured in this salary structure.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10">Seq</th>
                        <th className="py-2.5 px-3">Rule Name</th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount / Rate</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedStructure.rules
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                              {r.sequence}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{r.name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{r.code}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {r.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 capitalize text-slate-500">{r.amount_type}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                              {r.amount_type === 'percentage'
                                ? `${r.amount}% of ${r.percentage_base || 'BASIC'}`
                                : `₹${Number(r.amount).toLocaleString('en-IN')}`}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleDeleteRule(r.id)}
                                className="text-rose-500 hover:text-rose-700 font-semibold text-[11px]"
                              >
                                Delete
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
        </div>
      </div>

      {/* Create Structure Modal */}
      {showCreateStructModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Create Salary Structure</h2>
            <form onSubmit={handleCreateStructure} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Structure Name *</label>
                <input
                  type="text"
                  required
                  value={structName}
                  onChange={(e) => setStructName(e.target.value)}
                  placeholder="e.g. Executive Salary Structure"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unique Code *</label>
                <input
                  type="text"
                  required
                  value={structCode}
                  onChange={(e) => setStructCode(e.target.value)}
                  placeholder="e.g. EXEC_STRUCTURE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateStructModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add Salary Rule to Pipeline</h2>
            <form onSubmit={handleAddRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Medical Allowance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={ruleCode}
                    onChange={(e) => setRuleCode(e.target.value)}
                    placeholder="e.g. MED_ALLW"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="ALLOWANCE">ALLOWANCE</option>
                    <option value="GROSS">GROSS</option>
                    <option value="DEDUCTION">DEDUCTION</option>
                    <option value="NET">NET</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sequence</label>
                  <input
                    type="number"
                    value={ruleSequence}
                    onChange={(e) => setRuleSequence(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={ruleAmountType}
                    onChange={(e) => setRuleAmountType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount / Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ruleAmount}
                    onChange={(e) => setRuleAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {ruleAmountType === 'percentage' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Percentage Base</label>
                  <select
                    value={ruleBase}
                    onChange={(e) => setRuleBase(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="wage">Contract Wage</option>
                    <option value="GROSS">GROSS</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
