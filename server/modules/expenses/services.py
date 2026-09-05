from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.modules.expenses.models import ExpenseClaim
from server.modules.master_data.models import Employee


class ExpenseService:
    @staticmethod
    def submit_claim(
        db: Session,
        employee_id: int,
        category: str,
        amount: Decimal,
        expense_date: date,
        description: str,
        receipt_url: Optional[str] = None,
        currency: str = "INR"
    ) -> ExpenseClaim:
        """Create and submit a new expense reimbursement claim."""
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise ValueError(f"Employee with ID {employee_id} not found")

        claim = ExpenseClaim(
            employee_id=employee_id,
            category=category,
            amount=amount,
            currency=currency,
            expense_date=expense_date,
            description=description,
            receipt_url=receipt_url,
            status="submitted"
        )
        db.add(claim)
        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def approve_claim(db: Session, claim_id: int, approver_id: Optional[int] = None) -> ExpenseClaim:
        """Approve an expense claim for payroll reimbursement."""
        claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
        if not claim:
            raise ValueError(f"Expense claim #{claim_id} not found")

        if claim.status in ["approved", "reimbursed"]:
            raise ValueError(f"Claim #{claim_id} is already {claim.status}")

        claim.status = "approved"
        claim.approved_by = approver_id
        claim.approval_date = date.today()
        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def reject_claim(db: Session, claim_id: int, reason: Optional[str] = None) -> ExpenseClaim:
        """Reject an expense claim."""
        claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
        if not claim:
            raise ValueError(f"Expense claim #{claim_id} not found")

        claim.status = "rejected"
        claim.rejection_reason = reason
        db.commit()
        db.refresh(claim)
        return claim

    @staticmethod
    def get_pending_reimbursements(db: Session, employee_id: int) -> Dict[str, Any]:
        """Query approved unreimbursed claims for inclusion in payroll."""
        claims = db.query(ExpenseClaim).filter(
            ExpenseClaim.employee_id == employee_id,
            ExpenseClaim.status == "approved",
            ExpenseClaim.payslip_id == None
        ).all()

        total = sum((c.amount for c in claims), Decimal("0.00"))

        return {
            "employee_id": employee_id,
            "approved_claims_count": len(claims),
            "total_reimbursement_amount": total,
            "claims": claims,
        }

    @staticmethod
    def mark_as_reimbursed(
        db: Session,
        claim_ids: List[int],
        payslip_id: Optional[int] = None,
        reimbursement_date: Optional[date] = None
    ) -> List[ExpenseClaim]:
        """Mark a list of approved claims as reimbursed."""
        claims = db.query(ExpenseClaim).filter(ExpenseClaim.id.in_(claim_ids)).all()
        for c in claims:
            c.status = "reimbursed"
            c.payslip_id = payslip_id
            c.reimbursement_date = reimbursement_date or date.today()
        db.commit()
        return claims

    @staticmethod
    def get_metrics(db: Session) -> Dict[str, Any]:
        """Aggregate summary KPIs for company expense claims."""
        all_claims = db.query(ExpenseClaim).all()
        total_count = len(all_claims)
        submitted_cnt = sum(1 for c in all_claims if c.status == "submitted")
        approved_cnt = sum(1 for c in all_claims if c.status == "approved")
        reimbursed_cnt = sum(1 for c in all_claims if c.status == "reimbursed")

        total_claimed = sum((c.amount for c in all_claims), Decimal("0.00"))
        total_approved = sum((c.amount for c in all_claims if c.status in ["approved", "reimbursed"]), Decimal("0.00"))
        total_reimbursed = sum((c.amount for c in all_claims if c.status == "reimbursed"), Decimal("0.00"))

        return {
            "total_claims_count": total_count,
            "submitted_count": submitted_cnt,
            "approved_count": approved_cnt,
            "reimbursed_count": reimbursed_cnt,
            "total_claimed_amount": total_claimed,
            "total_approved_amount": total_approved,
            "total_reimbursed_amount": total_reimbursed,
        }
