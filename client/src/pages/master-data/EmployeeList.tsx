import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, UserPlus, SlidersHorizontal } from 'lucide-react';
import { Employee, Department } from './types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useRole } from '../../components/shared/RoleContext';

interface EmployeeListProps {
  onSelectEmployee?: (employeeId: number) => void;
  onAddNewEmployee?: () => void;
}

export type SortCriteria = 'name_asc' | 'name_desc' | 'id_asc' | 'id_desc' | 'dept_asc' | 'status';

export const EmployeeList: React.FC<EmployeeListProps> = ({
  onSelectEmployee,
  onAddNewEmployee,
}) => {
  const { canManageEmployees } = useRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortCriteria>('id_asc');
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
    if (!canManageEmployees) return;
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

  const toggleSort = (field: 'name' | 'id' | 'dept' | 'status') => {
    if (field === 'name') {
      setSortBy((prev) => (prev === 'name_asc' ? 'name_desc' : 'name_asc'));
    } else if (field === 'id') {
      setSortBy((prev) => (prev === 'id_asc' ? 'id_desc' : 'id_asc'));
    } else if (field === 'dept') {
      setSortBy((prev) => (prev === 'dept_asc' ? 'name_asc' : 'dept_asc'));
    } else if (field === 'status') {
      setSortBy((prev) => (prev === 'status' ? 'name_asc' : 'status'));
    }
  };

  const processedEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const cleanIdQuery = query.replace(/^#/, '');

    // 1. Filter
    const filtered = employees.filter((emp) => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(query)) ||
        (emp.department?.name && emp.department.name.toLowerCase().includes(query)) ||
        (emp.phone && emp.phone.toLowerCase().includes(query)) ||
        emp.id.toString() === cleanIdQuery ||
        emp.id.toString().includes(cleanIdQuery);

      const matchesDept =
        selectedDepartment === 'all' ||
        emp.department_id === parseInt(selectedDepartment);

      const matchesStatus =
        selectedStatus === 'all' || emp.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
        case 'id_desc':
          return b.id - a.id;
        case 'id_asc':
          return a.id - b.id;
        case 'dept_asc':
          return (a.department?.name || '').localeCompare(b.department?.name || '');
        case 'status':
          return a.status.localeCompare(b.status);
        case 'name_asc':
        default:
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      }
    });
  }, [employees, searchQuery, selectedDepartment, selectedStatus, sortBy]);

  const getStatusBadge = (status: string) => {
    return <StatusBadge status={status} />;
  };

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      {/* Top Header & Result Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Employee Directory</h1>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold border border-slate-200">
              {processedEmployees.length} {processedEmployees.length === 1 ? 'employee' : 'employees'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Company staff directory, job designations, department placements, and contact details.
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

          {canManageEmployees && (
            <button
              onClick={() => (onAddNewEmployee ? onAddNewEmployee() : setShowCreateModal(true))}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg font-medium text-xs shadow-2xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              New Employee
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search & Sort Bar */}
      <div className="mt-6 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search Bar */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, #ID, email, title, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 shadow-2xs font-medium text-slate-900 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Controls: Sort + Department + Status Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-2 shadow-2xs text-xs text-slate-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortCriteria)}
              className="bg-transparent text-slate-900 font-medium text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="id_asc">ID: Low to High</option>
              <option value="id_desc">ID: High to Low</option>
              <option value="name_asc">Name: A → Z</option>
              <option value="name_desc">Name: Z → A</option>
              <option value="dept_asc">Department: A → Z</option>
              <option value="status">Status (Active first)</option>
            </select>
          </div>

          {/* Department Filter */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 shadow-2xs focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 shadow-2xs focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>

          {(searchQuery || selectedDepartment !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDepartment('all');
                setSelectedStatus('all');
                setSortBy('id_asc');
              }}
              className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium">Loading employee directory...</div>
      ) : processedEmployees.length === 0 ? (
        <div className="mt-8 p-12 bg-white rounded-xl border border-slate-200 text-center">
          <p className="text-slate-600 font-semibold text-sm">No employees match your search criteria.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms, department, or status filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDepartment('all');
              setSelectedStatus('all');
              setSortBy('id_asc');
            }}
            className="mt-4 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Cards View */
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {processedEmployees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => onSelectEmployee && onSelectEmployee(emp.id)}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-2xs flex-shrink-0">
                      {emp.first_name[0]}
                      {emp.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">
                        {emp.first_name} {emp.last_name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{emp.job_title || 'Team Member'}</p>
                    </div>
                  </div>
                  {getStatusBadge(emp.status)}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate font-mono">{emp.email}</span>
                  </div>
                  {emp.department && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="truncate">{emp.department.name}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="truncate font-mono">{emp.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium">
                <span className="hover:text-slate-900">View Profile &rarr;</span>
                <span className="text-slate-400 font-mono">#{emp.id}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="mt-6 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider select-none">
                <th
                  onClick={() => toggleSort('id')}
                  className="py-3 px-4 w-20 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  title="Click to sort by ID"
                >
                  <div className="flex items-center gap-1">
                    <span>#ID</span>
                    {sortBy === 'id_asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-slate-900" />
                    ) : sortBy === 'id_desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-slate-900" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  title="Click to sort by Name"
                >
                  <div className="flex items-center gap-1">
                    <span>Employee</span>
                    {sortBy === 'name_asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-slate-900" />
                    ) : sortBy === 'name_desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-slate-900" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Job Title</th>
                <th
                  onClick={() => toggleSort('dept')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  title="Click to sort by Department"
                >
                  <div className="flex items-center gap-1">
                    <span>Department</span>
                    {sortBy === 'dept_asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-slate-900" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Email &amp; Contact</th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  title="Click to sort by Status"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortBy === 'status' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-slate-900" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {processedEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployee && onSelectEmployee(emp.id)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-500">#{emp.id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-slate-800 text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                      {emp.first_name[0]}
                      {emp.last_name[0]}
                    </div>
                    <span className="truncate">{emp.first_name} {emp.last_name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.job_title || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{emp.department?.name || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono truncate">{emp.email}</td>
                  <td className="py-3 px-4">{getStatusBadge(emp.status)}</td>
                  <td className="py-3 px-4 text-right text-slate-700 font-medium hover:text-slate-900">
                    Profile &rarr;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Employee Modal */}
      {canManageEmployees && showCreateModal && (
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
