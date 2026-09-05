from datetime import datetime, date, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from server.modules.master_data.database import Base
import server.modules.master_data.models  # Register Employee table


class EmployeeLoan(Base):
    __tablename__ = "employee_loans"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_type = Column(String(50), default="salary_advance", nullable=False)  # salary_advance, emergency_loan, personal_loan, equipment_loan
    principal_amount = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), default=0.00, nullable=False)  # annual percentage
    tenure_months = Column(Integer, default=1, nullable=False)
    total_repayable = Column(Numeric(12, 2), nullable=False)
    monthly_emi = Column(Numeric(12, 2), nullable=False)
    remaining_balance = Column(Numeric(12, 2), nullable=False)
    status = Column(String(30), default="pending_approval", nullable=False, index=True)  # draft, pending_approval, approved, active, repaid, rejected
    reason = Column(Text, nullable=True)
    disbursement_date = Column(Date, nullable=True)
    approved_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc), default=lambda: datetime.now(timezone.utc))

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], lazy="joined")
    repayments = relationship("LoanRepayment", back_populates="loan", cascade="all, delete-orphan", order_by="LoanRepayment.installment_number")


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("employee_loans.id", ondelete="CASCADE"), nullable=False, index=True)
    payslip_id = Column(Integer, nullable=True, index=True)
    installment_number = Column(Integer, default=1, nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False, default=date.today)
    balance_after = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc))

    # Relationships
    loan = relationship("EmployeeLoan", back_populates="repayments")
