from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from server.modules.loans.database import get_db
from server.modules.loans.models import EmployeeLoan, LoanRepayment
from server.modules.loans.schemas import (
    LoanApplyRequest,
    LoanApproveRequest,
    LoanRejectRequest,
    RecordDeductionRequest,
    CalculateEMIRequest,
    CalculateEMIResponse,
    ActiveDeductionResponse,
    LoanRepaymentResponse,
    EmployeeLoanResponse,
    LoansListResponse,
)
from server.modules.loans.services import (
    compute_monthly_emi,
    generate_installment_schedule,
    approve_loan as approve_loan_service,
    reject_loan as reject_loan_service,
    get_active_deduction as get_active_deduction_service,
    record_monthly_deduction as record_monthly_deduction_service,
)

router = APIRouter()


def _enrich_loan(db: Session, loan: EmployeeLoan) -> EmployeeLoanResponse:
    """Helper to enrich EmployeeLoan with employee name if employee record exists."""
    employee_name = None
    try:
        from server.modules.master_data.models import Employee
        emp = db.query(Employee).filter(Employee.id == loan.employee_id).first()
        if emp:
            employee_name = f"{emp.first_name} {emp.last_name}".strip()
    except Exception:
        pass

    return EmployeeLoanResponse(
        id=loan.id,
        employee_id=loan.employee_id,
        employee_name=employee_name or f"Employee #{loan.employee_id}",
        loan_type=loan.loan_type,
        principal_amount=float(loan.principal_amount),
        interest_rate=float(loan.interest_rate),
        tenure_months=loan.tenure_months,
        monthly_emi=float(loan.monthly_emi),
        remaining_balance=float(loan.remaining_balance),
        status=loan.status,
        reason=loan.reason,
        disbursement_date=loan.disbursement_date,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        repayments=[
            LoanRepaymentResponse(
                id=r.id,
                loan_id=r.loan_id,
                payslip_id=r.payslip_id,
                amount_paid=float(r.amount_paid),
                payment_date=r.payment_date,
                balance_after=float(r.balance_after),
                notes=r.notes,
                created_at=r.created_at,
            )
            for r in loan.repayments
        ],
    )


@router.get("/ping")
def ping():
    """Module health status check."""
    return {"module": "loans_ready"}


@router.post("/calculate-emi", response_model=CalculateEMIResponse)
def calculate_emi(req: CalculateEMIRequest):
    """
    Computes monthly installment, total payable, and amortization projection
    without persisting to the database.
    """
    emi = compute_monthly_emi(
        principal=req.principal_amount,
        interest_rate=req.interest_rate or 0.0,
        tenure_months=req.tenure_months,
    )
    total_payable = float(emi * Decimal(req.tenure_months)) if (req.interest_rate or 0) > 0 else req.principal_amount
    total_interest = max(0.0, total_payable - req.principal_amount)
    schedule = generate_installment_schedule(
        principal=req.principal_amount,
        interest_rate=req.interest_rate or 0.0,
        tenure_months=req.tenure_months,
        monthly_emi=emi,
    )

    return CalculateEMIResponse(
        principal_amount=req.principal_amount,
        tenure_months=req.tenure_months,
        interest_rate=req.interest_rate or 0.0,
        monthly_emi=float(emi),
        total_payable=total_payable,
        total_interest=total_interest,
        schedule=schedule,
    )


