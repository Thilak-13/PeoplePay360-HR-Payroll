import React, { useState, useEffect } from "react";
import { Users, Calendar, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { fetchDailySummary } from "./api";
import { DailySummary } from "./types";

export const DailyPunches: React.FC = () => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Present</span>;
      case "late":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Late</span>;
      case "half_day":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Half Day</span>;
      case "on_leave":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">On Leave</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Absent</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header & Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Daily Attendance Summary Matrix
          </h1>
          <p className="text-slate-500 text-sm mt-1">Live workforce biometric presence, worked hours, and status tracking.</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={loadSummary}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Employees</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total_employees}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-600">Present</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.present_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-amber-600">Late Arrivals</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{summary.late_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-purple-600">Half Days</span>
            <div className="text-2xl font-bold text-purple-700 mt-1">{summary.half_day_count}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold uppercase text-red-600">Absent / LOP</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{summary.absent_count}</div>
          </div>
        </div>
      )}

      {/* Punches Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Clock In</th>
                <th className="px-6 py-4">Clock Out</th>
                <th className="px-6 py-4">Worked Hours</th>
                <th className="px-6 py-4">Overtime</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!summary || summary.records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No attendance records logged for {selectedDate}.
                  </td>
                </tr>
              ) : (
                summary.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {rec.employee ? `${rec.employee.first_name} ${rec.employee.last_name || ""}` : `Employee #${rec.employee_id}`}
                      </div>
                      <div className="text-xs text-slate-400">{rec.employee?.email || `ID: ${rec.employee_id}`}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-800">
                      {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString() : "--:--"}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-800">
                      {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString() : "--:--"}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{rec.worked_hours || 0} hrs</td>
                    <td className="px-6 py-4 text-emerald-600 font-medium">{rec.overtime_hours > 0 ? `+${rec.overtime_hours} hrs` : "0 hrs"}</td>
                    <td className="px-6 py-4">{getStatusBadge(rec.status)}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{rec.shift?.name || "Standard (9-5)"}</td>
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
