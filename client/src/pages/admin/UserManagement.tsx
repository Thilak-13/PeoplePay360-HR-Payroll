import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  Trash2,
  Plus,
  RefreshCw,
  Key,
  Mail,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Users,
  Clock,
  XCircle,
  Check,
  X,
  MessageSquare
} from 'lucide-react';
import { UserRole, RegistrationRequest } from '../auth/types';
import {
  fetchRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest
} from '../auth/api';

interface SystemUser {
  id: number;
  email: string;
  role: string;
  employee_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const UserManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reject modal state
  const [rejectModalTarget, setRejectModalTarget] = useState<RegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form state for creating new user
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newEmployeeId, setNewEmployeeId] = useState<string>('');

  const token = localStorage.getItem('peoplepay360_token') || sessionStorage.getItem('peoplepay360_token');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to fetch users' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error connecting to server' });
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const data = await fetchRegistrationRequests();
      setRequests(data);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to load registration requests';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    loadRequests();
  }, []);

  const handleRoleChange = async (userId: number, role: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Role updated to ${role} successfully` });
        await fetchUsers();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to update role' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully` });
        await fetchUsers();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to update status' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userEmail}"?`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/v1/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'User deleted successfully' });
        await fetchUsers();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to delete user' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
          employee_id: newEmployeeId ? parseInt(newEmployeeId, 10) : null
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'New user created successfully!' });
        setShowCreateModal(false);
        setNewEmail('');
        setNewPassword('');
        setNewEmployeeId('');
        await fetchUsers();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to create user' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleApproveRequest = async (id: number, email: string) => {
    setActionLoading(id);
    try {
      await approveRegistrationRequest(id);
      setMessage({
        type: 'success',
        text: `Registration approved for ${email}! Account is now active.`
      });
      await loadRequests();
      await fetchUsers();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to approve request';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenRejectModal = (request: RegistrationRequest) => {
    setRejectModalTarget(request);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalTarget) return;
    setActionLoading(rejectModalTarget.id);
    try {
      await rejectRegistrationRequest(rejectModalTarget.id, rejectReason.trim() || undefined);
      setMessage({
        type: 'success',
        text: `Registration request for ${rejectModalTarget.email} rejected.`
      });
      setRejectModalTarget(null);
      await loadRequests();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to reject request';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="bg-purple-100 text-purple-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-400">Super Admin</span>;
      case 'admin':
      case 'Admin':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-200">Admin</span>;
      case 'hr_manager':
      case 'HR Manager':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-200">HR Manager</span>;
      case 'hr_payroll_user':
      case 'payroll_officer':
      case 'HR Payroll User':
        return <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-teal-200">HR Payroll User</span>;
      case 'hr_payroll_manager':
      case 'HR Payroll Manager':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">HR Payroll Manager</span>;
      case 'employee':
      case 'Employee':
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-slate-200">Employee</span>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-500" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" /> Rejected
          </span>
        );
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900">User Management &amp; System Administration</h1>
          </div>
          <p className="text-xs text-slate-500">
            Control platform credentials, manage registration approval workflows, assign RBAC roles, and regulate access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchUsers();
              loadRequests();
            }}
            disabled={loading || requestsLoading}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || requestsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add User Directly
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => {
            setActiveTab('users');
            setSearchTerm('');
          }}
          className={`pb-3 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Active System Users ({users.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('requests');
            setSearchTerm('');
          }}
          className={`pb-3 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer relative ${
            activeTab === 'requests'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Registration Requests
          {pendingRequestsCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
              {pendingRequestsCount} pending
            </span>
          )}
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Total Users</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{users.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-purple-600">Admins</div>
              <div className="text-2xl font-black text-purple-700 mt-1">
                {users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'Admin').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-blue-600">HR Managers</div>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {users.filter(u => u.role === 'hr_manager' || u.role === 'HR Manager').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-teal-600">Payroll Users</div>
              <div className="text-2xl font-black text-teal-700 mt-1">
                {users.filter(u => u.role === 'hr_payroll_user' || u.role === 'payroll_officer').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-emerald-600">Payroll Managers</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {users.filter(u => u.role === 'hr_payroll_manager').length}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search users by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
              <span className="text-slate-400 font-medium">Filter:</span>
              {['all', 'admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'employee'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-lg capitalize font-medium transition cursor-pointer ${
                    roleFilter === r
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r === 'all' ? 'All Roles' : r.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role Assignment</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                        <p>Loading users...</p>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No users found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                              {u.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{u.email}</div>
                              <div className="text-[10px] text-slate-400 font-normal">ID: #{u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getRoleBadge(u.role)}
                            <select
                              value={u.role}
                              disabled={actionLoading === u.id}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:ring-1 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="hr_manager">HR Manager</option>
                              <option value="hr_payroll_user">HR Payroll User</option>
                              <option value="hr_payroll_manager">HR Payroll Manager</option>
                              <option value="employee">Employee</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {u.employee_id ? `#${u.employee_id}` : <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleStatus(u.id, u.is_active)}
                            disabled={actionLoading === u.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                              u.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {u.is_active ? (
                              <>
                                <UserCheck className="w-3 h-3" /> Active
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3" /> Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={actionLoading === u.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Requests Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Total Requests</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{requests.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <div className="text-xs font-medium text-amber-600">Pending Review</div>
              <div className="text-2xl font-black text-amber-700 mt-1">
                {requests.filter((r) => r.status === 'pending').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
              <div className="text-xs font-medium text-emerald-600">Approved</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {requests.filter((r) => r.status === 'approved').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
              <div className="text-xs font-medium text-rose-600">Rejected</div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {requests.filter((r) => r.status === 'rejected').length}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar for Requests */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search requests by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
              <span className="text-slate-400 font-medium">Status Filter:</span>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition cursor-pointer ${
                    requestStatusFilter === st
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All Requests' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Requested Role</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4">Review Status</th>
                    <th className="py-3 px-4">Review Notes / Decision</th>
                    <th className="py-3 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                        <p>Loading registration requests...</p>
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No registration requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                              {req.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{req.full_name}</div>
                              <div className="text-[11px] text-slate-500">{req.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getRoleBadge(req.requested_role)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(req.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {getRequestStatusBadge(req.status)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {req.status === 'rejected' && req.rejection_reason && (
                            <div className="flex items-start gap-1 text-rose-700 bg-rose-50/80 p-1.5 rounded-md border border-rose-100">
                              <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{req.rejection_reason}</span>
                            </div>
                          )}
                          {req.status === 'approved' && req.reviewed_at && (
                            <span className="text-slate-400">
                              Approved on {new Date(req.reviewed_at).toLocaleDateString()}
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="text-slate-400 italic">Awaiting admin decision</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveRequest(req.id, req.email)}
                                disabled={actionLoading === req.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer text-xs disabled:opacity-50"
                                title="Approve and activate user account"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(req)}
                                disabled={actionLoading === req.id}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer text-xs disabled:opacity-50"
                                title="Reject registration request"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Decided</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reject Request Reason Modal */}
      {rejectModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-fade-in">
            <div className="p-5 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h2 className="text-base font-bold text-slate-900">Reject Registration Request</h2>
              </div>
              <button
                onClick={() => setRejectModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                You are about to reject the registration request for{' '}
                <span className="font-bold text-slate-900">{rejectModalTarget.full_name}</span> (
                <span className="font-mono text-purple-700">{rejectModalTarget.email}</span>) requesting the{' '}
                <span className="font-bold">{rejectModalTarget.requested_role}</span> role.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Unverified organizational email, role requested requires manager sign-off..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading === rejectModalTarget.id}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Direct Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-fade-in">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <h2 className="text-base font-bold text-slate-900">Provision New User Account Directly</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@peoplepay360.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign System Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                >
                  <option value="employee">Employee (Self-service only)</option>
                  <option value="hr_manager">HR Manager (Full HR, contracts, time off)</option>
                  <option value="hr_payroll_user">HR Payroll User (HR + Payruns CRUD, read-only structures)</option>
                  <option value="hr_payroll_manager">HR Payroll Manager (Full HR + Payroll CRUD)</option>
                  <option value="admin">Admin (Full system administration)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Linked Employee ID (Optional)
                </label>
                <input
                  type="number"
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Associates this login with an existing employee record for self-service portal access.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;
