"""
Adversarial Empirical Stress Test Suite for Milestone 1 - R1.3 Working Schedules & Hour Calculations
Author: challenger_m1_2
Target: R1.3 Working schedule calculations and fallback math

Dimensions Challenged:
1. Partial month periods (mid-month hires, 1st-15th, 16th-30th, partition invariants).
2. Custom schedules with multiple shifts on the same day (split shifts, triple shifts, break clamping).
3. Weekend-only schedules vs weekday schedules (cross-evaluation, 6-day and 7-day schedules).
4. Leap years (February 29th) and month-end/year-end boundary crossings.
5. Zero-hour schedules, empty days, null schedule fallback math, and defensive guards.
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from server.modules.master_data.database import Base
from server.modules.master_data.models import (
    Employee,
    Department,
    WorkingSchedule,
    WorkingScheduleDay,
    Contract,
)
from server.modules.payroll.models import (
    SalaryStructure,
    SalaryRule,
    Payrun,
    Payslip,
    PayslipLine,
)
from server.modules.master_data.services import (
    calculate_working_hours,
    compute_hours_from_days,
    parse_time_hours,
)
from server.modules.payroll.engine import (
    compute_single_payslip,
    get_or_create_default_structure,
)


# ==============================================================================
# In-Memory Test Session Fixture
# ==============================================================================

@pytest.fixture(scope="module")
def stress_db():
    """Provides an isolated in-memory SQLite database for stress testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()

    # Seed Department
    dept = Department(id=1, name="Engineering", code="ENG")
    db.add(dept)
    db.flush()

    # Seed Default Salary Structure & Rule
    struct = get_or_create_default_structure(db)

    # Seed Baseline Employee
    emp = Employee(
        id=1,
        first_name="Test",
        last_name="Worker",
        email="test.worker@example.com",
        department_id=dept.id,
        status="active",
        bank_account_number="1234567890",
        bank_ifsc="HDFC0001234",
    )
    db.add(emp)
    db.flush()

    # Seed Active Contract covering full year 2024 through 2026
    contract = Contract(
        id=1,
        employee_id=emp.id,
        wage=Decimal("50000.00"),
        contract_type="full_time",
        start_date=date(2024, 1, 1),
        end_date=date(2026, 12, 31),
        status="active",
    )
    db.add(contract)
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)


# ==============================================================================
# Suite 1: Partial Month Periods & Mid-Month Hires
# ==============================================================================

def test_partial_month_first_half_fallback():
    """
    Challenge 1.1: Mid-month period (2026-09-01 Tue to 2026-09-15 Tue).
    15 calendar days: 11 weekdays, 4 weekend days.
    Standard 40h/5-day schedule -> exactly 11 working days, 88.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 15),
    )
    assert res.working_days == 11
    assert res.total_calculated_hours == 88.0
    assert res.hours_per_day == 8.0


def test_partial_month_second_half_fallback():
    """
    Challenge 1.2: Mid-month hire period (2026-09-16 Wed to 2026-09-30 Wed).
    15 calendar days: 11 weekdays, 4 weekend days.
    Standard 40h/5-day schedule -> exactly 11 working days, 88.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 16),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 11
    assert res.total_calculated_hours == 88.0
    assert res.hours_per_day == 8.0


def test_partial_month_partition_invariant():
    """
    Challenge 1.3: Partition Invariant under Fallback Math.
    Part 1 (Sep 1-15) + Part 2 (Sep 16-30) MUST EQUAL Full Month (Sep 1-30).
    11 days + 11 days == 22 days.
    88.0h + 88.0h == 176.0h.
    """
    h1 = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 15),
    )
    h2 = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 16),
        date_to=date(2026, 9, 30),
    )
    full = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert h1.working_days + h2.working_days == full.working_days
    assert round(h1.total_calculated_hours + h2.total_calculated_hours, 2) == full.total_calculated_hours


