from datetime import datetime, date
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


class ExpenseClaim(Base):
    __tablename__ = "expense_claims"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # travel, food, office_supplies, client_entertainment, training, other
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    expense_date = Column(Date, nullable=False, default=date.today)
    description = Column(Text, nullable=False)
    receipt_url = Column(String(255), nullable=True)
    status = Column(String(20), default="submitted", nullable=False, index=True)  # draft, submitted, approved, reimbursed, rejected
    approved_by = Column(Integer, nullable=True)
    approval_date = Column(Date, nullable=True)
    reimbursement_date = Column(Date, nullable=True)
    payslip_id = Column(Integer, nullable=True, index=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], lazy="joined")
