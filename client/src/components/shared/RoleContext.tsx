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
  super_admin: {
    id: 'super_admin',
    name: 'Super Admin',
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full system administration, DDL management, and unrestricted cross-domain access.',
  },
  hr_manager: {
    id: 'hr_manager',
    name: 'HR Manager',
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Employee profiles, contract lifecycle, and leave allocation/approval authority.',
  },
  payroll_officer: {
    id: 'payroll_officer',
    name: 'Payroll Officer',
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Payrun batch computation, wizard verification, and draft payslip calculation.',
  },
  dept_manager: {
    id: 'dept_manager',
    name: 'Dept Manager',
    badgeColor: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-300',
    description: 'Team management, attendance oversight, and expense claim approval.',
  },
  employee: {
    id: 'employee',
    name: 'Employee',
    badgeColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    description: 'Self-service portal: view personal payslips, leave balances, and profile info.',
  },
  // Legacy aliases
  Admin: {
    id: 'super_admin',
    name: 'Super Admin',
    badgeColor: 'text-purple-700',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full system administration, DDL management, and unrestricted cross-domain access.',
  },
  'HR Manager': {
    id: 'hr_manager',
    name: 'HR Manager',
    badgeColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Employee profiles, contract lifecycle, and leave allocation/approval authority.',
  },
  'HR Payroll User': {
    id: 'payroll_officer',
    name: 'Payroll Officer',
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Payrun batch computation, wizard verification, and draft payslip calculation.',
  },
  'HR Payroll Manager': {
    id: 'payroll_officer',
    name: 'Payroll Officer',
    badgeColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Salary rule configuration, payroll batch validation barrier approval, and payment dispatch.',
  },
  Employee: {
    id: 'employee',
    name: 'Employee',
    badgeColor: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    description: 'Self-service portal: view personal payslips, leave balances, and profile info.',
  },
};

interface RoleContextType {
  currentRole: UserRole;
  roleInfo: RoleInfo;
  allRoles: DemoAccount[];
  switchPersona: (role: UserRole) => Promise<void>;
  canManageEmployees: boolean;
  canRunPayroll: boolean;
  canManageShifts: boolean;
  canApproveLoans: boolean;
  canApproveExpenses: boolean;
  canVerifyTax: boolean;
  isSelfServiceOnly: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, quickDemoLogin } = useAuth();
  const currentRole: UserRole = (user?.role as UserRole) || 'employee';

  const roleInfo = ROLE_DEFINITIONS[currentRole] || ROLE_DEFINITIONS.employee;

  const switchPersona = async (targetRole: UserRole) => {
    const demo = DEMO_ACCOUNTS.find((d) => d.role === targetRole);
    if (demo) {
      await quickDemoLogin(demo);
    }
  };

  const isSuperAdmin = currentRole === 'super_admin' || currentRole === 'Admin';
  const isHrManager = currentRole === 'hr_manager' || currentRole === 'HR Manager';
  const isPayrollOfficer = currentRole === 'payroll_officer' || currentRole === 'HR Payroll User' || currentRole === 'HR Payroll Manager';
  const isDeptManager = currentRole === 'dept_manager';
  const isEmployeeOnly = currentRole === 'employee' || currentRole === 'Employee';

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        roleInfo,
        allRoles: DEMO_ACCOUNTS,
        switchPersona,
        canManageEmployees: isSuperAdmin || isHrManager,
        canRunPayroll: isSuperAdmin || isPayrollOfficer,
        canManageShifts: isSuperAdmin || isHrManager,
        canApproveLoans: isSuperAdmin || isPayrollOfficer || isHrManager,
        canApproveExpenses: isSuperAdmin || isHrManager || isDeptManager,
        canVerifyTax: isSuperAdmin || isHrManager || isPayrollOfficer,
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

