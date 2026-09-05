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
    <div className="max-w-4xl mx-auto space-y-6 text-slate-900 p-2">
      {/* Profile Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {currentUser?.email ? currentUser.email[0].toUpperCase() : "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{currentUser?.email || "User Account"}</h1>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold uppercase">
                {currentUser?.role?.replace('_', ' ') || "Employee"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Account Status: <span className="text-emerald-600 font-medium">Active</span> • ID: #{currentUser?.id || 0}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security & Password */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Key className="w-4 h-4 text-indigo-600" />
            <h2>Update Password</h2>
          </div>

          {msg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                msg.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {msg.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              {loading ? "Updating..." : "Save Password"}
            </button>
          </form>
        </div>

        {/* Roles & Permissions Reference */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Shield className="w-4 h-4 text-indigo-600" />
            <h2>Access & Permissions</h2>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="font-semibold text-slate-900 block mb-0.5">Assigned Scope:</span>
              <p className="text-slate-600">
                {currentUser?.role === "super_admin"
                  ? "Full administrative control across Master Data, Attendance, Payroll, Loans, Expenses, Taxes, and RBAC."
                  : currentUser?.role === "hr_manager"
                  ? "Full access to Employee Master Data, Contracts, Attendance Rosters, Leaves, and Expense Approvals."
                  : currentUser?.role === "payroll_officer"
                  ? "Access to Salary Structures, Payruns, Payslips, Loan EMI Schedules, and Tax Computations."
                  : "Self-service access to personal Attendance Punches, Leave Requests, Loan Applications, and Payslip PDFs."}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="font-semibold text-slate-900 block mb-0.5">Session Details:</span>
              <p className="text-slate-600">
                JWT bearer authentication with secure token renewal and encrypted password storage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {isPrivileged && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <History className="w-4 h-4 text-indigo-600" />
              <h2>System Audit Log (Recent Events)</h2>
            </div>
            <button
              onClick={loadAuditLogs}
              disabled={logsLoading}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2 px-3 rounded-l-lg">Timestamp</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Resource</th>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">IP</th>
                  <th className="py-2 px-3 rounded-r-lg">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-3 text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{log.action}</td>
                      <td className="py-2 px-3 text-indigo-600">{log.resource}</td>
                      <td className="py-2 px-3 text-slate-600">#{log.user_id || "System"}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{log.ip_address || "-"}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-xs">{log.details_json || "-"}</td>
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
