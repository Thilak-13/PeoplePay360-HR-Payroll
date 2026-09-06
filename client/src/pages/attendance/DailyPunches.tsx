import React, { useState, useEffect } from "react";
import { Users, Calendar, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { fetchDailySummary } from "./api";
import { DailySummary } from "./types";
import { useAuth } from "../auth/AuthContext";
import { useRole } from "../../components/shared/RoleContext";
import { StatusBadge } from "../../components/shared/StatusBadge";

export const DailyPunches: React.FC = () => {
  const { user } = useAuth();
  const { isSelfServiceOnly } = useRole();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [selectedDate]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await fetchDailySummary(selectedDate);
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const userEmpId = user?.employee_id || 1;
  const filteredRecords = summary?.records
    ? isSelfServiceOnly
      ? summary.records.filter((r) => r.employee_id === userEmpId)
      : summary.records
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header & Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/60">
              <Users className="w-4 h-4" />
            </div>
            {isSelfServiceOnly ? "My Attendance Records" : "Daily Attendance Summary"}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isSelfServiceOnly
              ? "Your attendance clock times, daily hours worked, and status."
              : "Workforce attendance presence, worked hours, and status tracking."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono text-slate-800 outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
          />
          <button
            onClick={loadSummary}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row (Managers/Admins only) */}
      {summary && !isSelfServiceOnly && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Employees</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.total_employees}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Present</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.present_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Late Arrivals</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.late_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Half Days</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.half_day_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Absent / LOP</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.absent_count}</div>
          </div>
        </div>
      )}

      {/* Punches Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-semibold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Worked Hours</th>
                <th className="px-4 py-3">Overtime</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No attendance records logged for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {rec.employee ? `${rec.employee.first_name} ${rec.employee.last_name || ""}` : `Employee #${rec.employee_id}`}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">{rec.employee?.email || `ID: ${rec.employee_id}`}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString() : "--:--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString() : "--:--"}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{rec.worked_hours || 0} hrs</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{rec.overtime_hours > 0 ? `+${rec.overtime_hours} hrs` : "0 hrs"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{rec.shift?.name || "Standard (9-5)"}</td>
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
