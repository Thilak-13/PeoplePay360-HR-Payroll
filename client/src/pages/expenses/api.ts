import axios from "axios";
import { ExpenseClaim, ExpenseClaimCreate, PendingReimbursement, ExpenseMetrics } from "./types";

const API_BASE = "/api/v1/expenses";

export async function fetchExpenses(statusFilter?: string, categoryFilter?: string, employeeId?: number): Promise<ExpenseClaim[]> {
  const params: Record<string, string> = {};
  if (statusFilter && statusFilter !== "all") params.status = statusFilter;
  if (categoryFilter && categoryFilter !== "all") params.category = categoryFilter;
  if (employeeId) params.employee_id = employeeId.toString();
  const res = await axios.get<ExpenseClaim[]>(`${API_BASE}`, { params });
  return res.data;
}

export async function submitExpenseClaim(req: ExpenseClaimCreate): Promise<ExpenseClaim> {
  const res = await axios.post<ExpenseClaim>(`${API_BASE}/submit`, req);
  return res.data;
}

export async function approveExpenseClaim(claimId: number, approverId?: number): Promise<ExpenseClaim> {
  const res = await axios.post<ExpenseClaim>(`${API_BASE}/${claimId}/approve`, { approved_by: approverId });
  return res.data;
}

export async function rejectExpenseClaim(claimId: number, reason?: string): Promise<ExpenseClaim> {
  const res = await axios.post<ExpenseClaim>(`${API_BASE}/${claimId}/reject`, { reason });
  return res.data;
}

export async function fetchPendingReimbursements(employeeId: number): Promise<PendingReimbursement> {
  const res = await axios.get<PendingReimbursement>(`${API_BASE}/pending-reimbursements/${employeeId}`);
  return res.data;
}

export async function fetchExpenseMetrics(): Promise<ExpenseMetrics> {
  const res = await axios.get<ExpenseMetrics>(`${API_BASE}/metrics/summary`);
  return res.data;
}

export async function seedSampleExpenses(): Promise<{ status: string; expenses_created: number }> {
  const res = await axios.post<{ status: string; expenses_created: number }>(`${API_BASE}/seed-sample-expenses`);
  return res.data;
}
