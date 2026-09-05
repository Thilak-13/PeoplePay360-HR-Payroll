from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator


# ==========================================
# 1. DEPARTMENT SCHEMAS
# ==========================================

class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    manager_id: Optional[int] = None
    parent_id: Optional[int] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    manager_id: Optional[int] = None
    parent_id: Optional[int] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 2. WORKING SCHEDULE SCHEMAS
# ==========================================

class WorkingScheduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    hours_per_week: Decimal = Field(default=Decimal("40.00"), ge=0, le=168)


class WorkingScheduleCreate(WorkingScheduleBase):
    pass


class WorkingScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    hours_per_week: Optional[Decimal] = Field(None, ge=0, le=168)


class WorkingScheduleResponse(WorkingScheduleBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleCalculationRequest(BaseModel):
    hours_per_week: Optional[Decimal] = Field(default=Decimal("40.00"), ge=0, le=168)
    days_per_week: Optional[int] = Field(default=5, ge=1, le=7)
    working_schedule_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


class ScheduleCalculationResponse(BaseModel):
    hours_per_week: float
    hours_per_day: float
    working_days: int
    total_calculated_hours: float
    message: str


# ==========================================
# 3. CONTRACT SCHEMAS
# ==========================================

class ContractBase(BaseModel):
    employee_id: int
    wage: Decimal = Field(..., ge=0)
    contract_type: str = Field(default="full_time")
    start_date: date
    end_date: Optional[date] = None
    status: str = Field(default="draft")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date > self.end_date:
            raise ValueError("Contract start_date must be less than or equal to end_date")
        return self


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    wage: Optional[Decimal] = Field(None, ge=0)
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Contract start_date must be less than or equal to end_date")
        return self


class ContractResponse(ContractBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 4. LEAVE ALLOCATION SCHEMAS
# ==========================================

class LeaveAllocationBase(BaseModel):
    employee_id: int
    holiday_type: str = Field(..., min_length=1)  # 'paid_time_off', 'sick_leave', 'unpaid', 'parental'
    number_of_days: Decimal = Field(..., ge=0)
    year: int = Field(..., ge=2000, le=2100)
    status: str = Field(default="approved")


class LeaveAllocationCreate(LeaveAllocationBase):
    pass


class LeaveAllocationUpdate(BaseModel):
    holiday_type: Optional[str] = None
    number_of_days: Optional[Decimal] = Field(None, ge=0)
    year: Optional[int] = Field(None, ge=2000, le=2100)
    status: Optional[str] = None


class LeaveAllocationResponse(LeaveAllocationBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 5. LEAVE REQUEST SCHEMAS
# ==========================================

class LeaveRequestBase(BaseModel):
    employee_id: int
    holiday_type: str = Field(..., min_length=1)
    date_from: date
    date_to: date
    number_of_days: Optional[Decimal] = None
    status: str = Field(default="draft")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.date_from > self.date_to:
            raise ValueError("Leave request date_from must be less than or equal to date_to")
        return self


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestUpdate(BaseModel):
    holiday_type: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    number_of_days: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("Leave request date_from must be less than or equal to date_to")
        return self


class LeaveRequestResponse(LeaveRequestBase):
    id: int
    number_of_days: Decimal
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LeaveActionResponse(BaseModel):
    message: str
    leave_request: LeaveRequestResponse
    remaining_allocation_days: Optional[float] = None


# ==========================================
# 6. EMPLOYEE SCHEMAS & SMART STATS
# ==========================================

class EmployeeBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=100)
    hire_date: Optional[date] = None
    status: str = Field(default="active")  # 'active', 'inactive', 'on_leave'


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=100)
    hire_date: Optional[date] = None
    status: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentResponse] = None
    working_schedule: Optional[WorkingScheduleResponse] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeSmartStats(BaseModel):
    contracts_count: int = 0
    time_off_count: int = 0
    allocations_count: int = 0


class EmployeeDetailResponse(EmployeeResponse):
    contracts_count: int = 0
    time_off_count: int = 0
    allocations_count: int = 0
    contracts: List[ContractResponse] = []
    leave_requests: List[LeaveRequestResponse] = []
    leave_allocations: List[LeaveAllocationResponse] = []

    model_config = ConfigDict(from_attributes=True)
