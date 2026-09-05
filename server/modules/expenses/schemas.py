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


class ExpenseClaimCreate(BaseModel):
    employee_id: int
    category: Literal["travel", "food", "office_supplies", "client_entertainment", "training", "other"] = "travel"
    amount: Decimal = Field(gt=0, description="Expense amount")
    currency: str = Field(default="INR", max_length=10)
    expense_date: date = Field(default_factory=date.today)
    description: str = Field(min_length=3)
    receipt_url: Optional[str] = None


class ClaimApproveRequest(BaseModel):
    approved_by: Optional[int] = None


class ClaimRejectRequest(BaseModel):
    reason: Optional[str] = None


class MarkReimbursedRequest(BaseModel):
    claim_ids: List[int]
    payslip_id: Optional[int] = None
    reimbursement_date: Optional[date] = None


class ExpenseClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    category: str
    amount: Decimal
    currency: str
    expense_date: date
    description: str
    receipt_url: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approval_date: Optional[date] = None
    reimbursement_date: Optional[date] = None
    payslip_id: Optional[int] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeSnippet] = None


class PendingReimbursementResponse(BaseModel):
    employee_id: int
    approved_claims_count: int
    total_reimbursement_amount: Decimal
    claims: List[ExpenseClaimResponse]


class ExpenseMetricsResponse(BaseModel):
    total_claims_count: int
    submitted_count: int
    approved_count: int
    reimbursed_count: int
    total_claimed_amount: Decimal
    total_approved_amount: Decimal
    total_reimbursed_amount: Decimal
