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
