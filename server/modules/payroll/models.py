from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from server.modules.payroll.database import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    parent = relationship("SalaryStructure", remote_side=[id], backref="children")
    rules = relationship("SalaryRule", back_populates="structure", cascade="all, delete-orphan", order_by="SalaryRule.sequence")
    payslips = relationship("Payslip", back_populates="structure")


class SalaryRule(Base):
    __tablename__ = "salary_rules"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # 'BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'
    sequence = Column(Integer, default=10, nullable=False)
    amount_type = Column(String(20), default="percentage", nullable=False)  # 'percentage', 'fixed', 'code'
    amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    percentage_base = Column(String(50), default="BASIC", nullable=True)  # 'BASIC', 'wage', 'GROSS'
    condition_code = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    structure = relationship("SalaryStructure", back_populates="rules")
    payslip_lines = relationship("PayslipLine", back_populates="salary_rule")


class Payrun(Base):
    __tablename__ = "payruns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    date_start = Column(Date, nullable=False)
    date_end = Column(Date, nullable=False)
    status = Column(String(20), default="draft", nullable=False)  # 'draft', 'computed', 'validated', 'paid', 'cancelled'
    structure_id = Column(Integer, ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True)
    total_basic = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_gross = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_net = Column(Numeric(12, 2), default=0.00, nullable=False)
    payslip_count = Column(Integer, default=0, nullable=False)
    warning_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    structure = relationship("SalaryStructure")
    payslips = relationship("Payslip", back_populates="payrun", cascade="all, delete-orphan")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payrun_id = Column(Integer, ForeignKey("payruns.id", ondelete="CASCADE"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    structure_id = Column(Integer, ForeignKey("salary_structures.id", ondelete="SET NULL"), nullable=True)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    basic_wage = Column(Numeric(12, 2), default=0.00, nullable=False)
    gross_wage = Column(Numeric(12, 2), default=0.00, nullable=False)
    net_wage = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_deductions = Column(Numeric(12, 2), default=0.00, nullable=False)
    status = Column(String(20), default="draft", nullable=False)  # 'draft', 'computed', 'validated', 'paid', 'cancelled'
    has_warning = Column(Boolean, default=False, nullable=False)
    warning_message = Column(Text, nullable=True)
    bank_account = Column(String(50), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    payrun = relationship("Payrun", back_populates="payslips")
    structure = relationship("SalaryStructure", back_populates="payslips")
    lines = relationship("PayslipLine", back_populates="payslip", cascade="all, delete-orphan", order_by="PayslipLine.sequence")


class PayslipLine(Base):
    __tablename__ = "payslip_lines"

    id = Column(Integer, primary_key=True, index=True)
    payslip_id = Column(Integer, ForeignKey("payslips.id", ondelete="CASCADE"), nullable=False, index=True)
    salary_rule_id = Column(Integer, ForeignKey("salary_rules.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)  # 'BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'
    sequence = Column(Integer, default=10, nullable=False)
    rate = Column(Numeric(6, 2), default=100.00, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    payslip = relationship("Payslip", back_populates="lines")
    salary_rule = relationship("SalaryRule", back_populates="payslip_lines")
