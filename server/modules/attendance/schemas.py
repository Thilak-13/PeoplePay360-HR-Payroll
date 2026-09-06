from datetime import datetime, date
from typing import Optional, List, Literal
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class PunchRequest(BaseModel):
    employee_id: int
    punch_type: Literal["in", "out"]
    timestamp: Optional[datetime] = None
    notes: Optional[str] = None


class EmployeeSnippet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: str
    job_title: Optional[str] = None


class AttendanceRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    worked_hours: Decimal
    overtime_hours: Decimal
    status: str
    notes: Optional[str] = None
    created_at: datetime
    employee: Optional[EmployeeSnippet] = None


class DailySummaryResponse(BaseModel):
    date: date
    total_records: int
    present_count: int
    absent_count: int
    late_count: int
    half_day_count: int
    total_hours_worked: float
    records: List[AttendanceRecordResponse]


class MonthlyAttendanceSummary(BaseModel):
    employee_id: int
    year: int
    month: int
    total_worked_hours: float
    total_overtime_hours: float
    present_days: int
    absent_days: int
    late_days: int
    half_days: int
    records: List[AttendanceRecordResponse]


class UnpaidAbsenceResponse(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    absent_days: float
    lop_hours: float
    unpaid_dates: List[date]


class ShiftCreate(BaseModel):
    name: str
    start_time: str = Field(default="09:00", description="HH:MM format")
    end_time: str = Field(default="18:00", description="HH:MM format")
    break_hours: Decimal = Field(default=Decimal("1.00"))
    grace_period_mins: int = Field(default=15)


class ShiftResponse(ShiftCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ShiftAssignmentCreate(BaseModel):
    employee_id: int
    shift_id: int
    start_date: date = Field(default_factory=date.today)
    end_date: Optional[date] = None


class ShiftAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    shift_id: int
    start_date: date
    end_date: Optional[date] = None
    shift: Optional[ShiftResponse] = None
    employee: Optional[EmployeeSnippet] = None


class WeekBreakdown(BaseModel):
    week_number: int
    date_from: date
    date_to: date
    worked_hours: float
    overtime_hours: float


class EmployeeWeeklyHoursResponse(BaseModel):
    employee_id: int
    employee_name: str
    year: int
    month: int
    weeks: List[WeekBreakdown]
    total_worked_hours: float
    avg_weekly_hours: float
    salary_category: str
    contract_wage: float
    hourly_rate: float
    overtime_bonus: float
    leave_deduction: float
    unpaid_leave_days: int
    net_adjusted_salary: float
