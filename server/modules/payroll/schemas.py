from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


# ==========================================
# Salary Rule Schemas
# ==========================================

class SalaryRuleBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    category: str = Field(..., max_length=50)  # 'BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'
    sequence: int = Field(default=10)
    amount_type: str = Field(default="percentage")  # 'percentage', 'fixed', 'code'
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
    name: str
    code: str
    category: str
    sequence: int = 10
    rate: Decimal = Decimal("100.00")
    amount: Decimal
    total: Decimal


class PayslipLineResponse(PayslipLineBase):
    id: int
    payslip_id: int
    salary_rule_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


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


class PayslipResponse(PayslipBase):
    id: int
    payrun_id: Optional[int] = None
    basic_wage: Decimal
    gross_wage: Decimal
    net_wage: Decimal
    total_deductions: Decimal
    status: str
    has_warning: bool
    warning_message: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    job_title: Optional[str] = None
    department_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PayslipDetailResponse(PayslipResponse):
    lines: List[PayslipLineResponse] = []
    structure: Optional[SalaryStructureResponse] = None


# ==========================================
# Payrun Schemas
# ==========================================

class PayrunBase(BaseModel):
    name: str = Field(..., max_length=100)
    date_start: date
    date_end: date
    structure_id: Optional[int] = None


class PayrunCreate(PayrunBase):
    pass


class PayrunUpdate(BaseModel):
    name: Optional[str] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    structure_id: Optional[int] = None


class PayrunResponse(PayrunBase):
    id: int
    status: str
    total_basic: Decimal
    total_gross: Decimal
    total_net: Decimal
    payslip_count: int
    warning_count: int
    structure_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PayrunDetailResponse(PayrunResponse):
    payslips: List[PayslipResponse] = []


# ==========================================
# Wizard & Validation Schemas
# ==========================================

class PayrunWizardStep1ValidateRequest(BaseModel):
    name: str
    date_start: date
    date_end: date
    structure_id: Optional[int] = None


class PayrunWizardStep1ValidateResponse(BaseModel):
    valid: bool
    message: str
    overlapping_payruns: List[str] = []
    eligible_employee_count: int = 0
    structure_name: Optional[str] = None


class EligibleEmployeeResponse(BaseModel):
    employee_id: int
    employee_name: str
    employee_email: str
    department_name: Optional[str] = None
    job_title: Optional[str] = None
    contract_id: int
    wage: Decimal
    contract_type: str
    contract_start: date
    contract_end: Optional[date] = None
    has_bank_details: bool = True
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    warning: Optional[str] = None


class PayrunWizardStep2ConfirmRequest(BaseModel):
    name: str
    date_start: date
    date_end: date
    structure_id: Optional[int] = None
    employee_ids: Optional[List[int]] = None  # None means all eligible employees


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
