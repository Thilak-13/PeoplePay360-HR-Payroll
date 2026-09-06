export type UserRole =
  | "admin"
  | "super_admin"
  | "hr_manager"
  | "hr_payroll_user"
  | "hr_payroll_manager"
  | "employee"
  | "payroll_officer"
  | "dept_manager"
  | "Admin"
  | "HR Manager"
  | "HR Payroll User"
  | "HR Payroll Manager"
  | "Employee";

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

export interface SignupRequest {
  full_name: string;
  email: string;
  password: string;
  requested_role: string;
}

export interface RegistrationRequest {
  id: number;
  full_name: string;
  email: string;
  requested_role: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
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
  userName?: string;
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
    userName: "Vishaal M (Super Admin)",
    email: "vishaal.m12@gmail.com",
    password: "Admin@123",
    color: "text-purple-700",
    bg: "bg-purple-100/70 border-purple-300 hover:border-purple-500 hover:bg-purple-100",
    description: "Sole Super Admin identity with exclusive authority over system security, user provisioning, registration approvals, and audit logs."
  },
  {
    role: "admin",
    label: "Admin",
    userName: "Aditya Raman",
    email: "admin@peoplepay360.com",
    password: "Admin@123",
    color: "text-purple-600",
    bg: "bg-purple-50/70 border-purple-200 hover:border-purple-400 hover:bg-purple-50",
    description: "Full access to all modules and models across the platform. User management, role assignment, permission updates, and complete system administration."
  },
  {
    role: "hr_manager",
    label: "HR Manager",
    userName: "Priya Sundaram",
    email: "hr@peoplepay360.com",
    password: "Hr@12345",
    color: "text-blue-600",
    bg: "bg-blue-50/70 border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    description: "Full CRUD access to Employees, Attendance, Contracts, Schedules, Time Off approval (no payroll)."
  },
  {
    role: "hr_payroll_user",
    label: "HR Payroll User",
    userName: "Karthik Subramanian",
    email: "payrolluser@peoplepay360.com",
    password: "PayrollUser@123",
    color: "text-teal-600",
    bg: "bg-teal-50/70 border-teal-200 hover:border-teal-400 hover:bg-teal-50",
    description: "HR Manager access + Create/Read/Update Payruns & Payslips; Read-only Salary Structures & Rules."
  },
  {
    role: "hr_payroll_manager",
    label: "HR Payroll Manager",
    userName: "Thilak I",
    email: "payrollmanager@peoplepay360.com",
    password: "PayrollMgr@123",
    color: "text-emerald-600",
    bg: "bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50",
    description: "Full CRUD access to Payruns, Payslips, Salary Structures, Salary Rules, and HR/payroll configurations."
  },
  {
    role: "employee",
    label: "Employee",
    userName: "Ananya Krishnan",
    email: "employee@peoplepay360.com",
    password: "Employee@123",
    color: "text-indigo-600",
    bg: "bg-indigo-50/70 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50",
    description: "View own profile, attendance, leave balances; clock in/out and submit leave requests."
  }
];

