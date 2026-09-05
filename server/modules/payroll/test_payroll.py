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
    check_compliance_warnings,
    calculate_payslip_lines_pipeline,
)
from server.modules.payroll.services import PayrollService
from server.modules.payroll.schemas import (
    PayrunWizardStep2ConfirmRequest,
)

# Register external master tables in Base.metadata for foreign key resolution
departments_table = Table(
    "departments",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(100), nullable=False),
    Column("code", String(20), unique=True, nullable=True),
    extend_existing=True
)

employees_table = Table(
    "employees",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("first_name", String(50), nullable=False),
    Column("last_name", String(50), nullable=False),
    Column("email", String(100), unique=True, nullable=False),
    Column("phone", String(20), nullable=True),
    Column("department_id", Integer, nullable=True),
    Column("job_title", String(100), nullable=True),
    Column("status", String(20), default="active"),
    extend_existing=True
)

contracts_table = Table(
    "contracts",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("employee_id", Integer, nullable=False),
    Column("wage", Numeric(12, 2), nullable=False),
    Column("contract_type", String(50), default="full_time"),
    Column("start_date", Date, nullable=False),
    Column("end_date", Date, nullable=True),
    Column("status", String(20), default="draft"),
    extend_existing=True
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
    # Gross = 30,000 + 15,000 (HRA) + 7,500 (Spec Allw) + 1,600 (Conv Allw) = 54,100
    assert gross == Decimal("54100.00")
    # Deductions: PF (12% of 30k = 3600) + PT (200) + TDS (5% of 54.1k = 2705) = 6505
    assert deductions == Decimal("6505.00")
    # Net = Gross - Deductions = 54,100 - 6505 = 47,595.00
    assert net == Decimal("47595.00")
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
    assert computed_payrun.total_net == Decimal("47595.00")
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
