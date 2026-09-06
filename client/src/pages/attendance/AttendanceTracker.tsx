import React, { useState, useEffect } from "react";
import { Clock, Play, Square, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { recordPunch, seedSampleAttendance } from "./api";
import { AttendanceRecord } from "./types";
import { useAuth } from "../auth/AuthContext";
import { useRole } from "../../components/shared/RoleContext";

interface AttendanceTrackerProps {
  employeeId?: number;
  onPunchComplete?: (record: AttendanceRecord) => void;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  employeeId = 1,
  onPunchComplete,
}) => {
  const { user } = useAuth();
  const { isSelfServiceOnly } = useRole();
  const defaultEmpId = (isSelfServiceOnly && user?.employee_id) ? user.employee_id : (employeeId || user?.employee_id || 1);
  const [selectedEmpId, setSelectedEmpId] = useState<number>(defaultEmpId);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isSelfServiceOnly && user?.employee_id) {
      setSelectedEmpId(user.employee_id);
    }
  }, [user, isSelfServiceOnly]);

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
    <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-2xs space-y-6 text-slate-800 max-w-xl mx-auto my-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/60">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Attendance Clock</h2>
            <p className="text-xs text-slate-500">Record daily check-in and check-out timestamps</p>
          </div>
        </div>
        {!isSelfServiceOnly && (
          <button
            onClick={handleSeed}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Seed Demo
          </button>
        )}
      </div>

      {/* Live Digital Clock */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-5 text-center space-y-0.5">
        <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
          {currentTime.toLocaleTimeString()}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Status Feedback */}
      {msg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2.5 ${
            msg.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium"
              : "bg-rose-50 border border-rose-200 text-rose-800 font-medium"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {isSelfServiceOnly ? "Clocking In As" : "Employee ID"}
            </label>
            {isSelfServiceOnly ? (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono font-medium">
                Employee #{selectedEmpId} ({user?.email})
              </div>
            ) : (
              <input
                type="number"
                min={1}
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Punch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Remote / Field Visit"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handlePunch("in")}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Clock In (Punch IN)
          </button>
          <button
            onClick={() => handlePunch("out")}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Clock Out (Punch OUT)
          </button>
        </div>
      </div>
    </div>
  );
};
