import React, { useState, useEffect } from "react";
import { Clock, Plus, Users, RefreshCw } from "lucide-react";
import { fetchShifts, createShift, fetchShiftAssignments, assignShift } from "./api";
import { Shift, ShiftAssignment } from "./types";

export const ShiftManager: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // New Shift Form
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [gracePeriod, setGracePeriod] = useState(15);
  const [breakHours, setBreakHours] = useState(1.0);

  // Assignment Form
  const [selectedEmpId, setSelectedEmpId] = useState(1);
  const [selectedShiftId, setSelectedShiftId] = useState<number>(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shs, asg] = await Promise.all([fetchShifts(), fetchShiftAssignments()]);
      setShifts(shs);
      setAssignments(asg);
      if (shs.length > 0) setSelectedShiftId(shs[0].id);
    } catch (e) {
      // ignore
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
        break_hours: breakHours,
        grace_period_mins: gracePeriod,
      });
      setIsModalOpen(false);
      setName("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignShift({
        employee_id: selectedEmpId,
        shift_id: selectedShiftId,
        start_date: startDate,
      });
      setIsAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Shift Roster & Schedule Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Configure company shifts, grace periods, and employee assignments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Shift</span>
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Assign Shift</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {shifts.map((sh) => (
          <div key={sh.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex justify-between items-start">
              <h2 className="text-base font-bold text-white">{sh.name}</h2>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">
                ID #{sh.id}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Timings:</span>
                <span className="font-mono font-semibold text-white">{sh.start_time} - {sh.end_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Break Duration:</span>
                <span className="font-semibold text-white">{sh.break_hours} hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Late Grace Period:</span>
                <span className="font-semibold text-emerald-400">{sh.grace_period_mins} mins</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Active Shift Assignments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 rounded-l-xl">Employee</th>
                <th className="py-3 px-4">Shift Name</th>
                <th className="py-3 px-4">Timings</th>
                <th className="py-3 px-4">Effective Start Date</th>
                <th className="py-3 px-4 rounded-r-xl">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No shift assignments recorded yet.
                  </td>
                </tr>
              ) : (
                assignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {asg.employee ? ${asg.employee.first_name}  : Employee #}
                    </td>
                    <td className="py-3 px-4 text-blue-400 font-semibold">{asg.shift?.name || Shift #}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {asg.shift ? ${asg.shift.start_time} -  : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{asg.start_date}</td>
                    <td className="py-3 px-4 text-slate-400">{asg.end_date || "Continuous"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Create Working Shift</h2>
            <form onSubmit={handleCreateShift} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase text-slate-400 mb-1">Shift Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Evening Shift (2-11)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase text-slate-400 mb-1">Start Time (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase text-slate-400 mb-1">End Time (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase text-slate-400 mb-1">Grace Period (Mins)</label>
                  <input
                    type="number"
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block uppercase text-slate-400 mb-1">Break Duration (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={breakHours}
                    onChange={(e) => setBreakHours(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 text-white">
            <h2 className="text-lg font-bold">Assign Shift to Employee</h2>
            <form onSubmit={handleAssignShift} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase text-slate-400 mb-1">Employee ID</label>
                <input
                  type="number"
                  required
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block uppercase text-slate-400 mb-1">Select Shift</label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time} - {s.end_time})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block uppercase text-slate-400 mb-1">Effective Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
