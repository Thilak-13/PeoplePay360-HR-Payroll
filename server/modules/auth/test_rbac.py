import pytest
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.payroll.models
import server.modules.auth.models
import server.modules.attendance.models

from server.modules.auth.security import (
    hash_password,
    create_access_token,
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_HR_PAYROLL_USER,
    ROLE_HR_PAYROLL_MANAGER,
    ROLE_EMPLOYEE,
)
from server.modules.auth.models import User
from server.modules.master_data.models import Employee, Department, Contract
from server.modules.payroll.models import SalaryStructure, SalaryRule
from server.main import app

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def create_token_for(user: User) -> str:
    return create_access_token({
        "sub": str(user.id),
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "employee_id": user.employee_id,
    })


@pytest.fixture(autouse=True)
def setup_rbac_database():
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSessionLocal()
    
    # 1. Seed Employees
    if not db.query(Employee).filter(Employee.id == 1).first():
        emp1 = Employee(id=1, first_name="Admin", last_name="User", email="admin@peoplepay360.com", job_title="System Administrator")
        emp2 = Employee(id=2, first_name="HR", last_name="Leader", email="hr@peoplepay360.com", job_title="HR Director")
        emp3 = Employee(id=3, first_name="Payroll", last_name="Specialist", email="payrolluser@peoplepay360.com", job_title="Payroll Specialist")
        emp4 = Employee(id=4, first_name="Payroll", last_name="Manager", email="payrollmanager@peoplepay360.com", job_title="Head of Payroll")
        emp5 = Employee(id=5, first_name="Eleanor", last_name="Vance", email="employee@peoplepay360.com", job_title="Associate Software Engineer")
        db.add_all([emp1, emp2, emp3, emp4, emp5])
        db.commit()

    # 2. Seed Users
    if not db.query(User).filter(User.id == 1).first():
        u_admin = User(id=1, email="admin@peoplepay360.com", hashed_password=hash_password("Admin@123"), role=ROLE_ADMIN, employee_id=1, is_active=True)
        u_hr = User(id=2, email="hr@peoplepay360.com", hashed_password=hash_password("Hr@12345"), role=ROLE_HR_MANAGER, employee_id=2, is_active=True)
        u_py_user = User(id=3, email="payrolluser@peoplepay360.com", hashed_password=hash_password("PayrollUser@123"), role=ROLE_HR_PAYROLL_USER, employee_id=3, is_active=True)
        u_py_mgr = User(id=4, email="payrollmanager@peoplepay360.com", hashed_password=hash_password("PayrollMgr@123"), role=ROLE_HR_PAYROLL_MANAGER, employee_id=4, is_active=True)
        u_emp = User(id=5, email="employee@peoplepay360.com", hashed_password=hash_password("Employee@123"), role=ROLE_EMPLOYEE, employee_id=5, is_active=True)
        db.add_all([u_admin, u_hr, u_py_user, u_py_mgr, u_emp])
        db.commit()

    # 3. Seed Contracts
    if not db.query(Contract).filter(Contract.id == 5).first():
        c5 = Contract(id=5, employee_id=5, wage=Decimal("17000.00"), start_date=date(2026, 1, 1), status="active")
        db.add(c5)
        db.commit()

    # 4. Seed Salary Structure
    if not db.query(SalaryStructure).filter(SalaryStructure.id == 1).first():
        st = SalaryStructure(id=1, name="Standard Engineering", code="ENG_STD")
        db.add(st)
        db.commit()

    db.close()


# ==============================================================================
# Role 1: Employee Boundary Tests
# ==============================================================================

def test_employee_can_view_own_details_and_punch_for_self():
    token = create_access_token({"user_id": 5, "email": "employee@peoplepay360.com", "role": ROLE_EMPLOYEE, "employee_id": 5})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. View own employee details -> 200 OK
    res_self = client.get("/api/v1/master-data/employees/5", headers=headers)
    assert res_self.status_code == 200
    assert res_self.json()["email"] == "employee@peoplepay360.com"

    # 2. View another employee's details -> 403 Forbidden
    res_other = client.get("/api/v1/master-data/employees/1", headers=headers)
    assert res_other.status_code == 403

    # 3. Punch attendance for self -> 200 OK
    punch_self = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in"}, headers=headers)
    assert punch_self.status_code == 200

    # 4. Punch attendance for another employee -> 403 Forbidden
    punch_other = client.post("/api/v1/attendance/punch", json={"employee_id": 2, "punch_type": "in"}, headers=headers)
    assert punch_other.status_code == 403


def test_employee_no_payroll_or_hr_admin_access():
    token = create_access_token({"user_id": 5, "email": "employee@peoplepay360.com", "role": ROLE_EMPLOYEE, "employee_id": 5})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Access payruns -> 403 Forbidden
    res_payruns = client.get("/api/v1/payroll/payruns", headers=headers)
    assert res_payruns.status_code == 403

    # 2. Access salary structures -> 403 Forbidden
    res_structs = client.get("/api/v1/payroll/structures", headers=headers)
    assert res_structs.status_code == 403

    # 3. Create employee contract -> 403 Forbidden
    res_contract = client.post("/api/v1/master-data/contracts", json={
        "employee_id": 5, "wage": 20000.00, "start_date": "2026-09-01"
    }, headers=headers)
    assert res_contract.status_code == 403

    # 4. Access user management -> 403 Forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403