def test_partial_month_schedule_lines_partition_invariant(stress_db):
    """
    Challenge 1.4: Partition Invariant under Custom Schedule with Daily Lines.
    Schedule: 4-day 33h schedule (Mon-Wed 8h each, Thu 9h).
    Sep 1-15 (Tue-Tue): 9 working days, 74.0 hours.
    Sep 16-30 (Wed-Wed): 9 working days, 74.0 hours.
    Full Sep 1-30: 18 working days, 148.0 hours.
    """
    sched = WorkingSchedule(name="Invariant 4-day Sched", hours_per_week=Decimal("33.00"))
    stress_db.add(sched)
    stress_db.commit()

    days = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")), # 8h
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=1, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")), # 8h
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=2, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")), # 8h
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=3, start_time="09:00", end_time="19:00", break_hours=Decimal("1.00")), # 9h
    ]
    stress_db.add_all(days)
    stress_db.commit()
    stress_db.refresh(sched)

    h1 = calculate_working_hours(schedule=sched, date_from=date(2026, 9, 1), date_to=date(2026, 9, 15))
    h2 = calculate_working_hours(schedule=sched, date_from=date(2026, 9, 16), date_to=date(2026, 9, 30))
    full = calculate_working_hours(schedule=sched, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30))

    assert h1.working_days == 9
    assert h1.total_calculated_hours == 74.0
    assert h2.working_days == 9
    assert h2.total_calculated_hours == 74.0
    assert full.working_days == 18
    assert full.total_calculated_hours == 148.0

    assert h1.working_days + h2.working_days == full.working_days
    assert round(h1.total_calculated_hours + h2.total_calculated_hours, 2) == full.total_calculated_hours


def test_partial_month_payslip_engine_computation(stress_db):
    """
    Challenge 1.5: End-to-end payslip computation for mid-month hire (Sep 16 - Sep 30).
    Ensures compute_single_payslip correctly applies partial period boundaries.
    """
    emp = stress_db.query(Employee).filter(Employee.id == 1).first()
    emp.working_schedule_id = None
    stress_db.commit()

    payslip = Payslip(
        employee_id=emp.id,
        date_from=date(2026, 9, 16),
        date_to=date(2026, 9, 30),
        status="draft",
    )
    stress_db.add(payslip)
    stress_db.commit()

    computed = compute_single_payslip(stress_db, payslip.id)
    assert computed.status == "computed"
    assert computed.working_days == 11
    assert computed.total_working_hours == Decimal("88.00")
    assert computed.paid_days == 11


# ==============================================================================
# Suite 2: Custom Schedules with Multiple Shifts on Same Day
# ==============================================================================

def test_multi_shift_same_day_split_shift(stress_db):
    """
    Challenge 2.1: Split shift schedule with 2 distinct shifts on Monday and 2 on Tuesday.
    Monday: Shift 1 (08:00-12:00 = 4h) + Shift 2 (14:00-18:00 = 4h) -> 8.0h
    Tuesday: Shift 1 (08:30-12:30, 0.5h brk = 3.5h) + Shift 2 (16:30-20:30, 0.5h brk = 3.5h) -> 7.0h
    Total weekly: 15.0h across 2 days.
    """
    sched = WorkingSchedule(name="Split Shift Schedule", hours_per_week=Decimal("15.00"))
    stress_db.add(sched)
    stress_db.commit()

    shifts = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="08:00", end_time="12:00", break_hours=Decimal("0.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="14:00", end_time="18:00", break_hours=Decimal("0.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=1, start_time="08:30", end_time="12:30", break_hours=Decimal("0.50")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=1, start_time="16:30", end_time="20:30", break_hours=Decimal("0.50")),
    ]
    stress_db.add_all(shifts)
    stress_db.commit()
    stress_db.refresh(sched)

    # Calculate over 1 full week: 2026-09-07 (Mon) to 2026-09-13 (Sun)
    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 7),
        date_to=date(2026, 9, 13),
    )
    assert res.hours_per_week == 15.0
    assert res.working_days == 2
    assert res.total_calculated_hours == 15.0
    assert res.hours_per_day == 7.5


def test_multi_shift_triple_split(stress_db):
    """
    Challenge 2.2: 3 shifts on the same day (broken shift).
    Monday:
      Morning: 06:00-10:00 (4h)
      Midday: 12:00-15:00 (3h)
      Evening: 17:00-20:00 (3h)
    Total for Monday = 10.0h.
    """
    sched = WorkingSchedule(name="Triple Shift Monday", hours_per_week=Decimal("10.00"))
    stress_db.add(sched)
    stress_db.commit()

    shifts = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="06:00", end_time="10:00", break_hours=Decimal("0.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="12:00", end_time="15:00", break_hours=Decimal("0.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="17:00", end_time="20:00", break_hours=Decimal("0.00")),
    ]
    stress_db.add_all(shifts)
    stress_db.commit()
    stress_db.refresh(sched)

    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 7), # Monday
        date_to=date(2026, 9, 7),   # Monday
    )
    assert res.working_days == 1
    assert res.total_calculated_hours == 10.0


