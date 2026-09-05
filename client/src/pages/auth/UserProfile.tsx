import React, { useState, useEffect } from "react";
import { User as UserIcon, Shield, Key, History, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { fetchCurrentUser, changePassword, fetchAuditLogs, clearAuthToken } from "./api";
import { User, AuditLog } from "./types";

interface UserProfileProps {
  user?: User | null;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user: initialUser, onLogout }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser || null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Audit Logs for Admin/Manager
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const u = await fetchCurrentUser();
      setCurrentUser(u);
      if (u.role === "super_admin" || u.role === "hr_manager") {
        loadAuditLogs();
      }
    } catch {
      // ignore
    }
  };

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await fetchAuditLogs(20);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword({ old_password: oldPassword, new_password: newPassword });
      setMsg({ type: "success", text: res.message || "Password updated successfully" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMsg({ type: "error", text: err.response?.data?.detail || err.message || "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  const isPrivileged = currentUser?.role === "super_admin" || currentUser?.role === "hr_manager";

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-slate-100 p-4">
      {/* Profile Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {currentUser?.email ? currentUser.email[0].toUpperCase() : "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{currentUser?.email || "User Account"}</h1>
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold uppercase">
                {currentUser?.role || "Employee"}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Account Status: <span className="text-emerald-400 font-medium">Active & Verified</span> • ID: #{currentUser?.id || 0}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security & Password */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Key className="w-5 h-5 text-blue-400" />
            <h2>Security & Password Update</h2>
          </div>

          {msg && (
            <div
              className={`p-3 rounded-xl text-sm flex items-center gap-2.5 ${
                msg.type === "success"
                  ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-200"
                  : "bg-red-950/80 border border-red-500/50 text-red-200"
              }`}
            >
              {msg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-lg"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Roles & Permissions Reference */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2>Assigned Permissions Matrix</h2>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <span className="font-semibold text-white block mb-0.5">Domain Access:</span>
              <p className="text-slate-400">
                {currentUser?.role === "super_admin"
                  ? "Full read/write access across all modules: Master Data, Attendance, Payroll, Loans, Expenses, Taxes, Notifications, and System RBAC."
                  : currentUser?.role === "hr_manager"
                  ? "Full access to Employee Master Data, Contracts, Attendance Rosters, Leaves, Tax Declarations, and Expense Approvals."
                  : currentUser?.role === "payroll_officer"
                  ? "Access to Salary Structures, Payruns, Payslips, Loan EMI Schedules, and Tax Computations."
                  : "Self-service access to personal Attendance Punches, Leave Requests, Loan Applications, Expense Claims, and Payslip PDFs."}
              </p>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <span className="font-semibold text-white block mb-0.5">Session Security:</span>
              <p className="text-slate-400">
                JWT Auth token bearer authentication with 24-hour expiration and cryptographic bcrypt password hashing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {isPrivileged && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-semibold">
              <History className="w-5 h-5 text-purple-400" />
              <h2>System Audit Trail (Latest 20 Events)</h2>
            </div>
            <button
              onClick={loadAuditLogs}
              disabled={logsLoading}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Resource</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-3 font-semibold text-white">{log.action}</td>
                      <td className="py-2 px-3 text-blue-400">{log.resource}</td>
                      <td className="py-2 px-3 text-slate-400">#{log.user_id || "System"}</td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{log.ip_address || "-"}</td>
                      <td className="py-2 px-3 text-slate-400 font-mono truncate max-w-xs">{log.details_json || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
