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


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, default=date.today, index=True)
    clock_in = Column(DateTime(timezone=True), nullable=True)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    worked_hours = Column(Numeric(5, 2), default=0.00, nullable=False)
    overtime_hours = Column(Numeric(5, 2), default=0.00, nullable=False)
    status = Column(String(20), default="present", nullable=False)  # present, absent, half_day, late, on_leave
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc), default=lambda: datetime.now(timezone.utc))

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], lazy="joined")


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    start_time = Column(String(5), default="09:00", nullable=False)
    end_time = Column(String(5), default="18:00", nullable=False)
    break_hours = Column(Numeric(4, 2), default=1.00, nullable=False)
    grace_period_mins = Column(Integer, default=15, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc), default=lambda: datetime.now(timezone.utc))


class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc), default=lambda: datetime.now(timezone.utc))

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], lazy="joined")
    shift = relationship("Shift", foreign_keys=[shift_id], lazy="joined")