def test_multi_shift_break_exceeding_shift_clamped(stress_db):
    """
    Challenge 2.3: Shift with break_hours greater than elapsed time.
    Elapsed: 09:00 to 10:00 (1.0h). Break: 2.0h.
    Net hours must clamp to 0.0 (never negative).
    """
    sched = WorkingSchedule(name="Clamped Shift Sched", hours_per_week=Decimal("0.00"))
    stress_db.add(sched)
    stress_db.commit()

    shift = WorkingScheduleDay(
        schedule_id=sched.id,
        day_of_week=0,
        start_time="09:00",
        end_time="10:00",
        break_hours=Decimal("2.00"),
    )
    stress_db.add(shift)
    stress_db.commit()
    stress_db.refresh(sched)

    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 7),
        date_to=date(2026, 9, 7),
    )
    assert res.working_days == 1
    assert res.total_calculated_hours == 0.0
    assert res.hours_per_week == 0.0


def test_multi_shift_payslip_computation(stress_db):
    """
    Challenge 2.4: compute_single_payslip execution with multi-shift schedule.
    """
    emp = stress_db.query(Employee).filter(Employee.id == 1).first()

    sched = WorkingSchedule(name="Multi-shift Payslip Sched", hours_per_week=Decimal("15.00"))
    stress_db.add(sched)
    stress_db.commit()

    shifts = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="08:00", end_time="12:00", break_hours=Decimal("0.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="14:00", end_time="18:00", break_hours=Decimal("0.00")),
    ]
    stress_db.add_all(shifts)
    emp.working_schedule_id = sched.id
    stress_db.commit()

    payslip = Payslip(
        employee_id=emp.id,
        date_from=date(2026, 9, 7), # Monday
        date_to=date(2026, 9, 13),   # Sunday
        status="draft",
    )
    stress_db.add(payslip)
    stress_db.commit()

    computed = compute_single_payslip(stress_db, payslip.id)
    assert computed.working_days == 1
    assert computed.total_working_hours == Decimal("8.00")
    assert computed.paid_days == 1


# ==============================================================================
# Suite 3: Weekend-Only Schedules vs Weekday Schedules
# ==============================================================================

def test_weekend_only_schedule_full_month(stress_db):
    """
    Challenge 3.1: Weekend-only schedule (Saturday 8h, Sunday 8h = 16h/week).
    September 2026 has 4 Saturdays (5, 12, 19, 26) and 4 Sundays (6, 13, 20, 27) = 8 working days.
    Total hours: 8 * 8.0 = 64.0 hours.
    """
    sched = WorkingSchedule(name="Weekend Only Schedule", hours_per_week=Decimal("16.00"))
    stress_db.add(sched)
    stress_db.commit()

    shifts = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=5, start_time="10:00", end_time="19:00", break_hours=Decimal("1.00")), # 8h Sat
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=6, start_time="10:00", end_time="19:00", break_hours=Decimal("1.00")), # 8h Sun
    ]
    stress_db.add_all(shifts)
    stress_db.commit()
    stress_db.refresh(sched)

    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 8
    assert res.total_calculated_hours == 64.0
    assert res.hours_per_week == 16.0
    assert res.hours_per_day == 8.0


def test_weekend_only_schedule_evaluated_on_weekday_range(stress_db):
    """
    Challenge 3.2: Cross-evaluation — weekend-only employee queried for weekday range (Mon-Fri).
    Period: 2026-09-07 (Mon) to 2026-09-11 (Fri).
    Expected: 0 working days, 0.0 hours.
    """
    sched = stress_db.query(WorkingSchedule).filter(WorkingSchedule.name == "Weekend Only Schedule").first()
    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 7),
        date_to=date(2026, 9, 11),
    )
    assert res.working_days == 0
    assert res.total_calculated_hours == 0.0