# ==============================================================================
# Role 2: HR Manager Boundary Tests
# ==============================================================================

def test_hr_manager_full_hr_crud_but_no_payroll_access():
    token = create_access_token({"user_id": 2, "email": "hr@peoplepay360.com", "role": ROLE_HR_MANAGER, "employee_id": 2})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. HR Manager can list all employees -> 200 OK
    res_emp = client.get("/api/v1/master-data/employees", headers=headers)
    assert res_emp.status_code == 200
    assert len(res_emp.json()) >= 5

    # 2. HR Manager can list contracts -> 200 OK
    res_contracts = client.get("/api/v1/master-data/contracts", headers=headers)
    assert res_contracts.status_code == 200

    # 3. HR Manager CANNOT access payroll payruns -> 403 Forbidden
    res_payruns = client.get("/api/v1/payroll/payruns", headers=headers)
    assert res_payruns.status_code == 403

    # 4. HR Manager CANNOT access salary structures -> 403 Forbidden
    res_structs = client.get("/api/v1/payroll/structures", headers=headers)
    assert res_structs.status_code == 403

    # 5. HR Manager CANNOT access user management -> 403 Forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403


# ==============================================================================
# Role 3: HR Payroll User Boundary Tests
# ==============================================================================

def test_hr_payroll_user_payrun_access_and_readonly_structures():
    token = create_access_token({"user_id": 3, "email": "payrolluser@peoplepay360.com", "role": ROLE_HR_PAYROLL_USER, "employee_id": 3})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Can view payruns -> 200 OK
    res_payruns = client.get("/api/v1/payroll/payruns", headers=headers)
    assert res_payruns.status_code == 200

    # 2. Can view salary structures -> 200 OK (Read-only access)
    res_structs = client.get("/api/v1/payroll/structures", headers=headers)
    assert res_structs.status_code == 200

    # 3. CANNOT create salary structures -> 403 Forbidden (Read-only!)
    res_create_struct = client.post("/api/v1/payroll/structures", json={
        "name": "Unauthorized Structure", "code": "UNAUTH_CODE"
    }, headers=headers)
    assert res_create_struct.status_code == 403

    # 4. CANNOT delete payruns -> 403 Forbidden
    res_del_payrun = client.delete("/api/v1/payroll/payruns/999", headers=headers)
    assert res_del_payrun.status_code == 403

    # 5. CANNOT access user management -> 403 Forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403


# ==============================================================================
# Role 4: HR Payroll Manager Boundary Tests
# ==============================================================================

def test_hr_payroll_manager_full_payroll_crud_but_no_user_management():
    token = create_access_token({"user_id": 4, "email": "payrollmanager@peoplepay360.com", "role": ROLE_HR_PAYROLL_MANAGER, "employee_id": 4})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Full CRUD: Can create salary structure -> 201 Created
    res_create_struct = client.post("/api/v1/payroll/structures", json={
        "name": "Manager Structure", "code": "MGR_STRUCT_01"
    }, headers=headers)
    assert res_create_struct.status_code == 201
    struct_id = res_create_struct.json()["id"]

    # 2. Full CRUD: Can delete salary structure -> 204 No Content
    res_del_struct = client.delete(f"/api/v1/payroll/structures/{struct_id}", headers=headers)
    assert res_del_struct.status_code == 204

    # 3. CANNOT access user management -> 403 Forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403


# ==============================================================================
# Role 5: Admin Boundary Tests
# ==============================================================================

def test_admin_full_platform_and_user_management_access():
    token = create_access_token({"user_id": 1, "email": "admin@peoplepay360.com", "role": ROLE_ADMIN, "employee_id": 1})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Admin can list users -> 200 OK
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 200
    assert len(res_users.json()) >= 5

    # 2. Admin can create new user -> 201 Created
    new_user_payload = {
        "email": "newtestuser@peoplepay360.com",
        "password": "Password@123",
        "role": "employee",
        "is_active": True
    }
    res_create_user = client.post("/api/v1/auth/users", json=new_user_payload, headers=headers)
    assert res_create_user.status_code == 201
    new_user_id = res_create_user.json()["id"]

    # 3. Admin can update user role -> 200 OK
    res_update_role = client.put(f"/api/v1/auth/users/{new_user_id}/role", json={"role": "hr_manager"}, headers=headers)
    assert res_update_role.status_code == 200
    assert res_update_role.json()["role"] == "hr_manager"

    # 4. Admin can delete user -> 200 OK
    res_del_user = client.delete(f"/api/v1/auth/users/{new_user_id}", headers=headers)
    assert res_del_user.status_code == 200

    # 5. Admin can access payroll structures -> 200 OK
    res_structs = client.get("/api/v1/payroll/structures", headers=headers)
    assert res_structs.status_code == 200
