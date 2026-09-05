from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from server.modules.loans.models import EmployeeLoan, LoanRepayment
from server.modules.master_data.models import Employee


class LoanService:
    @staticmethod
    def calculate_emi(principal: Decimal, interest_rate: Decimal, tenure_months: int) -> Tuple[Decimal, Decimal]:
        """Calculate total repayable and monthly EMI amount."""
        if tenure_months <= 0:
            tenure_months = 1

        p = Decimal(str(principal))
        r = Decimal(str(interest_rate))
        t = Decimal(str(tenure_months))

        if r <= Decimal("0.00") or tenure_months == 1:
            total_repayable = p.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            monthly_emi = (total_repayable / t).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return total_repayable, monthly_emi

        # Simple interest formula: P * (R / 100) * (T / 12)
        interest_amount = p * (r / Decimal("100.0")) * (t / Decimal("12.0"))
        total_repayable = (p + interest_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        monthly_emi = (total_repayable / t).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return total_repayable, monthly_emi

    @staticmethod
    def apply_for_loan(
        db: Session,
        employee_id: int,
        loan_type: str,
        principal: Decimal,
        tenure_months: int,
        interest_rate: Decimal = Decimal("0.00"),
        reason: Optional[str] = None
    ) -> EmployeeLoan:
        """Create a new loan or advance application."""
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise ValueError(f"Employee with ID {employee_id} not found")

        total_rep, emi = LoanService.calculate_emi(principal, interest_rate, tenure_months)

        loan = EmployeeLoan(
            employee_id=employee_id,
            loan_type=loan_type,
            principal_amount=principal,
            interest_rate=interest_rate,
            tenure_months=tenure_months,
            total_repayable=total_rep,
            monthly_emi=emi,
            remaining_balance=total_rep,
            status="pending_approval",
            reason=reason
        )
        db.add(loan)
        db.commit()
        db.refresh(loan)
        return loan

    @staticmethod
    def approve_loan(
        db: Session,
        loan_id: int,
        approver_id: Optional[int] = None,
        disbursement_date: Optional[date] = None
    ) -> EmployeeLoan:
        """Approve and activate an employee loan."""
        loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        if not loan:
            raise ValueError(f"Loan with ID {loan_id} not found")

        if loan.status in ["approved", "active", "repaid"]:
            raise ValueError(f"Loan #{loan_id} is already {loan.status}")

        loan.status = "active"
        loan.approved_by = approver_id
        loan.disbursement_date = disbursement_date or date.today()
        loan.remaining_balance = loan.total_repayable
        db.commit()
        db.refresh(loan)
        return loan

    @staticmethod
    def reject_loan(db: Session, loan_id: int, reason: Optional[str] = None) -> EmployeeLoan:
        """Reject a pending loan request."""
        loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        if not loan:
            raise ValueError(f"Loan with ID {loan_id} not found")

        loan.status = "rejected"
        if reason:
            loan.reason = (loan.reason or "") + f" | Rejected: {reason}"
        db.commit()
        db.refresh(loan)
        return loan

    @staticmethod
    def get_active_deduction(db: Session, employee_id: int) -> Dict[str, Any]:
        """Query active loans & monthly EMI deduction sum for an employee."""
        active_loans = db.query(EmployeeLoan).filter(
            EmployeeLoan.employee_id == employee_id,
            EmployeeLoan.status == "active",
            EmployeeLoan.remaining_balance > Decimal("0.00")
        ).all()

        total_emi = sum((l.monthly_emi for l in active_loans), Decimal("0.00"))
        total_bal = sum((l.remaining_balance for l in active_loans), Decimal("0.00"))

        return {
            "employee_id": employee_id,
            "active_loan_count": len(active_loans),
            "total_monthly_emi": total_emi,
            "total_remaining_balance": total_bal,
            "active_loans": active_loans,
        }

    @staticmethod
    def record_deduction(
        db: Session,
        loan_id: int,
        amount_paid: Decimal,
        payslip_id: Optional[int] = None,
        payment_date: Optional[date] = None,
        notes: Optional[str] = None
    ) -> LoanRepayment:
        """Record an EMI payment against a loan and update remaining balance."""
        loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
        if not loan:
            raise ValueError(f"Loan with ID {loan_id} not found")

        if loan.status != "active":
            raise ValueError(f"Cannot record deduction on loan with status '{loan.status}'")

        installment_num = len(loan.repayments) + 1
        new_balance = max(Decimal("0.00"), loan.remaining_balance - amount_paid)
        loan.remaining_balance = new_balance

        if new_balance <= Decimal("0.00"):
            loan.status = "repaid"

        repayment = LoanRepayment(
            loan_id=loan_id,
            payslip_id=payslip_id,
            installment_number=installment_num,
            amount_paid=amount_paid,
            payment_date=payment_date or date.today(),
            balance_after=new_balance,
            notes=notes or f"Payroll EMI installment #{installment_num}"
        )
        db.add(repayment)
        db.commit()
        db.refresh(repayment)
        return repayment

    @staticmethod
    def get_metrics(db: Session) -> Dict[str, Any]:
        """Aggregate high-level metrics for employee loans."""
        all_loans = db.query(EmployeeLoan).all()
        total_count = len(all_loans)
        active_count = sum(1 for l in all_loans if l.status == "active")
        pending_count = sum(1 for l in all_loans if l.status == "pending_approval")
        total_disbursed = sum((l.principal_amount for l in all_loans if l.status in ["active", "repaid"]), Decimal("0.00"))
        total_outstanding = sum((l.remaining_balance for l in all_loans if l.status == "active"), Decimal("0.00"))
        total_recovered = max(Decimal("0.00"), total_disbursed - total_outstanding)

        return {
            "total_loans_count": total_count,
            "active_loans_count": active_count,
            "pending_approval_count": pending_count,
            "total_disbursed": total_disbursed,
            "total_recovered": total_recovered,
            "total_outstanding_balance": total_outstanding,
        }
