import {
  Department,
  Employee,
  EmployeeDetail,
  Contract,
  LeaveAllocation,
  LeaveRequest,
  LeaveBalanceItem,
} from './types';

const BASE_URL = '/api/v1/master-data';

export const fetchEmployees = async (params?: {
  search?: string;
  department_id?: number;
  status?: string;
}): Promise<Employee[]> => {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.department_id) query.append('department_id', params.department_id.toString());
  if (params?.status && params.status !== 'all') query.append('status', params.status);

  const url = `${BASE_URL}/employees${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch employees');
  return res.json();
};

export const fetchEmployeeDetail = async (id: number): Promise<EmployeeDetail> => {
  const res = await fetch(`${BASE_URL}/employees/${id}/detail`);
  if (!res.ok) throw new Error(`Failed to fetch employee #${id} details`);
  return res.json();
};

export const createEmployee = async (data: Partial<Employee>): Promise<Employee> => {
  const res = await fetch(`${BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to create employee');
  }
  return res.json();
};

export const createContract = async (data: Partial<Contract>): Promise<Contract> => {
  const res = await fetch(`${BASE_URL}/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to create contract');
  }
  return res.json();
};

export const fetchLeaveBalances = async (
  empId: number,
  year?: number
): Promise<{ employee_id: number; year: number; balances: LeaveBalanceItem[] }> => {
  const url = `${BASE_URL}/leave-allocations/balance/${empId}${year ? `?year=${year}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch leave balances');
  return res.json();
};

export const approveLeave = async (
  id: number
): Promise<{ message: string; leave_request: LeaveRequest; remaining_allocation_days?: number }> => {
  const res = await fetch(`${BASE_URL}/leave-requests/${id}/approve`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to approve leave request');
  }
  return res.json();
};

export const refuseLeave = async (
  id: number
): Promise<{ message: string; leave_request: LeaveRequest }> => {
  const res = await fetch(`${BASE_URL}/leave-requests/${id}/refuse`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to refuse leave request');
  }
  return res.json();
};
