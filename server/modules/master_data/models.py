from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from server.modules.master_data.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(20), unique=True, index=True, nullable=True)
    manager_id = Column(Integer, nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    parent = relationship("Department", remote_side=lambda: [Department.id], backref="children")
    employees = relationship("Employee", back_populates="department")


class WorkingSchedule(Base):
    __tablename__ = "working_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    hours_per_week = Column(Numeric(5, 2), default=40.00, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employees = relationship("Employee", back_populates="working_schedule")
    days = relationship("WorkingScheduleDay", back_populates="schedule", cascade="all, delete-orphan", order_by="WorkingScheduleDay.day_of_week")


class WorkingScheduleDay(Base):
    __tablename__ = "working_schedule_days"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("working_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(String(5), nullable=False, default="09:00")
    end_time = Column(String(5), nullable=False, default="18:00")
    break_hours = Column(Numeric(4, 2), default=1.00, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    schedule = relationship("WorkingSchedule", back_populates="days")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    working_schedule_id = Column(Integer, ForeignKey("working_schedules.id", ondelete="SET NULL"), nullable=True)
    job_title = Column(String(100), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    hire_date = Column(Date, nullable=True, default=date.today)
    status = Column(String(20), default="active", nullable=False)  # 'active', 'inactive', 'on_leave'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="employees")
    working_schedule = relationship("WorkingSchedule", back_populates="employees")
    contracts = relationship("Contract", back_populates="employee", cascade="all, delete-orphan")
    leave_allocations = relationship("LeaveAllocation", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("wage > 0", name="check_contract_wage_positive"),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="check_contract_dates_valid"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    wage = Column(Numeric(12, 2), nullable=False)
    contract_type = Column(String(50), default="full_time", nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), default="active", nullable=False)  # 'draft', 'active', 'expired', 'cancelled'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="contracts")


class LeaveAllocation(Base):
    __tablename__ = "leave_allocations"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    holiday_type = Column(String(50), nullable=False)
    number_of_days = Column(Numeric(5, 2), nullable=False)
    year = Column(Integer, nullable=False)
    status = Column(String(20), default="approved", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_allocations")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        CheckConstraint("date_to >= date_from", name="check_leave_dates_valid"),
        CheckConstraint("number_of_days > 0", name="check_leave_days_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    holiday_type = Column(String(50), nullable=False)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    number_of_days = Column(Numeric(5, 2), nullable=False)
    status = Column(String(20), default="draft", nullable=False)  # 'draft', 'confirm', 'approved', 'refused'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow, default=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="leave_requests")
