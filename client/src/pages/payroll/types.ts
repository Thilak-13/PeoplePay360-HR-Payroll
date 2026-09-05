export interface SalaryRule {
  id: number;
  structure_id: number;
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET' | string;
  sequence: number;
  amount_type: 'percentage' | 'fixed' | 'code' | string;
  amount: number;
  percentage_base?: string;
  condition_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalaryStructure {
  id: number;
  name: string;
  code: string;
  parent_id?: number | null;
  created_at?: string;
  updated_at?: string;
  rules?: SalaryRule[];
}

export interface PayslipLine {
  id: number;
  payslip_id: number;
  salary_rule_id?: number;
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET' | string;
  sequence: number;
  rate: number;
  amount: number;
  total: number;
  created_at?: string;
  updated_at?: string;
}

export interface Payslip {
  id: number;
  payrun_id?: number;
  employee_id: number;
  contract_id?: number;
  structure_id?: number;
  date_from: string;
  date_to: string;
  basic_wage: number;
  gross_wage: number;
  net_wage: number;
  total_deductions: number;
  status: 'draft' | 'computed' | 'validated' | 'paid' | 'cancelled' | string;
  has_warning: boolean;
  warning_message?: string | null;
  bank_account?: string | null;
  ifsc_code?: string | null;
  employee_name?: string;
  employee_email?: string;
  job_title?: string;
  department_name?: string;
  created_at?: string;
  updated_at?: string;
  lines?: PayslipLine[];
  structure?: SalaryStructure;
}

export interface Payrun {
  id: number;
  name: string;
  date_start: string;
  date_end: string;
  period_start?: string;
  period_end?: string;
  status: 'draft' | 'computed' | 'validated' | 'paid' | 'cancelled' | string;
  structure_id?: number;
  structure_name?: string;
  total_basic: number;
  total_gross: number;
  total_net: number;
  payslip_count: number;
  warning_count: number;
  created_at?: string;
  updated_at?: string;
  payslips?: Payslip[];
}

export interface EligibleEmployee {
  id?: number;
  name?: string;
  department?: string;
  active_contract_id?: number;
  employee_id: number;
  employee_name: string;
  employee_email: string;
  department_name?: string;
  job_title?: string;
  contract_id: number;
  wage: number;
  contract_type: string;
  contract_start: string;
  contract_end?: string | null;
  has_bank_details: boolean;
  has_warning?: boolean;
  warning_reason?: string | null;
  bank_account?: string;
  ifsc_code?: string;
  warning?: string | null;
}

export interface Step1ValidateRequest {
  name?: string;
  date_start?: string;
  date_end?: string;
  period_start?: string;
  period_end?: string;
  structure_id?: number;
}

export interface Step1ValidateResponse {
  valid: boolean;
  message: string;
  overlapping_payruns: string[];
  eligible_employee_count: number;
  structure_name?: string;
}

export interface ConfirmPayrunWizardData {
  name: string;
  date_start?: string;
  date_end?: string;
  period_start?: string;
  period_end?: string;
  structure_id?: number;
  employee_ids?: number[];
  selected_employee_ids?: number[];
}

export interface StateTransitionRequest {
  target_status: 'draft' | 'computed' | 'validated' | 'paid' | 'cancelled' | string;
}

export interface PayrollMetrics {
  total_payruns: number;
  draft_payruns: number;
  computed_payruns: number;
  validated_payruns: number;
  paid_payruns: number;
  total_paid_ytd: number;
  current_month_net_payout: number;
  pending_warnings: number;
}
