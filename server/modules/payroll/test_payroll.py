from datetime import date
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, Table, Column, Integer, String, Numeric, Date, text
from sqlalchemy.orm import sessionmaker

from server.modules.payroll.database import Base
from server.modules.payroll.models import (
    SalaryStructure,
    SalaryRule,
    Payrun,
    Payslip,
    PayslipLine,
)
from server.modules.payroll.engine import (
    get_or_create_default_structure,
    resolve_active_contract,
    get_eligible_employees,
    check_compliance_warnings,
    calculate_payslip_lines_pipeline,
    compute_single_payslip,
)
from server.modules.payroll.services import PayrollService
from server.modules.payroll.schemas import (
    PayrunWizardStep2ConfirmRequest,
)

import server.modules.master_data.models  # Register all master data tables on Base.metadata
from server.modules.master_data.models import (
    Employee,
    Contract,
    WorkingSchedule,
    WorkingScheduleDay,
)

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Seed test employee & contracts
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM employees;"))
        conn.execute(text("DELETE FROM contracts;"))
        conn.execute(text("""
            INSERT INTO employees (id, first_name, last_name, email, phone, job_title, status)
            VALUES 
                (1, 'Alice', 'Smith', 'alice@example.com', '9876543210', 'Senior Engineer', 'active'),
                (2, 'Bob', 'Jones', 'bob@example.com', NULL, 'Junior Designer', 'active');
        """))
        conn.execute(text("""
            INSERT INTO contracts (id, employee_id, wage, contract_type, start_date, end_date, status)
            VALUES 
                (1, 1, 60000.00, 'full_time', '2026-01-01', NULL, 'active'),
                (2, 2, 40000.00, 'full_time', '2026-01-01', '2026-12-31', 'active');
        """))

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


def test_temporal_contract_resolution(db_session):
    # Test valid active contract
    c = resolve_active_contract(db_session, 1, date(2026, 9, 1), date(2026, 9, 30))
    assert c is not None
    assert c["employee_id"] == 1
    assert c["wage"] == Decimal("60000.00")

    # Test expired contract window
    c_expired = resolve_active_contract(db_session, 2, date(2027, 1, 1), date(2027, 1, 31))
    assert c_expired is None


