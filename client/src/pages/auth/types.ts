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
    color: "text-purple-400",
    bg: "bg-purple-950/60 border-purple-800/80 hover:border-purple-600",
    description: "Full system administration, DDL management, audit logs, and cross-domain access."
  },
  {
    role: "hr_manager",
    label: "HR Manager",
    email: "hr@peoplepay360.com",
    password: "Hr@12345",
    color: "text-blue-400",
    bg: "bg-blue-950/60 border-blue-800/80 hover:border-blue-600",
    description: "Employee directory, contracts, attendance rosters, leaves, and tax proof verification."
  },
  {
    role: "payroll_officer",
    label: "Payroll Officer",
    email: "payroll@peoplepay360.com",
    password: "Payroll@123",
    color: "text-emerald-400",
    bg: "bg-emerald-950/60 border-emerald-800/80 hover:border-emerald-600",
    description: "Payrun batch computation, wizard verification, salary structures, and payment disbursement."
  },
  {
    role: "dept_manager",
    label: "Dept Manager",
    email: "manager@peoplepay360.com",
    password: "Manager@123",
    color: "text-amber-400",
    bg: "bg-amber-950/60 border-amber-800/80 hover:border-amber-600",
    description: "Team management, leave approvals, and expense claim authorizations."
  },
  {
    role: "employee",
    label: "Employee",
    email: "employee@peoplepay360.com",
    password: "Employee@123",
    color: "text-cyan-400",
    bg: "bg-cyan-950/60 border-cyan-800/80 hover:border-cyan-600",
    description: "Self-service portal: view personal payslips, punch attendance, request loans, and submit claims."
  }
];

