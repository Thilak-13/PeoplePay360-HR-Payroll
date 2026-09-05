import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../../pages/auth/AuthContext';
import { UserRole, DEMO_ACCOUNTS, DemoAccount } from '../../pages/auth/types';

export interface RoleInfo {
  id: UserRole;
  name: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<string, RoleInfo> = {
  admin: {
    id: 'admin',
    name: 'Admin',
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full access across all modules, user management, role assignment, and system administration.',
  },
  super_admin: {
    id: 'admin',
    name: 'Admin',
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full access across all modules, user management, role assignment, and system administration.',
  },
  hr_manager: {
    id: 'hr_manager',
    name: 'HR Manager',
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Full CRUD to Employees, Attendance, Contracts, Schedules, Time Off approval (no payroll).',
  },
  hr_payroll_user: {
    id: 'hr_payroll_user',
    name: 'HR Payroll User',
    badgeColor: 'text-teal-700',
    badgeBg: 'bg-teal-100',
    badgeBorder: 'border-teal-300',
    description: 'HR Manager access + Create/Read/Update Payruns & Payslips; Read-only Salary Structures & Rules.',
  },
  hr_payroll_manager: {
    id: 'hr_payroll_manager',
    name: 'HR Payroll Manager',
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Full CRUD to Payruns, Payslips, Salary Structures, Salary Rules, and HR/payroll configurations.',
  },
  employee: {
    id: 'employee',
    name: 'Employee',
    badgeColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    description: 'View own employee details, attendance, leave balances; clock in/out and submit leave requests.',
  },
  // Legacy aliases
  Admin: {
    id: 'admin',
    name: 'Admin',
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full access across all modules, user management, role assignment, and system administration.',
  },
  'HR Manager': {
    id: 'hr_manager',
    name: 'HR Manager',
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Full CRUD to Employees, Attendance, Contracts, Schedules, Time Off approval (no payroll).',
  },
  payroll_officer: {
    id: 'hr_payroll_user',
    name: 'HR Payroll User',
    badgeColor: 'text-teal-700',
    badgeBg: 'bg-teal-100',
    badgeBorder: 'border-teal-300',
    description: 'HR Manager access + Create/Read/Update Payruns & Payslips; Read-only Salary Structures & Rules.',
  },
  'HR Payroll User': {
    id: 'hr_payroll_user',
    name: 'HR Payroll User',
    badgeColor: 'text-teal-700',
    badgeBg: 'bg-teal-100',
    badgeBorder: 'border-teal-300',
    description: 'HR Manager access + Create/Read/Update Payruns & Payslips; Read-only Salary Structures & Rules.',
  },
  'HR Payroll Manager': {
    id: 'hr_payroll_manager',
    name: 'HR Payroll Manager',
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Full CRUD to Payruns, Payslips, Salary Structures, Salary Rules, and HR/payroll configurations.',
  },
  Employee: {
    id: 'employee',
    name: 'Employee',
    badgeColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    description: 'Self-service portal: view personal payslips, leave balances, and profile info.',
  },
  dept_manager: {
    id: 'hr_manager',
    name: 'HR Manager',
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Full CRUD to Employees, Attendance, Contracts, Schedules, Time Off approval.',
  },
};

interface RoleContextType {
  currentRole: UserRole;
  roleInfo: RoleInfo;
  allRoles: DemoAccount[];
  switchPersona: (role: UserRole) => Promise<void>;
  isAdmin: boolean;
  canManageHR: boolean;
  canManageEmployees: boolean;
  canApproveTimeOff: boolean;
  canAccessPayroll: boolean;
  canRunPayroll: boolean;
  canEditPayrollConfig: boolean;
  canDeletePayruns: boolean;
  canManageUsers: boolean;
  canManageShifts: boolean;
  canApproveLoans: boolean;
  canApproveExpenses: boolean;
  canVerifyTax: boolean;
  isSelfServiceOnly: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, quickDemoLogin } = useAuth();
  const rawRole = (user?.role as string) || 'employee';
  const currentRole: UserRole = (rawRole as UserRole);

  const roleInfo = ROLE_DEFINITIONS[rawRole] || ROLE_DEFINITIONS.employee;

  const switchPersona = async (targetRole: UserRole) => {
    const demo = DEMO_ACCOUNTS.find((d) => d.role === targetRole);
    if (demo) {
      await quickDemoLogin(demo);
    }
  };

  const isAdmin = rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'Admin';
  const isHrPayrollManager = rawRole === 'hr_payroll_manager' || rawRole === 'HR Payroll Manager';
  const isHrPayrollUser = rawRole === 'hr_payroll_user' || rawRole === 'HR Payroll User' || rawRole === 'payroll_officer';
  const isHrManager = rawRole === 'hr_manager' || rawRole === 'HR Manager' || rawRole === 'dept_manager';
  const isEmployeeOnly = rawRole === 'employee' || rawRole === 'Employee';

  // Specific role capabilities
  const canManageHR = isAdmin || isHrPayrollManager || isHrPayrollUser || isHrManager;
  const canApproveTimeOff = canManageHR;
  const canAccessPayroll = isAdmin || isHrPayrollManager || isHrPayrollUser; // HR Manager has NO payroll access!
  const canEditPayrollConfig = isAdmin || isHrPayrollManager; // HR Payroll User is read-only for structures & rules!
  const canDeletePayruns = isAdmin || isHrPayrollManager; // HR Payroll User cannot delete payruns!
  const canManageUsers = isAdmin;

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        roleInfo,
        allRoles: DEMO_ACCOUNTS,
        switchPersona,
        isAdmin,
        canManageHR,
        canManageEmployees: canManageHR,
        canApproveTimeOff,
        canAccessPayroll,
        canRunPayroll: canAccessPayroll,
        canEditPayrollConfig,
        canDeletePayruns,
        canManageUsers,
        canManageShifts: canManageHR,
        canApproveLoans: canAccessPayroll || isHrManager,
        canApproveExpenses: canManageHR,
        canVerifyTax: canAccessPayroll || isHrManager,
        isSelfServiceOnly: isEmployeeOnly,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};


