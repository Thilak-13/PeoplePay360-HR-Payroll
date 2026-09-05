import React, { useState, useEffect } from "react";
import { Clock, Play, Square, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { recordPunch, seedSampleAttendance } from "./api";
import { AttendanceRecord } from "./types";

interface AttendanceTrackerProps {
  employeeId?: number;
  onPunchComplete?: (record: AttendanceRecord) => void;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  employeeId = 1,
  onPunchComplete,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<number>(employeeId);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (punchType: "in" | "out") => {
    setMsg(null);
    setLoading(true);
    try {
      const record = await recordPunch({
        employee_id: selectedEmpId,
        punch_type: punchType,
        notes: notes || undefined,
      });
      setLatestRecord(record);
      setMsg({
        type: "success",
        text: Successfully clocked  at ! Worked: h,
      });
      setNotes("");
      if (onPunchComplete) onPunchComplete(record);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to record punch" });
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      const res = await seedSampleAttendance();
      setMsg({ type: "success", text: Seeded  today attendance records! });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100 max-w-xl mx-auto">
      <div className="text-center space-y-1 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center justify-center gap-2 text-blue-400 font-semibold text-xs tracking-wider uppercase">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Live Workforce Time Clock</span>
        </div>
        <div className="text-4xl font-extrabold tracking-tight text-white font-mono">
          {currentTime.toLocaleTimeString()}
        </div>
        <div className="text-xs text-slate-400">
          {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {msg && (
        <div
          className={p-3.5 rounded-xl text-sm flex items-center gap-2.5 }
        >
          {msg.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Employee
        </label>
        <select
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(Number(e.target.value))}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={1}>#1 - John Doe (Principal Engineer)</option>
          <option value={2}>#2 - Sarah Connor (Sales Director)</option>
          <option value={3}>#3 - Alex Murphy (HR Specialist)</option>
          <option value={4}>#4 - Bruce Wayne (CEO)</option>
          <option value={5}>#5 - Clark Kent (Reporter)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
          Punch Note (Optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Remote Punch, Client Visit"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handlePunch("in")}
          disabled={loading}
          className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Clock In</span>
        </button>
        <button
          onClick={() => handlePunch("out")}
          disabled={loading}
          className="py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4 fill-white" />
          <span>Clock Out</span>
        </button>
      </div>

      {latestRecord && (
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 text-xs space-y-1 text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Punch Status:</span>
            <span className="font-semibold text-emerald-400 uppercase">{latestRecord.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Worked Hours:</span>
            <span className="font-semibold text-white">{latestRecord.worked_hours} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Overtime:</span>
            <span className="font-semibold text-amber-400">{latestRecord.overtime_hours} hrs</span>
          </div>
        </div>
      )}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={handleSeed}
          className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center justify-center gap-1 mx-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Seed Today Sample Attendance Records</span>
        </button>
      </div>
    </div>
  );
};