def test_compliance_audit_warnings(db_session):
    # Employee 1 has phone -> Valid bank account
    warn, msg, bank, ifsc = check_compliance_warnings(db_session, 1, date(2026, 9, 1), date(2026, 9, 30))
    assert warn is False
    assert bank is not None
    assert ifsc is not None

    # Employee 2 has NULL phone -> Missing bank details warning
    warn2, msg2, bank2, ifsc2 = check_compliance_warnings(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
    assert warn2 is True
    assert "Missing verified bank account" in msg2


def test_sequenced_salary_rules_pipeline(db_session):
    struct = get_or_create_default_structure(db_session)
    wage = Decimal("60000.00")
    
    basic, gross, deductions, net, snapshot_lines = calculate_payslip_lines_pipeline(wage, struct.rules)

    # Basic is 50% of 60,000 = 30,000
    assert basic == Decimal("30000.00")
    # Gross = 30,000 (Basic) + 12,000 (HRA 40%) + 1,600 (Conv Allw) = 43,600
    assert gross == Decimal("43600.00")
    # Deductions: PF (capped at 1,800.00) + PT (200.00) = 2,000.00
    assert deductions == Decimal("2000.00")
    # Net = Gross - Deductions = 43,600 - 2,000 = 41,600.00
    assert net == Decimal("41600.00")
    assert len(snapshot_lines) == len(struct.rules)


def test_payrun_creation_and_computation(db_session):
    # Create payrun via Wizard
    req = PayrunWizardStep2ConfirmRequest(
        name="September 2026 Regular Payrun",
        date_start=date(2026, 9, 1),
        date_end=date(2026, 9, 30),
        employee_ids=[1]  # Only employee 1 (no warnings)
    )
    payrun = PayrollService.wizard_step2_confirm_and_create(db_session, req)
    assert payrun.id is not None
    assert payrun.status == "draft"
    assert payrun.payslip_count == 1

    # Compute payrun
    computed_payrun = PayrollService.compute_payrun(db_session, payrun.id)
    assert computed_payrun.status == "computed"
    assert computed_payrun.total_net == Decimal("41600.00")
    assert computed_payrun.warning_count == 0


def test_validation_barrier_enforcement(db_session):
    # Create payrun including Employee 2 (who has bank warning)
    req = PayrunWizardStep2ConfirmRequest(
        name="September 2026 Warning Test",
        date_start=date(2026, 9, 1),
        date_end=date(2026, 9, 30),
        employee_ids=[1, 2]
    )
    payrun = PayrollService.wizard_step2_confirm_and_create(db_session, req)
    PayrollService.compute_payrun(db_session, payrun.id)

    # Attempt transition to 'validated' must fail due to Validation Barrier
    with pytest.raises(ValueError, match="Validation Barrier Blocked"):
        PayrollService.transition_payrun_state(db_session, payrun.id, "validated")


def test_terminal_lock_enforcement(db_session):
    # Create clean payrun with Employee 1 only
    req = PayrunWizardStep2ConfirmRequest(
        name="September 2026 Terminal Lock Test",
        date_start=date(2026, 9, 1),
        date_end=date(2026, 9, 30),
        employee_ids=[1]
    )
    payrun = PayrollService.wizard_step2_confirm_and_create(db_session, req)
    PayrollService.compute_payrun(db_session, payrun.id)

    # Valid transitions: draft -> computed -> validated -> paid
    payrun = PayrollService.transition_payrun_state(db_session, payrun.id, "validated")
    assert payrun.status == "validated"

    payrun = PayrollService.transition_payrun_state(db_session, payrun.id, "paid")
    assert payrun.status == "paid"

    # Terminal Lock: Cannot recompute paid payrun
    with pytest.raises(ValueError, match="Terminal Lock"):
        PayrollService.compute_payrun(db_session, payrun.id)

    # Terminal Lock: Cannot transition paid payrun
    with pytest.raises(ValueError, match="Terminal Lock"):
        PayrollService.transition_payrun_state(db_session, payrun.id, "draft")

    # Terminal Lock: Cannot delete paid payrun
    with pytest.raises(ValueError, match="Terminal Lock"):
        PayrollService.delete_payrun(db_session, payrun.id)


# ==============================================================================
# R1.1 & R1.3 Milestone 1 Test Suite
# ==============================================================================

def test_unapproved_draft_contracts_never_selected(db_session):
    """
    R1.1: Ensure unapproved draft contracts are NEVER selected for payroll.
    1. Employee with active contract + draft contract: active contract is selected, draft is ignored.
    2. Employee with ONLY draft contract: resolve_active_contract returns None, get_eligible_employees excludes them.
    """
    # Employee 1 currently has Contract 1 (active, wage 60000, start 2026-01-01)
    # Add a newer draft contract with higher ID and later start date
    draft_c = Contract(
        id=99,
        employee_id=1,
        wage=Decimal("95000.00"),
        contract_type="full_time",
        start_date=date(2026, 9, 1),
        end_date=None,
        status="draft"
    )
    db_session.add(draft_c)
    db_session.commit()

    # resolve_active_contract must strictly select the active contract (#1), not the draft (#99)
    c = resolve_active_contract(db_session, 1, date(2026, 9, 1), date(2026, 9, 30))
    assert c is not None
    assert c["id"] == 1
    assert c["wage"] == Decimal("60000.00")
    assert c["status"] == "active"

    # Employee 2: Update contract to draft only
    c2 = db_session.query(Contract).filter(Contract.id == 2).first()
    c2.status = "draft"
    db_session.commit()

    c_none = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
    assert c_none is None

    # get_eligible_employees must exclude Employee 2 who has only draft contract
    eligible = get_eligible_employees(db_session, date(2026, 9, 1), date(2026, 9, 30))
    eligible_emp_ids = [e["employee_id"] for e in eligible]
    assert 1 in eligible_emp_ids
    assert 2 not in eligible_emp_ids


def test_active_contracts_spanning_pay_period_dates_selected(db_session):
    """
    R1.1: Test that active contracts spanning the pay period dates ARE selected across boundary conditions.
    """
    # 1. Spanning entire period
    c = resolve_active_contract(db_session, 1, date(2026, 9, 1), date(2026, 9, 30))
    assert c is not None
    assert c["employee_id"] == 1

    # 2. Contract ending on exact first day of period (2026-09-01)
    c_start_boundary = Contract(
        id=101,
        employee_id=2,
        wage=Decimal("42000.00"),
        contract_type="full_time",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 9, 1),
        status="active"
    )
    # Remove previous contract 2 to test boundary cleanly
    db_session.query(Contract).filter(Contract.employee_id == 2).delete()
    db_session.add(c_start_boundary)
    db_session.commit()

    res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
    assert res is not None
    assert res["id"] == 101

    # 3. Contract starting on exact last day of period (2026-09-30)
    c_end_boundary = Contract(
        id=102,
        employee_id=2,
        wage=Decimal("48000.00"),
        contract_type="full_time",
        start_date=date(2026, 9, 30),
        end_date=date(2026, 12, 31),
        status="active"
    )
    db_session.add(c_end_boundary)
    db_session.commit()

    res_latest = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
    assert res_latest is not None
    # ORDER BY start_date DESC should pick the one starting on 2026-09-30
    assert res_latest["id"] == 102
    assert res_latest["wage"] == Decimal("48000.00")


