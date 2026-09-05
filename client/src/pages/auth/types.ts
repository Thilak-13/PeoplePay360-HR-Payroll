export type UserRole = "super_admin" | "hr_manager" | "payroll_officer" | "dept_manager" | "employee";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  employee_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
  employee_id?: number | null;
  is_active?: boolean;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  resource: string;
  ip_address?: string | null;
  details_json?: string | null;
  timestamp: string;
}

export interface DemoAccount {
  role: UserRole;
  label: string;
  email: string;
  password: string;
  color: string;
  bg: string;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    email: "admin@peoplepay360.com",
    password: "Admin@123",
    color: "text-purple-600",
    bg: "bg-purple-50/70 border-purple-200 hover:border-purple-400 hover:bg-purple-50",
    description: "Full system administration, DDL management, audit logs, and cross-domain access."
  },
  {
    role: "hr_manager",
    label: "HR Manager",
    email: "hr@peoplepay360.com",
    password: "Hr@12345",
    color: "text-blue-600",
    bg: "bg-blue-50/70 border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    description: "Employee directory, contracts, attendance rosters, leaves, and tax proof verification."
  },
  {
    role: "payroll_officer",
    label: "Payroll Officer",
    email: "payroll@peoplepay360.com",
    password: "Payroll@123",
    color: "text-emerald-600",
    bg: "bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50",
    description: "Payrun batch computation, wizard verification, salary structures, and payment disbursement."
  },
  {
    role: "dept_manager",
    label: "Dept Manager",
    email: "manager@peoplepay360.com",
    password: "Manager@123",
    color: "text-amber-600",
    bg: "bg-amber-50/70 border-amber-200 hover:border-amber-400 hover:bg-amber-50",
    description: "Team management, leave approvals, and expense claim authorizations."
  },
  {
    role: "employee",
    label: "Employee",
    email: "employee@peoplepay360.com",
    password: "Employee@123",
    color: "text-indigo-600",
    bg: "bg-indigo-50/70 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50",
    description: "Self-service portal: view personal payslips, punch attendance, request loans, and submit claims."
  }
];

