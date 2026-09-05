from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class LoanApplyRequest(BaseModel):
    employee_id: int = Field(..., description="Target employee ID")
    loan_type: str = Field("salary_advance", description="Loan classification ('salary_advance', 'emergency_loan', 'equipment_loan')")
    principal_amount: float = Field(..., gt=0, description="Principal advance/loan amount requested")
    tenure_months: int = Field(..., gt=0, description="Repayment period in months")
    interest_rate: Optional[float] = Field(0.0, ge=0, description="Annual interest rate percentage (0.0 for interest-free advances)")
    reason: Optional[str] = Field(None, description="Disbursement justification or rationale")


class LoanApproveRequest(BaseModel):
    approver_id: Optional[int] = Field(None, description="Employee ID of the authorizing manager")


class LoanRejectRequest(BaseModel):
    remarks: Optional[str] = Field(None, description="Reason for rejecting the loan application")


class RecordDeductionRequest(BaseModel):
    loan_id: int = Field(..., description="Target loan ID")
    amount: float = Field(..., gt=0, description="Deduction repayment amount")
    payslip_id: Optional[int] = Field(None, description="Associated payslip ID if deducted in payroll batch")
    payment_date: Optional[date] = Field(None, description="Payment execution date")
    notes: Optional[str] = Field(None, description="Audit notes or transaction references")


class CalculateEMIRequest(BaseModel):
    principal_amount: float = Field(..., gt=0)
    tenure_months: int = Field(..., gt=0)
    interest_rate: Optional[float] = Field(0.0, ge=0)


class CalculateEMIResponse(BaseModel):
    principal_amount: float
    tenure_months: int
    interest_rate: float
    monthly_emi: float
    total_payable: float
    total_interest: float
    schedule: List[Dict[str, Any]] = []


class ActiveDeductionResponse(BaseModel):
    loan_id: Optional[int] = None
    monthly_emi: float = 0.0
    remaining_balance: float = 0.0
    loan_type: Optional[str] = None


class LoanRepaymentResponse(BaseModel):
    id: int
    loan_id: int
    payslip_id: Optional[int] = None
    amount_paid: float
    payment_date: date
    balance_after: float
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeLoanResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    loan_type: str
    principal_amount: float
    interest_rate: float
    tenure_months: int
    monthly_emi: float
    remaining_balance: float
    status: str
    reason: Optional[str] = None
    disbursement_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    repayments: List[LoanRepaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LoansListResponse(BaseModel):
    loans: List[EmployeeLoanResponse] = []
    total_active_loans: int = 0
    total_disbursed: float = 0.0
    total_recovered: float = 0.0
    pending_approvals: int = 0
