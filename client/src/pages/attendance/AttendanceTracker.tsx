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
        text: `Successfully clocked ${punchType.toUpperCase()} at ${new Date().toLocaleTimeString()}! Worked: ${record.worked_hours || 0}h`,
      });
      setNotes("");
      if (onPunchComplete) onPunchComplete(record);
    } catch (err: any) {
      setMsg({ type: "error", text: err.response?.data?.detail || err.message || "Failed to record punch" });
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      const res = await seedSampleAttendance();
      setMsg({ type: "success", text: `Seeded ${res.records_created} today attendance records!` });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100 max-w-xl mx-auto my-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Biometric Clock-In & Punches</h2>
            <p className="text-xs text-slate-400">Live Time & Attendance Punch Terminal</p>
          </div>
        </div>
        <button
          onClick={handleSeed}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Seed Demo
        </button>
      </div>

      {/* Live Digital Clock */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 text-center space-y-1">
        <div className="text-4xl font-black font-mono tracking-wider text-emerald-400">
          {currentTime.toLocaleTimeString()}
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Status Feedback */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            msg.type === "success"
              ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-200"
              : "bg-red-950/80 border border-red-500/50 text-red-200"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Employee ID
            </label>
            <input
              type="number"
              min={1}
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Punch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Remote / Field Visit"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => handlePunch("in")}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Clock In (Punch IN)
          </button>
          <button
            onClick={() => handlePunch("out")}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 transition cursor-pointer"
          >
            <Square className="w-4 h-4" />
            Clock Out (Punch OUT)
          </button>
        </div>
      </div>
    </div>
  );
};
