from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    Text,
    ForeignKey,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship

from server.modules.master_data.database import Base

# Ensure foreign key target 'employees' is loaded into Base.metadata
try:
    import server.modules.master_data.models  # noqa: F401
except Exception:
    pass


class EmployeeLoan(Base):
    __tablename__ = "employee_loans"
    __table_args__ = (
        CheckConstraint(
            "loan_type IN ('salary_advance', 'emergency_loan', 'equipment_loan')",
            name="check_employee_loan_type"
        ),
        CheckConstraint(
            "status IN ('draft', 'pending_approval', 'approved', 'active', 'repaid', 'rejected')",
            name="check_employee_loan_status"
        ),
        CheckConstraint("principal_amount > 0", name="check_employee_loan_principal_positive"),
        CheckConstraint("tenure_months > 0", name="check_employee_loan_tenure_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_type = Column(String(50), nullable=False, default="salary_advance")  # 'salary_advance', 'emergency_loan', 'equipment_loan'
    principal_amount = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), default=0.0, nullable=False)
    tenure_months = Column(Integer, nullable=False, default=1)
    monthly_emi = Column(Numeric(12, 2), nullable=False)
    remaining_balance = Column(Numeric(12, 2), nullable=False)
    status = Column(String(30), default="draft", nullable=False)  # 'draft', 'pending_approval', 'approved', 'active', 'repaid', 'rejected'
    reason = Column(Text, nullable=True)
    disbursement_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    repayments = relationship(
        "LoanRepayment",
        back_populates="loan",
        cascade="all, delete-orphan",
        order_by="LoanRepayment.id.asc()"
    )


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("employee_loans.id", ondelete="CASCADE"), nullable=False, index=True)
    payslip_id = Column(Integer, nullable=True, index=True)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False, default=date.today)
    balance_after = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)

    # Relationships
    loan = relationship("EmployeeLoan", back_populates="repayments")
