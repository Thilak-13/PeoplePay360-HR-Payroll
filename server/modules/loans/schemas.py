from datetime import datetime, date
from typing import Optional, List, Literal
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class EmployeeSnippet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: str
    job_title: Optional[str] = None


class LoanApplyRequest(BaseModel):
    employee_id: int
    loan_type: Literal["salary_advance", "emergency_loan", "personal_loan", "equipment_loan"] = "salary_advance"
    principal_amount: Decimal = Field(gt=0, description="Loan principal amount")
    tenure_months: int = Field(ge=1, le=60, default=1, description="Tenure in months")
    interest_rate: Decimal = Field(default=Decimal("0.00"), ge=0, description="Annual interest rate percentage")
    reason: Optional[str] = None


class LoanApproveRequest(BaseModel):
    disbursement_date: Optional[date] = None
    approved_by: Optional[int] = None


class LoanRejectRequest(BaseModel):
    reason: Optional[str] = None


class DeductionRecordRequest(BaseModel):
    loan_id: int
    amount_paid: Decimal = Field(gt=0)
    payslip_id: Optional[int] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None


class LoanRepaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    payslip_id: Optional[int] = None
    installment_number: int
    amount_paid: Decimal
    payment_date: date
    balance_after: Decimal
    notes: Optional[str] = None
    created_at: datetime


class EmployeeLoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    loan_type: str
    principal_amount: Decimal
    interest_rate: Decimal
    tenure_months: int
    total_repayable: Decimal
    monthly_emi: Decimal
    remaining_balance: Decimal
    status: str
    reason: Optional[str] = None
    disbursement_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeSnippet] = None
    repayments: Optional[List[LoanRepaymentResponse]] = None


class ActiveDeductionResponse(BaseModel):
    employee_id: int
    active_loan_count: int
    total_monthly_emi: Decimal
    total_remaining_balance: Decimal
    active_loans: List[EmployeeLoanResponse]


class LoanMetricsResponse(BaseModel):
    total_loans_count: int
    active_loans_count: int
    pending_approval_count: int
    total_disbursed: Decimal
    total_recovered: Decimal
    total_outstanding_balance: Decimal
