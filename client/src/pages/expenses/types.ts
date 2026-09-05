export interface EmployeeSnippet {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string | null;
}

export type ExpenseCategory = "travel" | "food" | "office_supplies" | "client_entertainment" | "training" | "other";

export interface ExpenseClaim {
  id: number;
  employee_id: number;
  category: ExpenseCategory;
  amount: string | number;
  currency: string;
  expense_date: string;
  description: string;
  receipt_url?: string | null;
  status: "draft" | "submitted" | "approved" | "reimbursed" | "rejected";
  approved_by?: number | null;
  approval_date?: string | null;
  reimbursement_date?: string | null;
  payslip_id?: number | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  employee?: EmployeeSnippet | null;
}

export interface ExpenseClaimCreate {
  employee_id: number;
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  expense_date?: string;
  description: string;
  receipt_url?: string;
}

export interface PendingReimbursement {
  employee_id: number;
  approved_claims_count: number;
  total_reimbursement_amount: string | number;
  claims: ExpenseClaim[];
}

export interface ExpenseMetrics {
  total_claims_count: number;
  submitted_count: number;
  approved_count: number;
  reimbursed_count: number;
  total_claimed_amount: string | number;
  total_approved_amount: string | number;
  total_reimbursed_amount: string | number;
}
