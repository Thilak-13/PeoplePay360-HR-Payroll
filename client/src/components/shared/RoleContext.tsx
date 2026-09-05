import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '../../pages/dashboard/types';

export interface RoleInfo {
  role: UserRole;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleInfo> = {
  Admin: {
    role: 'Admin',
    badgeColor: 'text-purple-800',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    description: 'Full system administration, DDL management, and unrestricted cross-domain access.',
  },
  'HR Manager': {
    role: 'HR Manager',
    badgeColor: 'text-blue-800',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    description: 'Employee profiles, contract lifecycle, and leave allocation/approval authority.',
  },
  'HR Payroll User': {
    role: 'HR Payroll User',
    badgeColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    description: 'Payrun batch computation, wizard verification, and draft payslip calculation.',
  },
  'HR Payroll Manager': {
    role: 'HR Payroll Manager',
    badgeColor: 'text-amber-800',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-300',
    description: 'Salary rule configuration, payroll batch validation barrier approval, and payment dispatch.',
  },
  Employee: {
    role: 'Employee',
    badgeColor: 'text-gray-800',
    badgeBg: 'bg-gray-100',
    badgeBorder: 'border-gray-300',
    description: 'Self-service portal: view personal payslips, leave balances, and profile info.',
  },
};

interface RoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  roleInfo: RoleInfo;
  allRoles: UserRole[];
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('Admin');

  const allRoles: UserRole[] = [
    'Admin',
    'HR Manager',
    'HR Payroll User',
    'HR Payroll Manager',
    'Employee',
  ];

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        roleInfo: ROLE_DEFINITIONS[currentRole],
        allRoles,
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
