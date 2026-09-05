import React, { useState, useEffect } from 'react';
import { Employee, Department } from './types';
import { StatusBadge } from '../../components/shared/StatusBadge';

interface EmployeeListProps {
  onSelectEmployee?: (employeeId: number) => void;
  onAddNewEmployee?: () => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  onSelectEmployee,
  onAddNewEmployee,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Employee Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department_id: '',
    status: 'active',
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/master-data/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/master-data/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined,
      };
      const res = await fetch('/api/v1/master-data/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          job_title: '',
          department_id: '',
          status: 'active',
        });
        fetchEmployees();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.detail || 'Failed to create employee'}`);
      }
    } catch (err) {
      console.error('Failed to create employee', err);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.job_title && emp.job_title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept =
      selectedDepartment === 'all' ||
      emp.department_id === parseInt(selectedDepartment);

    const matchesStatus =
      selectedStatus === 'all' || emp.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    return <StatusBadge status={status} />;
  };

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      {/* Top Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Master Data — Employees</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organization directory, employee contracts, working schedules &amp; leave allocations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* View Toggle */}
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Cards
              </span>
            </button>
          </div>

          <button
            onClick={() => (onAddNewEmployee ? onAddNewEmployee() : setShowCreateModal(true))}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg font-medium text-xs shadow-2xs transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Employee
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <svg
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium">Loading employee directory...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="mt-8 p-12 bg-white rounded-xl border border-slate-200 text-center">
          <p className="text-slate-500 font-medium">No employees match your search criteria.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDepartment('all');
              setSelectedStatus('all');
            }}
            className="mt-3 text-sm text-indigo-600 font-semibold hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => onSelectEmployee && onSelectEmployee(emp.id)}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-base shadow-sm">
                      {emp.first_name[0]}
                      {emp.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base leading-snug">
                        {emp.first_name} {emp.last_name}
                      </h3>
                      <p className="text-xs text-slate-500">{emp.job_title || 'Employee'}</p>
                    </div>
                  </div>
                  {getStatusBadge(emp.status)}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{emp.email}</span>
                  </div>
                  {emp.department && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{emp.department.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium">
                <span>View Profile &rarr;</span>
                <span className="text-slate-400 font-normal">#{emp.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Job Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployee && onSelectEmployee(emp.id)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs font-medium">
                      {emp.first_name[0]}
                      {emp.last_name[0]}
                    </div>
                    <span>{emp.first_name} {emp.last_name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{emp.job_title || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{emp.department?.name || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs font-mono">{emp.email}</td>
                  <td className="py-3 px-4">{getStatusBadge(emp.status)}</td>
                  <td className="py-3 px-4 text-right text-slate-700 font-medium text-xs hover:text-slate-900">
                    Detail &rarr;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Add New Employee</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-400 focus:outline-none bg-white"
                >
                  <option value="">Select Department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs cursor-pointer"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
