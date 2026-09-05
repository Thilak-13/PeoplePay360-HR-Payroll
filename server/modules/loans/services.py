from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from server.modules.loans.models import EmployeeLoan, LoanRepayment


def compute_monthly_emi(
    principal: float | Decimal,
    interest_rate: float | Decimal = 0.0,
    tenure_months: int = 1
) -> Decimal:
    """
    Computes monthly EMI for employee loans and salary advances.
    - If interest_rate <= 0: Standard simple interest / straight-line advance (principal / tenure).
    - If interest_rate > 0: Standard monthly amortized compounding installment formula:
      EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    """
    p = Decimal(str(principal))
    r_annual = Decimal(str(interest_rate))
    n = int(tenure_months)

    if n <= 0:
        raise ValueError("Tenure months must be greater than 0")
    if p <= Decimal("0"):
        return Decimal("0.00")

    if r_annual <= Decimal("0"):
        emi = p / Decimal(n)
        return emi.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Monthly compounding rate: r = annual_rate / 100 / 12
    r_monthly = r_annual / Decimal("100") / Decimal("12")
    compounded = (Decimal("1") + r_monthly) ** n
    emi = (p * r_monthly * compounded) / (compounded - Decimal("1"))
    return emi.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def generate_installment_schedule(
    principal: float | Decimal,
    interest_rate: float | Decimal,
    tenure_months: int,
    monthly_emi: float | Decimal,
    start_date: Optional[date] = None,
    remaining_balance: Optional[float | Decimal] = None,
) -> List[Dict[str, Any]]:
    """
    Generates installment-by-installment projection schedule for a loan.
    """
    schedule = []
    base_date = start_date or date.today()
    emi_dec = Decimal(str(monthly_emi))
    r_annual = Decimal(str(interest_rate))
    r_monthly = r_annual / Decimal("100") / Decimal("12") if r_annual > 0 else Decimal("0")
    
    current_balance = Decimal(str(remaining_balance if remaining_balance is not None else principal))
    total_repayable = emi_dec * Decimal(tenure_months) if r_annual > 0 else Decimal(str(principal))
    running_balance = total_repayable

    for i in range(1, tenure_months + 1):
        # Calculate approx 1 month delta
        month_offset = i - 1
        year_val = base_date.year + (base_date.month + month_offset - 1) // 12
        month_val = (base_date.month + month_offset - 1) % 12 + 1
        day_val = min(base_date.day, 28)
        due_date = date(year_val, month_val, day_val)

        interest_component = (current_balance * r_monthly).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if r_annual > 0 else Decimal("0.00")
        principal_component = max(Decimal("0.00"), emi_dec - interest_component)
        current_balance = max(Decimal("0.00"), current_balance - principal_component)
        running_balance = max(Decimal("0.00"), running_balance - emi_dec)

        schedule.append({
            "installment_number": i,
            "due_date": due_date.isoformat(),
            "emi_amount": float(emi_dec),
            "principal_component": float(principal_component),
            "interest_component": float(interest_component),
            "balance_after": float(running_balance),
        })

    return schedule


def approve_loan(
    db: Session,
    loan_id: int,
    approver_id: Optional[int] = None
) -> EmployeeLoan:
    """
    Approves an employee loan, moves status to 'active', sets remaining_balance,
    and initializes disbursement timestamp.
    """
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee loan with ID {loan_id} not found"
        )

    if loan.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve a previously rejected loan application"
        )

    loan.status = "active"
    if not loan.disbursement_date:
        loan.disbursement_date = date.today()

    # Total repayable calculation
    if float(loan.interest_rate) > 0:
        total_repayable = Decimal(str(loan.monthly_emi)) * Decimal(loan.tenure_months)
    else:
        total_repayable = Decimal(str(loan.principal_amount))

    loan.remaining_balance = total_repayable

    db.commit()
    db.refresh(loan)
    return loan


def reject_loan(
    db: Session,
    loan_id: int,
    remarks: Optional[str] = None
) -> EmployeeLoan:
    """
    Rejects a loan application and sets reason/remarks.
    """
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee loan with ID {loan_id} not found"
        )

    if loan.status in ("repaid", "active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject a loan in '{loan.status}' status"
        )

    loan.status = "rejected"
    if remarks:
        if loan.reason:
            loan.reason = f"{loan.reason} | Rejection Reason: {remarks}"
        else:
            loan.reason = f"Rejected: {remarks}"

    db.commit()
    db.refresh(loan)
    return loan


def get_active_deduction(db: Session, employee_id: int) -> Dict[str, Any]:
    """
    Queries active loans for an employee and returns the monthly EMI amount
    to be deducted in the current payslip cycle.
    """
    active_loan = (
        db.query(EmployeeLoan)
        .filter(
            EmployeeLoan.employee_id == employee_id,
            EmployeeLoan.status == "active",
            EmployeeLoan.remaining_balance > 0,
        )
        .order_by(EmployeeLoan.id.asc())
        .first()
    )

    if not active_loan:
        return {
            "loan_id": None,
            "monthly_emi": 0.0,
            "remaining_balance": 0.0,
            "loan_type": None,
        }

    # Deduction is capped at remaining balance if remaining is less than standard monthly EMI
    deduction_amount = min(Decimal(str(active_loan.monthly_emi)), Decimal(str(active_loan.remaining_balance)))

    return {
        "loan_id": active_loan.id,
        "monthly_emi": float(deduction_amount),
        "remaining_balance": float(active_loan.remaining_balance),
        "loan_type": active_loan.loan_type,
    }


def record_monthly_deduction(
    db: Session,
    loan_id: int,
    amount: float | Decimal,
    payslip_id: Optional[int] = None,
    payment_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> LoanRepayment:
    """
    Records an EMI repayment against a loan, decrements remaining_balance,
    and automatically transitions the loan status to 'repaid' once balance reaches 0.
    """
    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee loan with ID {loan_id} not found"
        )

    pay_amount = Decimal(str(amount))
    if pay_amount <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repayment deduction amount must be greater than 0"
        )

    current_bal = Decimal(str(loan.remaining_balance))
    new_balance = max(Decimal("0.00"), current_bal - pay_amount)
    loan.remaining_balance = new_balance

    if new_balance == Decimal("0.00"):
        loan.status = "repaid"

    repayment = LoanRepayment(
        loan_id=loan.id,
        payslip_id=payslip_id,
        amount_paid=pay_amount,
        payment_date=payment_date or date.today(),
        balance_after=new_balance,
        notes=notes or (f"Payroll EMI deduction via payslip #{payslip_id}" if payslip_id else "Direct EMI installment payment"),
    )

    db.add(repayment)
    db.commit()
    db.refresh(loan)
    db.refresh(repayment)
    return repayment