def test_weekday_worker_evaluated_on_weekend_range():
    """
    Challenge 3.3: Cross-evaluation — standard weekday worker queried for weekend range (Sat-Sun).
    Period: 2026-09-05 (Sat) to 2026-09-06 (Sun).
    Expected: 0 working days, 0.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 5),
        date_to=date(2026, 9, 6),
    )
    assert res.working_days == 0
    assert res.total_calculated_hours == 0.0


def test_six_day_workweek_fallback():
    """
    Challenge 3.4: 6-day workweek schedule (Mon-Sat, 48h/week, 8h/day).
    September 2026: 22 weekdays + 4 Saturdays = 26 working days.
    Expected hours: 26 * 8.0 = 208.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("48.00"),
        days_per_week=6,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 26
    assert res.total_calculated_hours == 208.0
    assert res.hours_per_day == 8.0


def test_seven_day_continuous_workweek_fallback():
    """
    Challenge 3.5: 7-day continuous schedule (Mon-Sun, 56h/week, 8h/day).
    September 2026 has 30 calendar days -> all 30 days are working days.
    Expected hours: 30 * 8.0 = 240.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("56.00"),
        days_per_week=7,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 30
    assert res.total_calculated_hours == 240.0
    assert res.hours_per_day == 8.0


# ==============================================================================
# Suite 4: Leap Years (Feb 29) & Boundary Crossings
# ==============================================================================

def test_leap_year_february_2024_full_month():
    """
    Challenge 4.1: Leap Year 2024 (February 1 to February 29).
    29 calendar days.
    2024-02-29 is a Thursday.
    Weekdays in Feb 2024: 5 Thu, 4 Fri, 4 Mon, 4 Tue, 4 Wed = 21 working days.
    Expected hours @ 8h/day = 168.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2024, 2, 1),
        date_to=date(2024, 2, 29),
    )
    assert res.working_days == 21
    assert res.total_calculated_hours == 168.0


def test_non_leap_year_february_2025_full_month():
    """
    Challenge 4.2: Non-Leap Year 2025 (February 1 to February 28).
    28 calendar days: exactly 4 weeks = 20 working days.
    Expected hours @ 8h/day = 160.0 hours.
    Verifies exactly 1 working day difference between leap and non-leap February.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2025, 2, 1),
        date_to=date(2025, 2, 28),
    )
    assert res.working_days == 20
    assert res.total_calculated_hours == 160.0


def test_leap_day_boundary_crossing():
    """
    Challenge 4.3: Boundary crossing across Leap Day (2024-02-28 Wed to 2024-03-02 Sat).
    2024-02-28: Wed (1)
    2024-02-29: Thu (2) - Leap day!
    2024-03-01: Fri (3)
    2024-03-02: Sat (weekend)
    Expected: 3 working days, 24.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2024, 2, 28),
        date_to=date(2024, 3, 2),
    )
    assert res.working_days == 3
    assert res.total_calculated_hours == 24.0


