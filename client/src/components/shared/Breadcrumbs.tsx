import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  tab?: string;
  subTab?: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

interface BreadcrumbsProps {
  activeTab: string;
  activeSubTab?: string;
  selectedEmployeeId?: number | null;
  selectedPayrunId?: number | null;
  selectedPayslipId?: number | null;
  onNavigate: (tab: string, subTab?: string) => void;
  onResetEmployee?: () => void;
  onResetPayrun?: () => void;
  onResetPayslip?: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeTab,
  activeSubTab,
  selectedEmployeeId,
  selectedPayrunId,
  selectedPayslipId,
  onNavigate,
  onResetEmployee,
  onResetPayrun,
  onResetPayslip,
}) => {
  const items: BreadcrumbItem[] = [
    {
      label: 'Home',
      tab: 'analytics',
      onClick: () => onNavigate('analytics'),
    },
  ];

  // Map tabs & subtabs to human-readable breadcrumb segments
  switch (activeTab) {
    case 'analytics':
      items.push({ label: 'Dashboard', isCurrent: true });
      break;

    case 'master-data':
      items.push({
        label: 'Workforce',
        onClick: () => {
          onNavigate('master-data', 'employees');
          if (onResetEmployee) onResetEmployee();
        },
      });
      if (activeSubTab === 'employees') {
        items.push({
          label: 'Employees Directory',
          onClick: selectedEmployeeId && onResetEmployee ? () => onResetEmployee() : undefined,
          isCurrent: !selectedEmployeeId,
        });
        if (selectedEmployeeId) {
          items.push({
            label: `Employee #${selectedEmployeeId}`,
            isCurrent: true,
          });
        }
      } else if (activeSubTab === 'contracts') {
        items.push({ label: 'Contracts Manager', isCurrent: true });
      } else if (activeSubTab === 'leaves') {
        items.push({ label: 'Time Off & Leaves', isCurrent: true });
      }
      break;

    case 'attendance':
      items.push({
        label: 'Attendance',
        onClick: () => onNavigate('attendance', 'tracker'),
      });
      if (activeSubTab === 'tracker') {
        items.push({ label: 'Clock-In & Status', isCurrent: true });
      } else if (activeSubTab === 'daily') {
        items.push({ label: 'Daily Punches Matrix', isCurrent: true });
      } else if (activeSubTab === 'shifts') {
        items.push({ label: 'Shift Rosters', isCurrent: true });
      }
      break;

    case 'payroll':
      items.push({
        label: 'Payroll',
        onClick: () => {
          onNavigate('payroll', 'payruns');
          if (onResetPayrun) onResetPayrun();
          if (onResetPayslip) onResetPayslip();
        },
      });
      if (selectedPayslipId) {
        items.push({
          label: 'Payslips',
          onClick: onResetPayslip,
        });
        items.push({
          label: `Payslip #${selectedPayslipId}`,
          isCurrent: true,
        });
      } else if (selectedPayrunId) {
        items.push({
          label: 'Payrun Batches',
          onClick: onResetPayrun,
        });
        items.push({
          label: `Payrun Batch #${selectedPayrunId}`,
          isCurrent: true,
        });
      } else if (activeSubTab === 'structures') {
        items.push({ label: 'Salary Structures & Rules', isCurrent: true });
      } else {
        items.push({ label: 'Payrun Batches', isCurrent: true });
      }
      break;

    case 'user-management':
      items.push({ label: 'Administration' });
      items.push({ label: 'User Management & Roles', isCurrent: true });
      break;

    default:
      items.push({ label: activeTab, isCurrent: true });
  }

  return (
    <nav className="flex items-center space-x-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {!isFirst && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
            {item.isCurrent || !item.onClick ? (
              <span
                className={`truncate ${
                  item.isCurrent
                    ? 'font-semibold text-slate-900'
                    : 'text-slate-500'
                }`}
              >
                {isFirst && <Home className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-indigo-600 transition truncate cursor-pointer font-medium"
              >
                {isFirst && <Home className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
