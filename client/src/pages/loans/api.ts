import axios from 'axios';
import { EmployeeLoan, LoanRepayment, LoanApplyRequest, ActiveDeduction, LoanMetrics } from './types';

const API_BASE = '/api/v1/loans';

export async function fetchLoans(statusFilter?: string, employeeId?: number): Promise<EmployeeLoan[]> {
  const params: Record<string, string> = {};
  if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
  if (employeeId) params.employee_id = employeeId.toString();
  const res = await axios.get<EmployeeLoan[]>(`${API_BASE}`, { params });
  return res.data;
}

export async function applyForLoan(req: LoanApplyRequest): Promise<EmployeeLoan> {
  const res = await axios.post<EmployeeLoan>(`${API_BASE}/apply`, req);
  return res.data;
}

export async function approveLoan(loanId: number, disbursementDate?: string): Promise<EmployeeLoan> {
  const res = await axios.post<EmployeeLoan>(`${API_BASE}/${loanId}/approve`, { disbursement_date: disbursementDate });
  return res.data;
}

export async function rejectLoan(loanId: number, reason?: string): Promise<EmployeeLoan> {
  const res = await axios.post<EmployeeLoan>(`${API_BASE}/${loanId}/reject`, { reason });
  return res.data;
}

export async function fetchLoanDetail(loanId: number): Promise<EmployeeLoan> {
  const res = await axios.get<EmployeeLoan>(`${API_BASE}/${loanId}`);
  return res.data;
}

export async function fetchActiveDeduction(employeeId: number): Promise<ActiveDeduction> {
  const res = await axios.get<ActiveDeduction>(`${API_BASE}/active-deduction/${employeeId}`);
  return res.data;
}

export async function fetchLoanMetrics(): Promise<LoanMetrics> {
  const res = await axios.get<LoanMetrics>(`${API_BASE}/metrics/summary`);
  return res.data;
}

export async function seedSampleLoans(): Promise<{ status: string; loans_created: number }> {
  const res = await axios.post<{ status: string; loans_created: number }>(`${API_BASE}/seed-sample-loans`);
  return res.data;
}
