export type UserRole = 
  | 'Admin' 
  | 'HR Manager' 
  | 'HR Payroll User' 
  | 'HR Payroll Manager' 
  | 'Employee';

export interface KPIsSummary {
  total_net_paid: number;
  payslip_count: number;
  avg_salary: number;
  approved_leave_days: number;
  total_gross_paid: number;
  active_employees_count: number;
  total_payruns_count: number;
}

export interface DepartmentSpendItem {
  department_id?: number;
  department_name: string;
  department_code?: string;
  employee_count: number;
  total_net: number;
  total_gross: number;
  spend: number;
}

export interface ComplianceAlertItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  employee_id?: number;
  employee_name?: string;
  department_name?: string;
  action_url?: string;
  issue?: string;
}

export interface MonthlyTrendItem {
  month?: string;
  period_start?: string;
  net_wage: number;
  gross_wage?: number;
  payslip_count?: number;
}

export interface DashboardAnalyticsResponse {
  kpis: KPIsSummary;
  department_spend: DepartmentSpendItem[];
  department_costs?: DepartmentSpendItem[];
  monthly_trends?: MonthlyTrendItem[];
  monthly_spend_trend?: MonthlyTrendItem[];
  compliance_alerts: ComplianceAlertItem[];
  attention_items?: ComplianceAlertItem[];
  attention_alerts?: ComplianceAlertItem[];
  total_net_paid?: number;
  total_payslips?: number;
  avg_salary?: number;
  approved_leave_days?: number;
}

export interface DispatchToast {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
}

export interface SendPayslipsResponse {
  success: boolean;
  payrun_id: number;
  dispatched_count: number;
  message: string;
  toast: DispatchToast;
}
