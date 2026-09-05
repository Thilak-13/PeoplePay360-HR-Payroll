export interface EmployeeSnippet {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string | null;
}

export interface LoanRepayment {
  id: number;
  loan_id: number;
  payslip_id?: number | null;
  installment_number: number;
  amount_paid: string | number;
  payment_date: string;
  balance_after: string | number;
  notes?: string | null;
  created_at: string;
}

export interface EmployeeLoan {
  id: number;
  employee_id: number;
  loan_type: "salary_advance" | "emergency_loan" | "personal_loan" | "equipment_loan";
  principal_amount: string | number;
  interest_rate: string | number;
  tenure_months: number;
  total_repayable: string | number;
  monthly_emi: string | number;
  remaining_balance: string | number;
  status: "draft" | "pending_approval" | "approved" | "active" | "repaid" | "rejected";
  reason?: string | null;
  disbursement_date?: string | null;
  created_at: string;
  updated_at: string;
  employee?: EmployeeSnippet | null;
  repayments?: LoanRepayment[] | null;
}

export interface LoanApplyRequest {
  employee_id: number;
  loan_type: "salary_advance" | "emergency_loan" | "personal_loan" | "equipment_loan";
  principal_amount: number;
  tenure_months: number;
  interest_rate?: number;
  reason?: string;
}

export interface ActiveDeduction {
  employee_id: number;
  active_loan_count: number;
  total_monthly_emi: string | number;
  total_remaining_balance: string | number;
  active_loans: EmployeeLoan[];
}

export interface LoanMetrics {
  total_loans_count: number;
  active_loans_count: number;
  pending_approval_count: number;
  total_disbursed: string | number;
  total_recovered: string | number;
  total_outstanding_balance: string | number;
}