@router.get("", response_model=LoansListResponse)
@router.get("/list", response_model=LoansListResponse)
def list_loans(
    status_filter: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Lists all loans with aggregate summary metrics for the management dashboard.
    """
    query = db.query(EmployeeLoan)
    if status_filter and status_filter != "all":
        query = query.filter(EmployeeLoan.status == status_filter)
    if employee_id:
        query = query.filter(EmployeeLoan.employee_id == employee_id)

    loans = query.order_by(EmployeeLoan.id.desc()).all()

    # Aggregate metrics
    all_loans = db.query(EmployeeLoan).all()
    total_active_loans = sum(1 for l in all_loans if l.status == "active")
    total_disbursed = sum(float(l.principal_amount) for l in all_loans if l.status in ("active", "repaid"))
    total_recovered = sum(
        float(l.principal_amount) - float(l.remaining_balance)
        for l in all_loans
        if l.status in ("active", "repaid") and float(l.principal_amount) >= float(l.remaining_balance)
    )
    pending_approvals = sum(1 for l in all_loans if l.status == "pending_approval")

    return LoansListResponse(
        loans=[_enrich_loan(db, l) for l in loans],
        total_active_loans=total_active_loans,
        total_disbursed=round(total_disbursed, 2),
        total_recovered=round(total_recovered, 2),
        pending_approvals=pending_approvals,
    )


@router.post("/apply", response_model=EmployeeLoanResponse, status_code=status.HTTP_201_CREATED)
def apply_loan(req: LoanApplyRequest, db: Session = Depends(get_db)):
    """
    Creates a new employee loan or salary advance application in 'pending_approval' status.
    """
    emi = compute_monthly_emi(
        principal=req.principal_amount,
        interest_rate=req.interest_rate or 0.0,
        tenure_months=req.tenure_months,
    )

    if (req.interest_rate or 0.0) > 0:
        total_repayable = emi * Decimal(req.tenure_months)
    else:
        total_repayable = Decimal(str(req.principal_amount))

    loan = EmployeeLoan(
        employee_id=req.employee_id,
        loan_type=req.loan_type,
        principal_amount=Decimal(str(req.principal_amount)),
        interest_rate=Decimal(str(req.interest_rate or 0.0)),
        tenure_months=req.tenure_months,
        monthly_emi=emi,
        remaining_balance=total_repayable,
        status="pending_approval",
        reason=req.reason,
    )

    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _enrich_loan(db, loan)


@router.post("/{id}/approve", response_model=EmployeeLoanResponse)
def approve_loan(
    id: int,
    req: Optional[LoanApproveRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Authorizes and activates an employee loan, enabling payroll deductions.
    """
    approver_id = req.approver_id if req else None
    loan = approve_loan_service(db, loan_id=id, approver_id=approver_id)
    return _enrich_loan(db, loan)


@router.post("/{id}/reject", response_model=EmployeeLoanResponse)
def reject_loan(
    id: int,
    req: Optional[LoanRejectRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Rejects a loan application with remarks.
    """
    remarks = req.remarks if req else None
    loan = reject_loan_service(db, loan_id=id, remarks=remarks)
    return _enrich_loan(db, loan)


@router.get("/employee/{employee_id}", response_model=List[EmployeeLoanResponse])
def get_employee_loans(employee_id: int, db: Session = Depends(get_db)):
    """
    Returns all loans and repayment history for a specific employee.
    """
    loans = (
        db.query(EmployeeLoan)
        .filter(EmployeeLoan.employee_id == employee_id)
        .order_by(EmployeeLoan.id.desc())
        .all()
    )
    return [_enrich_loan(db, l) for l in loans]


@router.get("/active-deduction/{employee_id}", response_model=ActiveDeductionResponse)
def get_active_deduction(employee_id: int, db: Session = Depends(get_db)):
    """
    Returns the active monthly installment to be deducted for the employee in payroll processing.
    """
    data = get_active_deduction_service(db, employee_id=employee_id)
    return ActiveDeductionResponse(**data)


@router.post("/record-deduction", response_model=LoanRepaymentResponse)
def record_deduction(req: RecordDeductionRequest, db: Session = Depends(get_db)):
    """
    Records an EMI deduction payment against a loan, reducing remaining_balance.
    Auto-transitions loan to 'repaid' once remaining_balance reaches 0.
    """
    repayment = record_monthly_deduction_service(
        db=db,
        loan_id=req.loan_id,
        amount=req.amount,
        payslip_id=req.payslip_id,
        payment_date=req.payment_date,
        notes=req.notes,
    )
    return LoanRepaymentResponse(
        id=repayment.id,
        loan_id=repayment.loan_id,
        payslip_id=repayment.payslip_id,
        amount_paid=float(repayment.amount_paid),
        payment_date=repayment.payment_date,
        balance_after=float(repayment.balance_after),
        notes=repayment.notes,
        created_at=repayment.created_at,
    )


@router.get("/{id}", response_model=EmployeeLoanResponse)
def get_loan(id: int, db: Session = Depends(get_db)):
    """
    Retrieves details and payment history for a single loan by ID.
    """
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee loan with ID {id} not found"
        )
    return _enrich_loan(db, loan)


@router.get("/{id}/schedule")
def get_loan_schedule(id: int, db: Session = Depends(get_db)):
    """
    Generates dynamic monthly installment projection schedule for a specific loan.
    """
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee loan with ID {id} not found"
        )

    schedule = generate_installment_schedule(
        principal=loan.principal_amount,
        interest_rate=loan.interest_rate,
        tenure_months=loan.tenure_months,
        monthly_emi=loan.monthly_emi,
        start_date=loan.disbursement_date,
        remaining_balance=loan.remaining_balance,
    )
    return {
        "loan_id": loan.id,
        "employee_id": loan.employee_id,
        "principal_amount": float(loan.principal_amount),
        "interest_rate": float(loan.interest_rate),
        "monthly_emi": float(loan.monthly_emi),
        "remaining_balance": float(loan.remaining_balance),
        "status": loan.status,
        "schedule": schedule,
    }
