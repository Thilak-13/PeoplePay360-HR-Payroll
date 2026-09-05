import React, { useState, useEffect } from "react";
import { Calendar, Users, Clock, RefreshCw } from "lucide-react";
import { fetchDailySummary } from "./api";
import { DailySummary } from "./types";

export const DailyPunches: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary(selectedDate);
  }, [selectedDate]);

  const loadSummary = async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailySummary(d);
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load daily attendance");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">Present</span>;
      case "late":
        return <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold">Late</span>;
      case "half_day":
        return <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold">Half Day</span>;
      case "absent":
        return <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs font-semibold">Absent</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Daily Workforce Attendance Register</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time daily clock punches, shifts, and worked hours</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => loadSummary(selectedDate)}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={w-4 h-4 } />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs text-slate-400 font-medium">Total Logged</span>
          <div className="text-2xl font-bold text-white mt-1">{summary?.total_records || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs text-emerald-400 font-medium">Present</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{summary?.present_count || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs text-amber-400 font-medium">Late In</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{summary?.late_count || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs text-purple-400 font-medium">Half Day</span>
          <div className="text-2xl font-bold text-purple-400 mt-1">{summary?.half_day_count || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg col-span-2 md:col-span-1">
          <span className="text-xs text-blue-400 font-medium">Total Worked Hrs</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{summary?.total_hours_worked || 0}h</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Punch Records for {selectedDate}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 rounded-l-xl">Employee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Worked Hours</th>
                <th className="py-3 px-4">Overtime</th>
                <th className="py-3 px-4 rounded-r-xl">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!summary || summary.records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No attendance records logged for this date.
                  </td>
                </tr>
              ) : (
                summary.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {rec.employee ? ${rec.employee.first_name}  : Employee #}
                      </div>
                      <div className="text-slate-400 text-[11px]">{rec.employee?.job_title || ID: }</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(rec.status)}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{rec.worked_hours}h</td>
                    <td className="py-3 px-4 font-semibold text-amber-400">
                      {Number(rec.overtime_hours) > 0 ? +h : "0h"}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{rec.notes || "-"}</td>
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
