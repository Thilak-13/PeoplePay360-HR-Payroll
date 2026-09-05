from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from server.modules.master_data.database import Base
import server.modules.master_data.models  # Ensure Employee table is registered


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="employee", nullable=False)  # super_admin, hr_manager, payroll_officer, dept_manager, employee
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], lazy="joined")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, PAYRUN_COMPUTE, etc.
    resource = Column(String(100), nullable=False, index=True)  # auth, employee, payrun, contract, etc.
    ip_address = Column(String(50), nullable=True)
    details_json = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
