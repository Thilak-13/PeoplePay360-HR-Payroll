import axios from 'axios';
import { AttendanceRecord, DailySummary, MonthlyAttendanceSummary, UnpaidAbsence, Shift, ShiftAssignment, PunchRequest, EmployeeWeeklyHours } from './types';

const API_BASE = '/api/v1/attendance';

export async function recordPunch(req: PunchRequest): Promise<AttendanceRecord> {
  const res = await axios.post<AttendanceRecord>(`${API_BASE}/punch`, req);
  return res.data;
}

export async function fetchDailySummary(date?: string): Promise<DailySummary> {
  const params: Record<string, string> = {};
  if (date) params.date = date;
  const res = await axios.get<DailySummary>(`${API_BASE}/daily-summary`, { params });
  return res.data;
}

export async function fetchEmployeeMonthly(employeeId: number, year?: number, month?: number): Promise<MonthlyAttendanceSummary> {
  const params: Record<string, number> = {};
  if (year) params.year = year;
  if (month) params.month = month;
  const res = await axios.get<MonthlyAttendanceSummary>(`${API_BASE}/employee/${employeeId}/monthly`, { params });
  return res.data;
}

export async function fetchUnpaidAbsences(employeeId: number, startDate: string, endDate: string): Promise<UnpaidAbsence> {
  const res = await axios.get<UnpaidAbsence>(`${API_BASE}/unpaid-absences/${employeeId}`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
}

export async function fetchShifts(): Promise<Shift[]> {
  const res = await axios.get<Shift[]>(`${API_BASE}/shifts`);
  return res.data;
}

export async function createShift(shift: Omit<Shift, 'id' | 'created_at'>): Promise<Shift> {
  const res = await axios.post<Shift>(`${API_BASE}/shifts`, shift);
  return res.data;
}

export async function fetchShiftAssignments(employeeId?: number): Promise<ShiftAssignment[]> {
  const params: Record<string, number> = {};
  if (employeeId) params.employee_id = employeeId;
  const res = await axios.get<ShiftAssignment[]>(`${API_BASE}/shift-assignments`, { params });
  return res.data;
}

export async function assignShift(assignment: { employee_id: number; shift_id: number; start_date: string; end_date?: string }): Promise<ShiftAssignment> {
  const res = await axios.post<ShiftAssignment>(`${API_BASE}/shift-assignments`, assignment);
  return res.data;
}

export async function seedSampleAttendance(): Promise<{ status: string; records_created: number }> {
  const res = await axios.post<{ status: string; records_created: number }>(`${API_BASE}/seed-sample-records`);
  return res.data;
}

export async function fetchWeeklyHours(employeeId?: number, year?: number, month?: number): Promise<EmployeeWeeklyHours[]> {
  const params: Record<string, number> = {};
  if (employeeId) params.employee_id = employeeId;
  if (year) params.year = year;
  if (month) params.month = month;
  const res = await axios.get<EmployeeWeeklyHours[]>(`${API_BASE}/weekly-hours`, { params });
  return res.data;
}
