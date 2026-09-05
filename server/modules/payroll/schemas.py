from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ==========================================
# Salary Rule Schemas
# ==========================================

class SalaryRuleBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    category: str = Field(..., max_length=50)  # 'BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'
    sequence: int = Field(default=10)
    amount_type: str = Field(default="percentage")  # 'percentage', 'fixed'
    amount: Decimal = Field(default=Decimal("0.00"))
    percentage_base: Optional[str] = Field(default="BASIC")
    condition_code: Optional[str] = None


class SalaryRuleCreate(SalaryRuleBase):
    structure_id: int


class SalaryRuleUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    sequence: Optional[int] = None
    amount_type: Optional[str] = None
    amount: Optional[Decimal] = None
    percentage_base: Optional[str] = None
    condition_code: Optional[str] = None


class SalaryRuleResponse(SalaryRuleBase):
    id: int
    structure_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Salary Structure Schemas
# ==========================================

class SalaryStructureBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    parent_id: Optional[int] = None


class SalaryStructureCreate(SalaryStructureBase):
    rules: Optional[List[SalaryRuleBase]] = None


class SalaryStructureUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    parent_id: Optional[int] = None


class SalaryStructureResponse(SalaryStructureBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SalaryStructureDetailResponse(SalaryStructureResponse):
    rules: List[SalaryRuleResponse] = []


# ==========================================
# Payslip Line Schemas
# ==========================================

class PayslipLineBase(BaseModel):
    code: str
    name: str
    category: str
    sequence: int = 10
    rate: Decimal = Decimal("100.00")
    amount: Decimal
    total: Decimal


class PayslipLineRead(PayslipLineBase):
    id: Optional[int] = None
    payslip_id: Optional[int] = None
    salary_rule_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


PayslipLineResponse = PayslipLineRead


# ==========================================
# Payslip Schemas
# ==========================================

class PayslipBase(BaseModel):
    employee_id: int
    contract_id: Optional[int] = None
    structure_id: Optional[int] = None
    date_from: date
    date_to: date


class PayslipCreate(PayslipBase):
    payrun_id: Optional[int] = None


class PayslipRead(BaseModel):
    id: int
    employee_id: int
    contract_id: Optional[int] = None
    basic_wage: Decimal
    gross_wage: Decimal
    total_deductions: Decimal
    net_wage: Decimal
    has_warning: bool = False
    warning_message: Optional[str] = None
    status: str = "draft"
    lines: List[PayslipLineRead] = []

    # Extended info
    payrun_id: Optional[int] = None
    structure_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    job_title: Optional[str] = None
    department_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


PayslipResponse = PayslipRead
PayslipDetailResponse = PayslipRead


# ==========================================
# Payrun & Wizard Schemas
# ==========================================

class PayrunStep1Validate(BaseModel):
    period_start: date
    period_end: date
    structure_id: Optional[int] = None

    # Compatibility
    name: Optional[str] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None

    @model_validator(mode="before")
    @classmethod
    def populate_step1_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "date_start" in data and "period_start" not in data:
                data["period_start"] = data["date_start"]
            if "date_end" in data and "period_end" not in data:
                data["period_end"] = data["date_end"]
        return data


PayrunWizardStep1ValidateRequest = PayrunStep1Validate


class EligibleEmployeeItem(BaseModel):
    id: int
    name: str
    department: str
    active_contract_id: int
    wage: Decimal
    has_warning: bool = False
    warning_reason: Optional[str] = None

    # Extended info
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    department_name: Optional[str] = None
    job_title: Optional[str] = None
    contract_id: Optional[int] = None
    contract_type: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    has_bank_details: Optional[bool] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    warning: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_employee_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "employee_id" in data and "id" not in data:
                data["id"] = data["employee_id"]
            if "employee_name" in data and "name" not in data:
                data["name"] = data["employee_name"]
            if "department_name" in data and "department" not in data:
                data["department"] = data["department_name"]
            if "contract_id" in data and "active_contract_id" not in data:
                data["active_contract_id"] = data["contract_id"]
            if "warning" in data and "warning_reason" not in data:
                data["warning_reason"] = data["warning"]
        return data


EligibleEmployeeResponse = EligibleEmployeeItem


class PayrunCreate(BaseModel):
    name: str = Field(..., max_length=100)
    structure_id: Optional[int] = None
    period_start: date
    period_end: date
    selected_employee_ids: Optional[List[int]] = Field(default_factory=list)

    # Optional alias fields for compatibility
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    employee_ids: Optional[List[int]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_payrun_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "date_start" in data and "period_start" not in data:
                data["period_start"] = data["date_start"]
            if "date_end" in data and "period_end" not in data:
                data["period_end"] = data["date_end"]
            if "employee_ids" in data and "selected_employee_ids" not in data:
                data["selected_employee_ids"] = data["employee_ids"]
        return data


PayrunWizardStep2ConfirmRequest = PayrunCreate


class PayrunUpdate(BaseModel):
    name: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    structure_id: Optional[int] = None


class PayrunResponse(BaseModel):
    id: int
    name: str
    period_start: date
    period_end: date
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    status: str
    structure_id: Optional[int] = None
    total_basic: Decimal
    total_gross: Decimal
    total_net: Decimal
    payslip_count: int
    warning_count: int
    structure_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_response_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "period_start" in data and "date_start" not in data:
                data["date_start"] = data["period_start"]
            if "period_end" in data and "date_end" not in data:
                data["date_end"] = data["period_end"]
        return data


class PayrunDetailResponse(PayrunResponse):
    payslips: List[PayslipRead] = []


class PayrunWizardStep1ValidateResponse(BaseModel):
    valid: bool
    message: str
    overlapping_payruns: List[str] = []
    eligible_employee_count: int = 0
    structure_name: Optional[str] = None


class StateTransitionRequest(BaseModel):
    target_status: str  # 'computed', 'validated', 'paid', 'cancelled'


class PayrollSummaryMetrics(BaseModel):
    total_payruns: int
    draft_payruns: int
    computed_payruns: int
    validated_payruns: int
    paid_payruns: int
    total_paid_ytd: Decimal
    current_month_net_payout: Decimal
    pending_warnings: int
