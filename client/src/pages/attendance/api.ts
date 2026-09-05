import { AttendanceRecord, DailySummary, MonthlyAttendanceSummary, UnpaidAbsence, Shift, ShiftAssignment, PunchRequest } from './types';

const API_BASE = '/api/v1/attendance';

export async function recordPunch(req: PunchRequest): Promise<AttendanceRecord> {
  const res = await fetch(${API_BASE}/punch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Punch failed' }));
    throw new Error(err.detail || 'Failed to record punch');
  }
  return res.json();
}

export async function fetchDailySummary(date?: string): Promise<DailySummary> {
  const url = date ? ${API_BASE}/daily-summary?date= : ${API_BASE}/daily-summary;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch daily attendance summary');
  }
  return res.json();
}

export async function fetchEmployeeMonthly(employeeId: number, year?: number, month?: number): Promise<MonthlyAttendanceSummary> {
  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  if (month) params.append('month', month.toString());
  const res = await fetch(${API_BASE}/employee//monthly?);
  if (!res.ok) {
    throw new Error('Failed to fetch monthly attendance details');
  }
  return res.json();
}

export async function fetchUnpaidAbsences(employeeId: number, startDate: string, endDate: string): Promise<UnpaidAbsence> {
  const res = await fetch(${API_BASE}/unpaid-absences/?start_date=&end_date=);
  if (!res.ok) {
    throw new Error('Failed to fetch unpaid absences');
  }
  return res.json();
}

export async function fetchShifts(): Promise<Shift[]> {
  const res = await fetch(${API_BASE}/shifts);
  if (!res.ok) {
    throw new Error('Failed to fetch shifts');
  }
  return res.json();
}

export async function createShift(shift: Omit<Shift, 'id' | 'created_at'>): Promise<Shift> {
  const res = await fetch(${API_BASE}/shifts, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shift),
  });
  if (!res.ok) {
    throw new Error('Failed to create shift');
  }
  return res.json();
}

export async function fetchShiftAssignments(employeeId?: number): Promise<ShiftAssignment[]> {
  const url = employeeId ? ${API_BASE}/shift-assignments?employee_id= : ${API_BASE}/shift-assignments;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch shift assignments');
  }
  return res.json();
}

export async function assignShift(assignment: { employee_id: number; shift_id: number; start_date: string; end_date?: string }): Promise<ShiftAssignment> {
  const res = await fetch(${API_BASE}/shift-assignments, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignment),
  });
  if (!res.ok) {
    throw new Error('Failed to assign shift');
  }
  return res.json();
}

export async function seedSampleAttendance(): Promise<{ status: string; records_created: number }> {
  const res = await fetch(${API_BASE}/seed-sample-records, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to seed sample attendance');
  }
  return res.json();
}
