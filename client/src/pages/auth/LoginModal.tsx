import React, { useState } from "react";
import { Lock, Mail, Shield, Key, AlertCircle, CheckCircle2, UserCheck, X } from "lucide-react";
import { loginUser, seedDefaultUsers, setAuthToken, setStoredUser } from "./api";
import { User, UserRole } from "./types";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log in. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoRole: UserRole) => {
    setEmail(demoEmail);
    if (demoRole === "super_admin") setPassword("Admin@123");
    else if (demoRole === "hr_manager") setPassword("Hr@12345");
    else if (demoRole === "payroll_officer") setPassword("Payroll@123");
    else setPassword("Employee@123");
    setError(null);
  };

  const handleSeedUsers = async () => {
    try {
      const res = await seedDefaultUsers();
      setSeedStatus(`Seeded ${res.created_users.length} demo accounts!`);
      setTimeout(() => setSeedStatus(null), 4000);
    } catch (err: any) {
      setError("Failed to seed users: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex justify-between items-start text-white">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-blue-200" />
              <h2 className="text-xl font-bold">PeoplePay360 Authentication</h2>
            </div>
            <p className="text-xs text-blue-100 mt-1">Enterprise Role-Based Access Control</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {seedStatus && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center gap-3 text-emerald-200 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>{seedStatus}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@peoplepay360.com"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="????????????"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Authenticate & Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Fill Demo Roles</span>
              <button
                onClick={handleSeedUsers}
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Seed Demo Accounts
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@peoplepay360.com", "super_admin")}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left flex items-center gap-2 text-slate-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Super Admin</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("hr@peoplepay360.com", "hr_manager")}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left flex items-center gap-2 text-slate-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>HR Manager</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("payroll@peoplepay360.com", "payroll_officer")}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left flex items-center gap-2 text-slate-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Payroll Officer</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("employee@peoplepay360.com", "employee")}
                className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left flex items-center gap-2 text-slate-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Employee</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
