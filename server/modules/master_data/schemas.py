from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator, computed_field, PrivateAttr


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


class DepartmentRead(BaseModel):
    id: int
    name: str
    code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 2. WORKING SCHEDULE SCHEMAS
# ==========================================

class WorkingScheduleDayBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: str = Field(default="09:00", max_length=5)
    end_time: str = Field(default="18:00", max_length=5)
    break_hours: Decimal = Field(default=Decimal("1.00"), ge=0, le=24)


class WorkingScheduleDayCreate(WorkingScheduleDayBase):
    pass


class WorkingScheduleDayRead(WorkingScheduleDayBase):
    id: int
    schedule_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


WorkingScheduleDayResponse = WorkingScheduleDayRead


class WorkingScheduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    hours_per_week: Optional[Decimal] = Field(default=Decimal("40.00"), ge=0, le=168)


class WorkingScheduleCreate(WorkingScheduleBase):
    days: Optional[List[WorkingScheduleDayCreate]] = None


class WorkingScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    hours_per_week: Optional[Decimal] = Field(None, ge=0, le=168)
    days: Optional[List[WorkingScheduleDayCreate]] = None


class WorkingScheduleResponse(WorkingScheduleBase):
    id: int
    hours_per_week: Decimal
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    days: List[WorkingScheduleDayRead] = []

    model_config = ConfigDict(from_attributes=True)


WorkingScheduleRead = WorkingScheduleResponse


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
    status: str = Field(default="active")


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    wage: Optional[Decimal] = Field(None, ge=0)
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContractRead(ContractResponse):
    pass


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


class LeaveAllocationRead(LeaveAllocationResponse):
    pass


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


class LeaveRequestRead(LeaveRequestResponse):
    pass


class LeaveActionResponse(BaseModel):
    message: str
    leave_request: LeaveRequestResponse
    remaining_allocation_days: Optional[float] = None


# ==========================================
# 6. EMPLOYEE SCHEMAS (Sprint 02)
# ==========================================

class EmployeeBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=3, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=100)
    hire_date: Optional[date] = None
    status: str = Field(default="active")  # 'active', 'inactive', 'on_leave'


class EmployeeCreate(EmployeeBase):
    bank_account_number: Optional[str] = Field(None, max_length=50)
    bank_ifsc: Optional[str] = Field(None, max_length=20)


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[str] = Field(None, min_length=3, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    working_schedule_id: Optional[int] = None
    job_title: Optional[str] = Field(None, max_length=100)
    bank_account_number: Optional[str] = Field(None, max_length=50)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    hire_date: Optional[date] = None
    status: Optional[str] = None


class EmployeeRead(EmployeeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentRead] = None
    working_schedule: Optional[WorkingScheduleResponse] = None

    _raw_bank_account: Optional[str] = PrivateAttr(default=None)

    model_config = ConfigDict(from_attributes=True)

    def __init__(self, **data):
        raw_bank = data.pop("bank_account_number", None)
        super().__init__(**data)
        if raw_bank is not None:
            self._raw_bank_account = raw_bank

    @model_validator(mode="wrap")
    @classmethod
    def _extract_bank_account(cls, data, handler):
        res = handler(data)
        if hasattr(data, "bank_account_number"):
            res._raw_bank_account = getattr(data, "bank_account_number", None)
        elif isinstance(data, dict) and "bank_account_number" in data:
            res._raw_bank_account = data["bank_account_number"]
        return res

    @computed_field
    def masked_account(self) -> Optional[str]:
        if self._raw_bank_account:
            acc_str = str(self._raw_bank_account)
            last4 = acc_str[-4:] if len(acc_str) >= 4 else acc_str
            return f"****{last4}"
        return None


class EmployeeResponse(EmployeeRead):
    pass


class EmployeeSmartStats(BaseModel):
    contracts_count: int = 0
    attendance_count: int = 22
    time_off_count: int = 0
    allocations_count: int = 0


class EmployeeDetail(EmployeeRead):
    contracts_count: int = 0
    attendance_count: int = 22
    time_off_count: int = 0
    allocations_count: int = 0
    contracts: List[ContractResponse] = []
    leave_requests: List[LeaveRequestResponse] = []
    leave_allocations: List[LeaveAllocationResponse] = []

    model_config = ConfigDict(from_attributes=True)


class EmployeeDetailResponse(EmployeeDetail):
    pass
