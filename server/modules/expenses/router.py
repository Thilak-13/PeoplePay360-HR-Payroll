from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.modules.master_data.database import get_db, Base, engine
from server.modules.expenses.models import ExpenseClaim
from server.modules.expenses.schemas import (
    ExpenseClaimCreate,
    ExpenseClaimResponse,
    ClaimApproveRequest,
    ClaimRejectRequest,
    MarkReimbursedRequest,
    PendingReimbursementResponse,
    ExpenseMetricsResponse,
)
from server.modules.expenses.services import ExpenseService

# Ensure expense tables exist
Base.metadata.create_all(bind=engine)

router = APIRouter()


@router.get("/ping", tags=["Expenses"])
def ping():
    """Health ping for Expenses domain."""
    return {"module": "expenses_ready"}


@router.get("", response_model=List[ExpenseClaimResponse], tags=["Expenses"])
def list_expenses(
    employee_id: Optional[int] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    category_filter: Optional[str] = Query(default=None, alias="category"),
    db: Session = Depends(get_db)
):
    """List all expense claims with optional filters."""
    q = db.query(ExpenseClaim)
    if employee_id:
        q = q.filter(ExpenseClaim.employee_id == employee_id)
    if status_filter and status_filter != "all":
        q = q.filter(ExpenseClaim.status == status_filter)
    if category_filter and category_filter != "all":
        q = q.filter(ExpenseClaim.category == category_filter)
    claims = q.order_by(desc(ExpenseClaim.created_at)).all()
    return [ExpenseClaimResponse.model_validate(c) for c in claims]


@router.post("/submit", response_model=ExpenseClaimResponse, status_code=status.HTTP_201_CREATED, tags=["Expenses"])
def submit_expense(req: ExpenseClaimCreate, db: Session = Depends(get_db)):
    """Submit an employee expense claim."""
    try:
        claim = ExpenseService.submit_claim(
            db=db,
            employee_id=req.employee_id,
            category=req.category,
            amount=req.amount,
            currency=req.currency,
            expense_date=req.expense_date,
            description=req.description,
            receipt_url=req.receipt_url
        )
        return ExpenseClaimResponse.model_validate(claim)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{claim_id}/approve", response_model=ExpenseClaimResponse, tags=["Expenses"])
def approve_expense(claim_id: int, req: Optional[ClaimApproveRequest] = None, db: Session = Depends(get_db)):
    """Approve an expense claim for reimbursement."""
    try:
        approver = req.approved_by if req else None
        claim = ExpenseService.approve_claim(db, claim_id, approver)
        return ExpenseClaimResponse.model_validate(claim)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{claim_id}/reject", response_model=ExpenseClaimResponse, tags=["Expenses"])
def reject_expense(claim_id: int, req: Optional[ClaimRejectRequest] = None, db: Session = Depends(get_db)):
    """Reject an expense claim."""
    try:
        reason = req.reason if req else None
        claim = ExpenseService.reject_claim(db, claim_id, reason)
        return ExpenseClaimResponse.model_validate(claim)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{claim_id}", response_model=ExpenseClaimResponse, tags=["Expenses"])
def get_expense_detail(claim_id: int, db: Session = Depends(get_db)):
    """Get single expense claim detail."""
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail=f"Expense claim #{claim_id} not found")
    return ExpenseClaimResponse.model_validate(claim)


@router.get("/pending-reimbursements/{employee_id}", response_model=PendingReimbursementResponse, tags=["Expenses"])
def get_pending_reimbursements(employee_id: int, db: Session = Depends(get_db)):
    """Query approved unreimbursed claims for inclusion in payroll payrun."""
    data = ExpenseService.get_pending_reimbursements(db, employee_id)
    return PendingReimbursementResponse(
        employee_id=data["employee_id"],
        approved_claims_count=data["approved_claims_count"],
        total_reimbursement_amount=data["total_reimbursement_amount"],
        claims=[ExpenseClaimResponse.model_validate(c) for c in data["claims"]]
    )


@router.post("/mark-reimbursed", response_model=List[ExpenseClaimResponse], tags=["Expenses"])
def mark_reimbursed(req: MarkReimbursedRequest, db: Session = Depends(get_db)):
    """Mark claims as reimbursed in a payroll payout batch."""
    claims = ExpenseService.mark_as_reimbursed(
        db=db,
        claim_ids=req.claim_ids,
        payslip_id=req.payslip_id,
        reimbursement_date=req.reimbursement_date
    )
    return [ExpenseClaimResponse.model_validate(c) for c in claims]


@router.get("/metrics/summary", response_model=ExpenseMetricsResponse, tags=["Expenses"])
def get_expense_metrics(db: Session = Depends(get_db)):
    """Summary metrics for corporate expense claims."""
    metrics = ExpenseService.get_metrics(db)
    return ExpenseMetricsResponse(**metrics)


@router.post("/seed-sample-expenses", tags=["Expenses"])
def seed_sample_expenses(db: Session = Depends(get_db)):
    """Seed realistic expense claims for demo and testing."""
    from decimal import Decimal
    samples = [
        (1, "travel", Decimal("4500.00"), date.today(), "Client on-site travel cab fare", "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400", "submitted"),
        (2, "client_entertainment", Decimal("7800.00"), date.today(), "Client quarterly review dinner", "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400", "approved"),
        (3, "office_supplies", Decimal("2200.00"), date.today(), "Ergonomic keyboard and mouse", "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400", "reimbursed"),
    ]
    created = 0
    for emp_id, cat, amt, dt, desc_t, rec, stat in samples:
        existing = db.query(ExpenseClaim).filter(
            ExpenseClaim.employee_id == emp_id,
            ExpenseClaim.description == desc_t
        ).first()
        if not existing:
            c = ExpenseClaim(
                employee_id=emp_id,
                category=cat,
                amount=amt,
                currency="INR",
                expense_date=dt,
                description=desc_t,
                receipt_url=rec,
                status=stat,
                approval_date=dt if stat in ["approved", "reimbursed"] else None,
                reimbursement_date=dt if stat == "reimbursed" else None
            )
            db.add(c)
            created += 1
    db.commit()
    return {"status": "seeded", "expenses_created": created}
