import React, { useState, useEffect } from "react";
import { Calendar, Plus, Users, Clock, Check, RefreshCw } from "lucide-react";
import { fetchShifts, createShift, fetchShiftAssignments, assignShift } from "./api";
import { Shift, ShiftAssignment } from "./types";

export const ShiftManager: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // New Shift form state
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00:00");
  const [endTime, setEndTime] = useState("17:00:00");
  const [gracePeriod, setGracePeriod] = useState(15);

  // Assign state
  const [assignEmpId, setAssignEmpId] = useState(1);
  const [assignShiftId, setAssignShiftId] = useState(1);
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, aData] = await Promise.all([fetchShifts(), fetchShiftAssignments()]);
      setShifts(sData);
      setAssignments(aData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createShift({
        name,
        start_time: startTime,
        end_time: endTime,
        grace_period_mins: gracePeriod,
      });
      setName("");
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to create shift");
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignShift({
        employee_id: assignEmpId,
        shift_id: assignShiftId,
        start_date: assignStartDate,
      });
      alert("Shift assigned successfully!");
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to assign shift");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-indigo-600" />
            Shift Roster & Workforce Assignment
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configure company shifts, grace periods, and employee roster schedules.</p>
        </div>
        <button
          onClick={loadData}
          className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Shift Form */}
        <form onSubmit={handleCreateShift} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" /> Add New Shift
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Night Shift (10 PM - 6 AM)"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="09:00:00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="17:00:00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Grace Mins</label>
              <input
                type="number"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            Create Shift
          </button>
        </form>

        {/* Assign Shift Form */}
        <form onSubmit={handleAssignShift} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" /> Assign Shift to Employee
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
              <input
                type="number"
                min={1}
                value={assignEmpId}
                onChange={(e) => setAssignEmpId(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shift</label>
              <select
                value={assignShiftId}
                onChange={(e) => setAssignShiftId(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time} - {s.end_time})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Start Date</label>
            <input
              type="date"
              value={assignStartDate}
              onChange={(e) => setAssignStartDate(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            Assign Shift Roster
          </button>
        </form>
      </div>
    </div>
  );
};
