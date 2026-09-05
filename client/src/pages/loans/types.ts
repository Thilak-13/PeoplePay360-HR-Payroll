export type LoanType = 'salary_advance' | 'emergency_loan' | 'equipment_loan';

export type LoanStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'repaid'
  | 'rejected';

export interface LoanRepayment {
  id: number;
  loan_id: number;
  payslip_id?: number | null;
  amount_paid: number;
  payment_date: string;
  balance_after: number;
  notes?: string | null;
  created_at?: string;
}

export interface EmployeeLoan {
  id: number;
  employee_id: number;
  employee_name?: string;
  loan_type: LoanType;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  monthly_emi: number;
  remaining_balance: number;
  status: LoanStatus;
  reason?: string | null;
  disbursement_date?: string | null;
  created_at?: string;
  updated_at?: string;
  repayments?: LoanRepayment[];
}

export interface LoanApplyRequest {
  employee_id: number;
  loan_type: LoanType;
  principal_amount: number;
  tenure_months: number;
  interest_rate?: number;
  reason?: string;
}

export interface LoanApproveRequest {
  approver_id?: number;
}

export interface LoanRejectRequest {
  remarks?: string;
}

export interface RecordDeductionRequest {
  loan_id: number;
  amount: number;
  payslip_id?: number;
  payment_date?: string;
  notes?: string;
}

export interface ActiveDeductionResponse {
  loan_id: number | null;
  monthly_emi: number;
  remaining_balance: number;
  loan_type?: LoanType | null;
}

export interface EMIScheduleItem {
  installment_number: number;
  due_date: string;
  emi_amount: number;
  principal_component?: number;
  interest_component?: number;
  balance_after: number;
  is_paid?: boolean;
}

export interface CalculateEMIResponse {
  principal_amount: number;
  tenure_months: number;
  interest_rate: number;
  monthly_emi: number;
  total_payable: number;
  total_interest: number;
  schedule: EMIScheduleItem[];
}

export interface LoansListResponse {
  loans: EmployeeLoan[];
  total_active_loans: number;
  total_disbursed: number;
  total_recovered: number;
  pending_approvals: number;
}