def test_year_end_boundary_crossing():
    """
    Challenge 4.4: Year-end boundary crossing (2025-12-28 Sun to 2026-01-04 Sun).
    2025-12-28: Sun (weekend)
    2025-12-29 to 2026-01-02: Mon-Fri (5 working days)
    2026-01-03: Sat (weekend)
    2026-01-04: Sun (weekend)
    Expected: 5 working days, 40.0 hours.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2025, 12, 28),
        date_to=date(2026, 1, 4),
    )
    assert res.working_days == 5
    assert res.total_calculated_hours == 40.0


# ==============================================================================
# Suite 5: Zero-Hour Schedules & Null Fallback Math
# ==============================================================================

def test_schedule_with_empty_days_falls_back(stress_db):
    """
    Challenge 5.1: Schedule created with no daily lines (days = []).
    calculate_working_hours and compute_single_payslip must fall back to 5-day / 40h standard calendar days.
    """
    sched = WorkingSchedule(name="Empty Lines Sched", hours_per_week=Decimal("40.00"))
    stress_db.add(sched)
    stress_db.commit()
    stress_db.refresh(sched)

    # Calling calculate_working_hours with empty days list
    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 22
    assert res.total_calculated_hours == 176.0


def test_schedule_with_zero_hour_shifts(stress_db):
    """
    Challenge 5.2: Schedule with shift lines where net hours are 0.0.
    start_time == end_time or break_hours >= elapsed.
    Must calculate 0.0 weekly hours and 0.0 total hours without ZeroDivisionError.
    """
    sched = WorkingSchedule(name="Zero Hour Shifts Sched", hours_per_week=Decimal("0.00"))
    stress_db.add(sched)
    stress_db.commit()

    shift = WorkingScheduleDay(
        schedule_id=sched.id,
        day_of_week=0,
        start_time="09:00",
        end_time="09:00",
        break_hours=Decimal("0.00"),
    )
    stress_db.add(shift)
    stress_db.commit()
    stress_db.refresh(sched)

    res = calculate_working_hours(
        schedule=sched,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.hours_per_week == 0.0
    assert res.hours_per_day == 0.0
    assert res.total_calculated_hours == 0.0
    # September 2026 has 4 Mondays
    assert res.working_days == 4


def test_zero_hour_per_week_fallback():
    """
    Challenge 5.3: Fallback math with hours_per_week = Decimal('0.00').
    Must evaluate working_days = 22, total_calculated_hours = 0.0 without errors.
    """
    res = calculate_working_hours(
        hours_per_week=Decimal("0.00"),
        days_per_week=5,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res.working_days == 22
    assert res.total_calculated_hours == 0.0
    assert res.hours_per_day == 0.0


def test_zero_days_per_week_guards_against_zero_division():
    """
    Challenge 5.4: Fallback math with days_per_week = 0.
    Guard `if days_per_week <= 0 or days_per_week > 7: days_per_week = 5` prevents ZeroDivisionError.
    """
    res_zero = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=0,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res_zero.working_days == 22
    assert res_zero.total_calculated_hours == 176.0
    assert res_zero.hours_per_day == 8.0

    res_overflow = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=99,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
    )
    assert res_overflow.working_days == 22
    assert res_overflow.total_calculated_hours == 176.0


def test_null_schedule_id_fallback_in_payslip(stress_db):
    """
    Challenge 5.5: Employee with working_schedule_id = None in compute_single_payslip.
    Must compute cleanly using standard 5-day calendar fallback.
    """
    emp = stress_db.query(Employee).filter(Employee.id == 1).first()
    emp.working_schedule_id = None
    stress_db.commit()

    payslip = Payslip(
        employee_id=emp.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        status="draft",
    )
    stress_db.add(payslip)
    stress_db.commit()

    computed = compute_single_payslip(stress_db, payslip.id)
    assert computed.status == "computed"
    assert computed.working_days == 22
    assert computed.total_working_hours == Decimal("176.00")
    assert computed.paid_days == 22


def test_non_existent_schedule_id_fallback_in_payslip(stress_db):
    """
    Challenge 5.6: Employee with working_schedule_id referencing non-existent ID (99999).
    compute_single_payslip must handle missing DB record gracefully and fall back to 5-day schedule.
    """
    emp = stress_db.query(Employee).filter(Employee.id == 1).first()
    emp.working_schedule_id = 99999
    stress_db.commit()

    payslip = Payslip(
        employee_id=emp.id,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        status="draft",
    )
    stress_db.add(payslip)
    stress_db.commit()

    computed = compute_single_payslip(stress_db, payslip.id)
    assert computed.status == "computed"
    assert computed.working_days == 22
    assert computed.total_working_hours == Decimal("176.00")
    assert computed.paid_days == 22


def test_single_day_period_edge_case():
    """
    Challenge 5.7: date_from == date_to (single calendar day).
    Weekday: 2026-09-01 (Tue) -> 1 working day, 8.0 hours.
    Weekend: 2026-09-06 (Sun) -> 0 working days, 0.0 hours.
    """
    res_wd = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 1),
    )
    assert res_wd.working_days == 1
    assert res_wd.total_calculated_hours == 8.0

    res_we = calculate_working_hours(
        hours_per_week=Decimal("40.00"),
        days_per_week=5,
        date_from=date(2026, 9, 6),
        date_to=date(2026, 9, 6),
    )
    assert res_we.working_days == 0
    assert res_we.total_calculated_hours == 0.0


def test_inverted_date_range_raises_400():
    """
    Challenge 5.8: date_from > date_to must raise HTTPException 400 Bad Request.
    """
    with pytest.raises(HTTPException) as exc_info:
        calculate_working_hours(
            hours_per_week=Decimal("40.00"),
            days_per_week=5,
            date_from=date(2026, 9, 30),
            date_to=date(2026, 9, 1),
        )
    assert exc_info.value.status_code == 400


# ==============================================================================
# Standalone Test Execution Harness
# ==============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("RUNNING ADVERSARIAL EMPIRICAL STRESS TESTS (R1.3 WORKING SCHEDULES)")
    print("=" * 80)

    # Initialize isolated DB for standalone run
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()

    dept = Department(id=1, name="Engineering", code="ENG")
    db.add(dept)
    db.flush()
    struct = get_or_create_default_structure(db)
    emp = Employee(
        id=1,
        first_name="Test",
        last_name="Worker",
        email="test.worker@example.com",
        department_id=dept.id,
        status="active",
        bank_account_number="1234567890",
        bank_ifsc="HDFC0001234",
    )
    db.add(emp)
    db.flush()
    contract = Contract(
        id=1,
        employee_id=emp.id,
        wage=Decimal("50000.00"),
        contract_type="full_time",
        start_date=date(2024, 1, 1),
        end_date=date(2026, 12, 31),
        status="active",
    )
    db.add(contract)
    db.commit()

    passed = 0
    total = 0

    suite = [
        ("Partial Month 1st Half", test_partial_month_first_half_fallback, []),
        ("Partial Month 2nd Half", test_partial_month_second_half_fallback, []),
        ("Partial Month Partition Invariant", test_partial_month_partition_invariant, []),
        ("Partial Month Schedule Lines Partition", test_partial_month_schedule_lines_partition_invariant, [db]),
        ("Partial Month Payslip Engine", test_partial_month_payslip_engine_computation, [db]),
        ("Multi-Shift Split Shift", test_multi_shift_same_day_split_shift, [db]),
        ("Multi-Shift Triple Split", test_multi_shift_triple_split, [db]),
        ("Multi-Shift Break Clamping", test_multi_shift_break_exceeding_shift_clamped, [db]),
        ("Multi-Shift Payslip Engine", test_multi_shift_payslip_computation, [db]),
        ("Weekend-Only Schedule Full Month", test_weekend_only_schedule_full_month, [db]),
        ("Weekend-Only Queried on Weekday Range", test_weekend_only_schedule_evaluated_on_weekday_range, [db]),
        ("Weekday Worker Queried on Weekend Range", test_weekday_worker_evaluated_on_weekend_range, []),
        ("6-Day Workweek Fallback", test_six_day_workweek_fallback, []),
        ("7-Day Continuous Workweek Fallback", test_seven_day_continuous_workweek_fallback, []),
        ("Leap Year Feb 2024 Full Month", test_leap_year_february_2024_full_month, []),
        ("Non-Leap Year Feb 2025 Full Month", test_non_leap_year_february_2025_full_month, []),
        ("Leap Day Boundary Crossing", test_leap_day_boundary_crossing, []),
        ("Year-End Boundary Crossing", test_year_end_boundary_crossing, []),
        ("Empty Schedule Days Fallback", test_schedule_with_empty_days_falls_back, [db]),
        ("Zero-Hour Shifts", test_schedule_with_zero_hour_shifts, [db]),
        ("Zero-Hour Per Week Fallback", test_zero_hour_per_week_fallback, []),
        ("Zero Days Guard (No ZeroDivision)", test_zero_days_per_week_guards_against_zero_division, []),
        ("Null Schedule ID Payslip Fallback", test_null_schedule_id_fallback_in_payslip, [db]),
        ("Non-Existent Schedule ID Fallback", test_non_existent_schedule_id_fallback_in_payslip, [db]),
        ("Single Day Edge Cases", test_single_day_period_edge_case, []),
        ("Inverted Date Range 400", test_inverted_date_range_raises_400, []),
    ]

    for name, func, args in suite:
        total += 1
        try:
            func(*args)
            print(f"  [PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")

    print("=" * 80)
    print(f"RESULTS: {passed}/{total} EMPIRICAL STRESS TESTS PASSED")
    print("=" * 80 + "\n")
