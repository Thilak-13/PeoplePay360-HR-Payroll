export interface EmployeeSnippet {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string | null;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  worked_hours: string | number;
  overtime_hours: string | number;
  status: 'present' | 'absent' | 'half_day' | 'late' | 'on_leave';
  notes?: string | null;
  created_at: string;
  employee?: EmployeeSnippet | null;
}

export interface DailySummary {
  date: string;
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count: number;
  total_hours_worked: number;
  records: AttendanceRecord[];
}

export interface MonthlyAttendanceSummary {
  employee_id: number;
  year: number;
  month: number;
  total_worked_hours: number;
  total_overtime_hours: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  half_days: number;
  records: AttendanceRecord[];
}

export interface UnpaidAbsence {
  employee_id: number;
  start_date: string;
  end_date: string;
  absent_days: number;
  lop_hours: number;
  unpaid_dates: string[];
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_hours: string | number;
  grace_period_mins: number;
  created_at: string;
}

export interface ShiftAssignment {
  id: number;
  employee_id: number;
  shift_id: number;
  start_date: string;
  end_date?: string | null;
  shift?: Shift | null;
  employee?: EmployeeSnippet | null;
}

export interface PunchRequest {
  employee_id: number;
  punch_type: 'in' | 'out';
  timestamp?: string;
  notes?: string;
}
