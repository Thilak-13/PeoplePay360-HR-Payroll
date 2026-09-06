import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Award, TrendingUp, Search, RefreshCw, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { fetchWeeklyHours } from './api';
import { EmployeeWeeklyHours } from './types';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../../components/shared/RoleContext';

export const WeeklyHoursSummary: React.FC = () => {
  const { user } = useAuth();
  const { isSelfServiceOnly } = useRole();
  const [data, setData] = useState<EmployeeWeeklyHours[]>([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const empId = isSelfServiceOnly ? user?.employee_id : undefined;
      const res = await fetchWeeklyHours(empId, year, month);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter((e) =>
    e.employee_name.toLowerCase().includes(term.toLowerCase())
  );

  const execCount = data.filter((e) => e.salary_category === 'Executive Schedule').length;
  const stdCount = data.filter((e) => e.salary_category === 'Standard Full-Time').length;
  const partCount = data.filter((e) => e.salary_category.includes('Part-Time')).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/60">
              <Clock className="w-4 h-4" />
            </div>
            {isSelfServiceOnly ? "My Weekly Hours & Salary Tier" : "Workforce Weekly Hours & Salary Categorization"}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Weekly hours partitioning from biometric attendance, OT bonus, and salary tier classification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
              ].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {!isSelfServiceOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-xs font-medium text-slate-500">Total Active</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{data.length}</div>
          </div>

          <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-200/60 shadow-2xs">
            <div className="text-xs font-medium text-purple-700">Executive Schedule (≥45h)</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">{execCount}</div>
            <div className="text-xs text-purple-600 mt-0.5">1.5x OT Bonus</div>
          </div>

          <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-200/60 shadow-2xs">
            <div className="text-xs font-medium text-blue-700">Standard Full-Time (40-44.9h)</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{stdCount}</div>
            <div className="text-xs text-blue-600 mt-0.5">1.25x OT Bonus</div>
          </div>

          <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/60 shadow-2xs">
            <div className="text-xs font-medium text-amber-700">Part-Time Schedule (20-39.9h)</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{partCount}</div>
            <div className="text-xs text-amber-600 mt-0.5">Prorated Base Salary</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
          <div className="position-relative relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter employees..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="text-xs pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg w-64"
            />
          </div>
          <div className="text-xs text-slate-400">
            Showing {filtered.length} of {data.length} employees
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/70 text-slate-600 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4 font-medium">Employee</th>
                <th className="py-3 px-2 font-medium text-center">W1</th>
                <th className="py-3 px-2 font-medium text-center">W2</th>
                <th className="py-3 px-2 font-medium text-center">W3</th>
                <th className="py-3 px-2 font-medium text-center">W4</th>
                <th className="py-3 px-2 font-medium text-center">W5</th>
                <th className="py-3 px-3 font-medium text-right">Total Hours</th>
                <th className="py-3 px-3 font-medium text-right">Avg Weekly</th>
                <th className="py-3 px-3 font-medium">Salary Tier</th>
                <th className="py-3 px-3 font-medium text-right">OT Bonus</th>
                <th className="py-3 px-3 font-medium text-right">Leave Deduct</th>
                <th className="py-3 px-4 font-medium text-right">Net Adjusted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.employee_id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">{e.employee_name}</td>
                  {[0, 1, 2, 3, 4].map((index) => {
                    const w = e.weeks[index];
                    if (!w) return <td key={index} className="py-3 px-2 text-center text-slate-300">-</td>;
                    return (
                      <td key={index} className="py-3 px-2 text-center">
                        <span className={w.worked_hours > 0 ? 'font-medium' : 'text-slate-400'}>
                          {w.worked_hours}h
                        </span>
                        {w.overtime_hours > 0 && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded">
                            +{w.overtime_hours}h
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-3 px-3 text-right font-medium">{e.total_worked_hours}h</td>
                  <td className="py-3 px-3 text-right font-semibold">{e.avg_weekly_hours}h</td>
                  <td className="py-3 px-3">
                    {e.salary_category === 'Executive Schedule' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-medium text-[11px]">
                        <Award className="w-3 h-3" /> Executive (1.5x)
                      </span>
                    )}
                    {e.salary_category === 'Standard Full-Time' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium text-[11px]">
                        <CheckCircle className="w-3 h-3" /> Standard (1.25x)
                      </span>
                    )}
                    {e.salary_category.includes('Part-Time') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium text-[11px]">
                        <AlertCircle className="w-3 h-3" /> Part-Time (Prorated)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-medium">
                    {e.overtime_bonus > 0 ? `+₹${e.overtime_bonus.toLocaleString()}` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600 font-medium">
                    {e.leave_deduction > 0 ? `-₹${e.leave_deduction.toLocaleString()}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">
                    ₹{e.net_adjusted_salary.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
