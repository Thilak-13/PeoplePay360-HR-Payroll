import React, { useState, useEffect } from "react";
import { User, Shield, Key, History, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { User as UserType, AuditLog } from "./types";
import { changePassword, fetchAuditLogs, getStoredUser } from "./api";

interface UserProfileProps {
  user: UserType | null;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout }) => {
  const currentUser = user || getStoredUser();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const isPrivileged = currentUser?.role === "super_admin" || currentUser?.role === "hr_manager" || currentUser?.role === "payroll_officer";

  useEffect(() => {
    if (isPrivileged) {
      loadAuditLogs();
    }
  }, [currentUser]);

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await fetchAuditLogs(20);
      setLogs(data);
    } catch (e) {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await changePassword({ old_password: oldPassword, new_password: newPassword });
      setMsg({ type: "success", text: res.message });
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold">Super Admin</span>;
      case "hr_manager":
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">HR Manager</span>;
      case "payroll_officer":
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold">Payroll Officer</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-full text-xs font-semibold">Employee</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {currentUser?.email?.substring(0, 2).toUpperCase() || "US"}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{currentUser?.email || "Guest User"}</h1>
              {currentUser && getRoleBadge(currentUser.role)}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Account Status: <span className="text-emerald-400 font-medium">Active & Verified</span> ? ID: #{currentUser?.id || 0}
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
            <div className={p-3 rounded-xl text-sm flex items-center gap-2.5 }>
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
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Roles & Permissions Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2>RBAC Permission Scope</h2>
          </div>
          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center">
              <span>Master Data Directory & Profiles</span>
              <span className="text-emerald-400 font-semibold">Read / Write</span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center">
              <span>Payroll Execution & Locking</span>
              <span className={isPrivileged ? "text-emerald-400 font-semibold" : "text-slate-500 font-semibold"}>
                {isPrivileged ? "Authorized" : "Read-Only"}
              </span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center">
              <span>Executive Analytics & Banking CSV</span>
              <span className={isPrivileged ? "text-emerald-400 font-semibold" : "text-slate-500 font-semibold"}>
                {isPrivileged ? "Authorized" : "Restricted"}
              </span>
            </div>
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center">
              <span>System Audit Trail Logging</span>
              <span className="text-emerald-400 font-semibold">Automated</span>
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
              <RefreshCw className={w-4 h-4 } />
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
