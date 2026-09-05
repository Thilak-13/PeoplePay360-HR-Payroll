from datetime import date
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.modules.master_data.database import get_db, Base, engine
from server.modules.loans.models import EmployeeLoan, LoanRepayment
from server.modules.loans.schemas import (
    LoanApplyRequest,
    LoanApproveRequest,
    LoanRejectRequest,
    DeductionRecordRequest,
    EmployeeLoanResponse,
    LoanRepaymentResponse,
    ActiveDeductionResponse,
    LoanMetricsResponse,
)
from server.modules.loans.services import LoanService

# Ensure loan tables exist
Base.metadata.create_all(bind=engine)

router = APIRouter()


@router.get("/ping", tags=["Loans"])
def ping():
    """Health ping for Loans domain."""
    return {"module": "loans_ready"}


@router.get("", response_model=List[EmployeeLoanResponse], tags=["Loans"])
def list_loans(
    employee_id: Optional[int] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db)
):
    """List all employee loans with optional filters."""
    q = db.query(EmployeeLoan)
    if employee_id:
        q = q.filter(EmployeeLoan.employee_id == employee_id)
    if status_filter and status_filter != "all":
        q = q.filter(EmployeeLoan.status == status_filter)
    loans = q.order_by(desc(EmployeeLoan.created_at)).all()
    return [EmployeeLoanResponse.model_validate(l) for l in loans]


@router.post("/apply", response_model=EmployeeLoanResponse, status_code=status.HTTP_201_CREATED, tags=["Loans"])
def apply_for_loan(req: LoanApplyRequest, db: Session = Depends(get_db)):
    """Submit a loan or salary advance request."""
    try:
        loan = LoanService.apply_for_loan(
            db=db,
            employee_id=req.employee_id,
            loan_type=req.loan_type,
            principal=req.principal_amount,
            tenure_months=req.tenure_months,
            interest_rate=req.interest_rate,
            reason=req.reason
        )
        return EmployeeLoanResponse.model_validate(loan)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{loan_id}/approve", response_model=EmployeeLoanResponse, tags=["Loans"])
def approve_loan(loan_id: int, req: Optional[LoanApproveRequest] = None, db: Session = Depends(get_db)):
    """Approve and activate an employee loan."""
    try:
        disbursement = req.disbursement_date if req else None
        approver = req.approved_by if req else None
        loan = LoanService.approve_loan(db, loan_id, approver, disbursement)
        return EmployeeLoanResponse.model_validate(loan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{loan_id}/reject", response_model=EmployeeLoanResponse, tags=["Loans"])
def reject_loan(loan_id: int, req: Optional[LoanRejectRequest] = None, db: Session = Depends(get_db)):
    """Reject an employee loan application."""
    try:
        reason = req.reason if req else None
        loan = LoanService.reject_loan(db, loan_id, reason)
        return EmployeeLoanResponse.model_validate(loan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{loan_id}", response_model=EmployeeLoanResponse, tags=["Loans"])
def get_loan_detail(loan_id: int, db: Session = Depends(get_db)):
    """Get full loan details and repayment history."""
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail=f"Loan #{loan_id} not found")
    return EmployeeLoanResponse.model_validate(loan)


@router.get("/employee/{employee_id}", response_model=List[EmployeeLoanResponse], tags=["Loans"])
def get_employee_loans(employee_id: int, db: Session = Depends(get_db)):
    """Get all loans and advances for a specific employee."""
    loans = db.query(EmployeeLoan).filter(EmployeeLoan.employee_id == employee_id).order_by(desc(EmployeeLoan.created_at)).all()
    return [EmployeeLoanResponse.model_validate(l) for l in loans]


@router.get("/active-deduction/{employee_id}", response_model=ActiveDeductionResponse, tags=["Loans"])
def get_active_deduction(employee_id: int, db: Session = Depends(get_db)):
    """Query active monthly EMI deduction for payrun integration."""
    data = LoanService.get_active_deduction(db, employee_id)
    return ActiveDeductionResponse(
        employee_id=data["employee_id"],
        active_loan_count=data["active_loan_count"],
        total_monthly_emi=data["total_monthly_emi"],
        total_remaining_balance=data["total_remaining_balance"],
        active_loans=[EmployeeLoanResponse.model_validate(l) for l in data["active_loans"]]
    )


@router.post("/record-deduction", response_model=LoanRepaymentResponse, tags=["Loans"])
def record_deduction(req: DeductionRecordRequest, db: Session = Depends(get_db)):
    """Record an EMI payment deduction against a loan."""
    try:
        repayment = LoanService.record_deduction(
            db=db,
            loan_id=req.loan_id,
            amount_paid=req.amount_paid,
            payslip_id=req.payslip_id,
            payment_date=req.payment_date,
            notes=req.notes
        )
        return LoanRepaymentResponse.model_validate(repayment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/metrics/summary", response_model=LoanMetricsResponse, tags=["Loans"])
def get_loan_metrics(db: Session = Depends(get_db)):
    """Summary KPI metrics for company loan portfolio."""
    metrics = LoanService.get_metrics(db)
    return LoanMetricsResponse(**metrics)


@router.post("/seed-sample-loans", tags=["Loans"])
def seed_sample_loans(db: Session = Depends(get_db)):
    """Seed sample advances and active loans for testing."""
    sample_data = [
        (1, "salary_advance", Decimal("15000.00"), 1, Decimal("0.00"), "Festival emergency advance", "active"),
        (2, "personal_loan", Decimal("60000.00"), 6, Decimal("5.00"), "Home relocation loan", "active"),
        (3, "equipment_loan", Decimal("45000.00"), 3, Decimal("0.00"), "Workstation upgrade loan", "pending_approval"),
    ]
    created = 0
    for emp_id, l_type, principal, tenure, rate, reason, stat in sample_data:
        existing = db.query(EmployeeLoan).filter(
            EmployeeLoan.employee_id == emp_id,
            EmployeeLoan.loan_type == l_type
        ).first()
        if not existing:
            tot, emi = LoanService.calculate_emi(principal, rate, tenure)
            loan = EmployeeLoan(
                employee_id=emp_id,
                loan_type=l_type,
                principal_amount=principal,
                interest_rate=rate,
                tenure_months=tenure,
                total_repayable=tot,
                monthly_emi=emi,
                remaining_balance=tot,
                status=stat,
                reason=reason,
                disbursement_date=date.today() if stat == "active" else None
            )
            db.add(loan)
            created += 1
    db.commit()
    return {"status": "seeded", "loans_created": created}
