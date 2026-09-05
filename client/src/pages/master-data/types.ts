export interface Department {
  id: number;
  name: string;
  code?: string;
  manager_id?: number;
  parent_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkingSchedule {
  id: number;
  name: string;
  hours_per_week: number;
  created_at?: string;
  updated_at?: string;
}

export interface Contract {
  id: number;
  employee_id: number;
  wage: number;
  contract_type: 'full_time' | 'part_time' | 'contractor' | 'internship';
  start_date: string;
  end_date?: string | null;
  status: 'draft' | 'active' | 'running' | 'expired' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface LeaveAllocation {
  id: number;
  employee_id: number;
  holiday_type: 'paid_time_off' | 'sick_leave' | 'unpaid' | 'parental' | string;
  number_of_days: number;
  year: number;
  status: 'draft' | 'approved' | 'refused';
  created_at?: string;
  updated_at?: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  holiday_type: 'paid_time_off' | 'sick_leave' | 'unpaid' | 'parental' | string;
  date_from: string;
  date_to: string;
  number_of_days: number;
  status: 'draft' | 'confirm' | 'approved' | 'refused';
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_id?: number;
  working_schedule_id?: number;
  job_title?: string;
  hire_date?: string;
  status: 'active' | 'inactive' | 'on_leave';
  created_at?: string;
  updated_at?: string;
  department?: Department;
  working_schedule?: WorkingSchedule;
}

export interface EmployeeSmartStats {
  contracts_count: number;
  time_off_count: number;
  allocations_count: number;
}

export interface EmployeeDetail extends Employee {
  contracts_count: number;
  time_off_count: number;
  allocations_count: number;
  contracts: Contract[];
  leave_requests: LeaveRequest[];
  leave_allocations: LeaveAllocation[];
}
