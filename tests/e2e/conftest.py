import pytest
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker, Session

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.payroll.models
import server.modules.auth.models
import server.modules.attendance.models
import server.modules.loans.models
import server.modules.expenses.models
import server.modules.statutory_tax.models
import server.modules.notifications.models

from server.modules.auth.models import User
from server.modules.master_data.models import Employee, Department, WorkingSchedule, Contract, LeaveAllocation, LeaveRequest
from server.modules.payroll.models import SalaryStructure, SalaryRule, Payrun, Payslip, PayslipLine
from server.modules.payroll.engine import get_or_create_default_structure
from server.modules.auth.security import (
    hash_password,
    create_access_token,
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_HR_PAYROLL_USER,
    ROLE_HR_PAYROLL_MANAGER,
    ROLE_EMPLOYEE,
)
from server.main import app

# Shared In-Memory SQLite Engine with StaticPool
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Ensure all schemas are created on startup
Base.metadata.create_all(bind=test_engine)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """Global TestClient configured with DB dependency overrides."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_and_seed_db() -> Generator[Session, None, None]:
    """
    Ensure every test starts with fresh tables, seeded users, and default salary structures.
    """
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Clear old records in child-to-parent order to respect relationships
    try:
        db.query(PayslipLine).delete()
        db.query(Payslip).delete()
        db.query(Payrun).delete()
        db.query(LeaveRequest).delete()
        db.query(LeaveAllocation).delete()
        db.query(Contract).delete()
        db.query(WorkingSchedule).delete()
        db.query(User).delete()
        db.query(Employee).delete()
        db.query(Department).delete()
        db.commit()
    except Exception:
        db.rollback()

    # Seed baseline departments
    dept_admin = Department(id=1, name="Executive Administration", code="ADMIN")
    dept_eng = Department(id=2, name="Engineering & Technology", code="ENG")
    dept_hr = Department(id=3, name="Human Resources", code="HR")
    dept_fin = Department(id=4, name="Finance & Payroll", code="FIN")
    db.add_all([dept_admin, dept_eng, dept_hr, dept_fin])
    db.commit()

    # Seed baseline employees
    emp_admin = Employee(id=1, first_name="System", last_name="Admin", email="admin@peoplepay360.com", phone="9999990001", department_id=1, job_title="System Administrator", status="active")
    emp_hr = Employee(id=2, first_name="Hannah", last_name="Reed", email="hr@peoplepay360.com", phone="9999990002", department_id=3, job_title="HR Director", status="active")
    emp_payroll_user = Employee(id=3, first_name="Peter", last_name="User", email="payrolluser@peoplepay360.com", phone="9999990003", department_id=4, job_title="Payroll Specialist", status="active")
    emp_payroll_mgr = Employee(id=4, first_name="Pamela", last_name="Manager", email="payrollmanager@peoplepay360.com", phone="9999990004", department_id=4, job_title="Head of Payroll", status="active")
    emp_worker = Employee(id=5, first_name="Edward", last_name="Cole", email="employee@peoplepay360.com", phone="9999990005", department_id=2, job_title="Senior Software Engineer", status="active")
    db.add_all([emp_admin, emp_hr, emp_payroll_user, emp_payroll_mgr, emp_worker])
    db.commit()

    # Seed baseline users
    u_admin = User(id=1, email="admin@peoplepay360.com", hashed_password=hash_password("Admin@123"), role=ROLE_ADMIN, employee_id=1, is_active=True)
    u_hr = User(id=2, email="hr@peoplepay360.com", hashed_password=hash_password("Hr@12345"), role=ROLE_HR_MANAGER, employee_id=2, is_active=True)
    u_py_user = User(id=3, email="payrolluser@peoplepay360.com", hashed_password=hash_password("PayrollUser@123"), role=ROLE_HR_PAYROLL_USER, employee_id=3, is_active=True)
    u_py_mgr = User(id=4, email="payrollmanager@peoplepay360.com", hashed_password=hash_password("PayrollMgr@123"), role=ROLE_HR_PAYROLL_MANAGER, employee_id=4, is_active=True)
    u_emp = User(id=5, email="employee@peoplepay360.com", hashed_password=hash_password("Employee@123"), role=ROLE_EMPLOYEE, employee_id=5, is_active=True)
    db.add_all([u_admin, u_hr, u_py_user, u_py_mgr, u_emp])
    db.commit()

    # Seed baseline contract for employee 5
    c5 = Contract(id=5, employee_id=5, wage=Decimal("60000.00"), start_date=date(2026, 1, 1), status="active")
    db.add(c5)
    db.commit()

    # Ensure default structure is initialized
    get_or_create_default_structure(db)
    db.commit()

    yield db

    db.close()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Yields a transactional DB session for test assertions."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_auth_header(user_id: int, email: str, role: str, employee_id: int) -> Dict[str, str]:
    token = create_access_token({
        "sub": str(user_id),
        "user_id": user_id,
        "email": email,
        "role": role,
        "employee_id": employee_id,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers() -> Dict[str, str]:
    return make_auth_header(1, "admin@peoplepay360.com", ROLE_ADMIN, 1)


@pytest.fixture
def hr_headers() -> Dict[str, str]:
    return make_auth_header(2, "hr@peoplepay360.com", ROLE_HR_MANAGER, 2)


@pytest.fixture
def payroll_user_headers() -> Dict[str, str]:
    return make_auth_header(3, "payrolluser@peoplepay360.com", ROLE_HR_PAYROLL_USER, 3)


@pytest.fixture
def payroll_manager_headers() -> Dict[str, str]:
    return make_auth_header(4, "payrollmanager@peoplepay360.com", ROLE_HR_PAYROLL_MANAGER, 4)


@pytest.fixture
def employee_headers() -> Dict[str, str]:
    return make_auth_header(5, "employee@peoplepay360.com", ROLE_EMPLOYEE, 5)
