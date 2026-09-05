import React, { useState } from "react";
import { Lock, Mail, Shield, Key, AlertCircle, Sparkles, Building2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { DEMO_ACCOUNTS, DemoAccount } from "./types";

export const LoginScreen: React.FC = () => {
  const { login, quickDemoLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to log in. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (account: DemoAccount) => {
    setError(null);
    setActiveDemo(account.role);
    setLoading(true);
    try {
      setEmail(account.email);
      setPassword(account.password);
      await quickDemoLogin(account);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || `Failed to sign in as ${account.label}.`);
    } finally {
      setLoading(false);
      setActiveDemo(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 font-sans">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white shadow-sm mb-2">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to PeoplePay<span className="text-indigo-600">360</span>
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            HR, Payroll & Statutory Compliance Workspace
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Real Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && !activeDemo ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Role Logins */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Quick Demo Access
              </span>
              <span className="text-[11px] text-slate-400">Select a role to test</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const isThisActive = activeDemo === account.role;
                return (
                  <button
                    key={account.role}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoClick(account)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      account.bg
                    } ${isThisActive ? "ring-2 ring-indigo-500" : ""}`}
                  >
                    <div className="mt-0.5">
                      <Shield className={`w-3.5 h-3.5 ${account.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">{account.label}</span>
                        {isThisActive && (
                          <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{account.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Role-Based Access Control & Secure JWT Authentication
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