def test_expired_and_cancelled_contracts_outside_period_not_selected(db_session):
    """
    R1.1: Test that expired contracts outside period and cancelled contracts are NOT selected.
    """
    db_session.query(Contract).filter(Contract.employee_id == 2).delete()
    # Contract ending 1 day before period starts (2026-08-31)
    c_expired = Contract(
        id=201,
        employee_id=2,
        wage=Decimal("38000.00"),
        contract_type="full_time",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 8, 31),
        status="expired"
    )
    # Contract starting 1 day after period ends (2026-10-01)
    c_future = Contract(
        id=202,
        employee_id=2,
        wage=Decimal("52000.00"),
        contract_type="full_time",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 12, 31),
        status="active"
    )
    # Cancelled contract covering the period
    c_canc = Contract(
        id=203,
        employee_id=2,
        wage=Decimal("99000.00"),
        contract_type="full_time",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
        status="cancelled"
    )
    db_session.add_all([c_expired, c_future, c_canc])
    db_session.commit()

    res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
    assert res is None


def test_working_schedule_hour_calculation_with_schedule_lines(db_session):
    """
    R1.3: Test working schedule hour calculation using employee's working_schedule_id and daily lines.
    Schedule: 4-day 33h schedule (Mon-Wed 8h each, Thu 9h).
    Period: September 2026 (2026-09-01 to 2026-09-30).
    Expected: 18 working days, 148.00 total hours.
    """
    sched = WorkingSchedule(name="4-day 33h Schedule", hours_per_week=Decimal("33.00"))
    db_session.add(sched)
    db_session.commit()

    # Mon (0): 9-18 - 1h break = 8h
    # Tue (1): 9-18 - 1h break = 8h
    # Wed (2): 9-18 - 1h break = 8h
    # Thu (3): 9-19 - 1h break = 9h
    days = [
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=0, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=1, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=2, start_time="09:00", end_time="18:00", break_hours=Decimal("1.00")),
        WorkingScheduleDay(schedule_id=sched.id, day_of_week=3, start_time="09:00", end_time="19:00", break_hours=Decimal("1.00")),
    ]
    db_session.add_all(days)
    
    emp = db_session.query(Employee).filter(Employee.id == 1).first()
    emp.working_schedule_id = sched.id
    db_session.commit()

    # Create payslip
    payslip = Payslip(
        employee_id=1,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        status="draft"
    )
    db_session.add(payslip)
    db_session.commit()

    computed_slip = compute_single_payslip(db_session, payslip.id)
    assert computed_slip.working_days == 18
    assert computed_slip.total_working_hours == Decimal("148.00")
    assert computed_slip.status == "computed"


def test_working_schedule_hour_calculation_fallback(db_session):
    """
    R1.3: Test working schedule hour calculation fallback to standard 5-day / 40-hr calendar workdays (8h/day, excluding Sat/Sun).
    Employee with working_schedule_id = None.
    Period: September 2026 (2026-09-01 to 2026-09-30, 30 days, 8 weekend days).
    Expected: 22 working days, 176.00 total hours.
    """
    emp = db_session.query(Employee).filter(Employee.id == 1).first()
    emp.working_schedule_id = None
    db_session.commit()

    payslip = Payslip(
        employee_id=1,
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 30),
        status="draft"
    )
    db_session.add(payslip)
    db_session.commit()

    computed_slip = compute_single_payslip(db_session, payslip.id)
    assert computed_slip.working_days == 22
    assert computed_slip.total_working_hours == Decimal("176.00")
    assert computed_slip.status == "computed"
