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

def test_hr_payroll_user_has_all_hr_manager_permissions():
    token = create_access_token({"user_id": 3, "email": "payrolluser@peoplepay360.com", "role": ROLE_HR_PAYROLL_USER, "employee_id": 3})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Full CRUD to Employees: can list employees
    res_emp = client.get("/api/v1/master-data/employees", headers=headers)
    assert res_emp.status_code == 200

    # 2. Full CRUD to Contracts: can list contracts
    res_contracts = client.get("/api/v1/master-data/contracts", headers=headers)
    assert res_contracts.status_code == 200

    # 3. Full CRUD to Working Schedules / Shifts: can list shifts
    res_shifts = client.get("/api/v1/attendance/shifts", headers=headers)
    assert res_shifts.status_code == 200

    # 4. Full CRUD to Attendance: can view daily summary
    res_punches = client.get("/api/v1/attendance/daily-summary", headers=headers)
    assert res_punches.status_code == 200

    # 5. Full CRUD to Time Off: can view leave requests
    res_leaves = client.get("/api/v1/master-data/leave-requests", headers=headers)
    assert res_leaves.status_code == 200


def test_hr_payroll_user_payrun_access_and_readonly_structures():
    token = create_access_token({"user_id": 3, "email": "payrolluser@peoplepay360.com", "role": ROLE_HR_PAYROLL_USER, "employee_id": 3})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Can view payruns -> 200 OK
    res_payruns = client.get("/api/v1/payroll/payruns", headers=headers)
    assert res_payruns.status_code == 200

    # 2. Can view payslips -> 200 OK
    res_slips = client.get("/api/v1/payroll/payslips", headers=headers)
    assert res_slips.status_code == 200

    # 3. Can validate / create payruns via wizard -> 200 OK
    res_wizard = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
        "name": "September 2026 Test Payrun",
        "date_start": "2026-09-01",
        "date_end": "2026-09-30",
        "structure_id": 1,
    }, headers=headers)
    assert res_wizard.status_code == 200

    # 4. Read-only Salary Structures: Can view salary structures -> 200 OK
    res_structs = client.get("/api/v1/payroll/structures", headers=headers)
    assert res_structs.status_code == 200

    # 5. Read-only Salary Structures: Can view specific structure detail -> 200 OK
    res_struct_detail = client.get("/api/v1/payroll/structures/1", headers=headers)
    assert res_struct_detail.status_code == 200

    # 6. CANNOT create salary structures -> 403 Forbidden (Read-only!)
    res_create_struct = client.post("/api/v1/payroll/structures", json={
        "name": "Unauthorized Structure", "code": "UNAUTH_CODE"
    }, headers=headers)
    assert res_create_struct.status_code == 403

    # 7. CANNOT update salary structures -> 403 Forbidden (Read-only!)
    res_update_struct = client.put("/api/v1/payroll/structures/1", json={
        "name": "Modified Structure"
    }, headers=headers)
    assert res_update_struct.status_code == 403

    # 8. CANNOT delete salary structures -> 403 Forbidden (Read-only!)
    res_del_struct = client.delete("/api/v1/payroll/structures/1", headers=headers)
    assert res_del_struct.status_code == 403

    # 9. CANNOT add salary rule -> 403 Forbidden (Read-only!)
    res_add_rule = client.post("/api/v1/payroll/structures/1/rules", json={
        "name": "Special Allowance", "code": "SPEC_ALW", "category": "ALLOWANCE", "sequence": 20, "amount_type": "fixed", "amount": 1000
    }, headers=headers)
    assert res_add_rule.status_code == 403

    # 10. CANNOT delete payruns -> 403 Forbidden
    res_del_payrun = client.delete("/api/v1/payroll/payruns/999", headers=headers)
    assert res_del_payrun.status_code == 403

    # 11. CANNOT access user management -> 403 Forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403


# ==============================================================================
# Role 4: HR Payroll Manager Boundary Tests
# ==============================================================================

def test_hr_payroll_manager_has_all_hr_payroll_user_permissions():
    token = create_access_token({"user_id": 4, "email": "payrollmanager@peoplepay360.com", "role": ROLE_HR_PAYROLL_MANAGER, "employee_id": 4})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Full HR access: employees, contracts, shifts, attendance, time off
    assert client.get("/api/v1/master-data/employees", headers=headers).status_code == 200
    assert client.get("/api/v1/master-data/contracts", headers=headers).status_code == 200
    assert client.get("/api/v1/attendance/shifts", headers=headers).status_code == 200
    assert client.get("/api/v1/attendance/daily-summary", headers=headers).status_code == 200
    assert client.get("/api/v1/master-data/leave-requests", headers=headers).status_code == 200

    # 2. Payruns and payslips read access
    assert client.get("/api/v1/payroll/payruns", headers=headers).status_code == 200
    assert client.get("/api/v1/payroll/payslips", headers=headers).status_code == 200


def test_hr_payroll_manager_full_payroll_crud_but_no_user_management():
    token = create_access_token({"user_id": 4, "email": "payrollmanager@peoplepay360.com", "role": ROLE_HR_PAYROLL_MANAGER, "employee_id": 4})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Full CRUD Structures: Create
    res_create_struct = client.post("/api/v1/payroll/structures", json={
        "name": "Manager Structure", "code": "MGR_STRUCT_01"
    }, headers=headers)
    assert res_create_struct.status_code == 201
    struct_id = res_create_struct.json()["id"]

    # 2. Full CRUD Structures: Read
    res_get_struct = client.get(f"/api/v1/payroll/structures/{struct_id}", headers=headers)
    assert res_get_struct.status_code == 200

    # 3. Full CRUD Structures: Update
    res_update_struct = client.put(f"/api/v1/payroll/structures/{struct_id}", json={
        "name": "Manager Structure Updated"
    }, headers=headers)
    assert res_update_struct.status_code == 200

    # 4. Full CRUD Rules: Create rule
    res_add_rule = client.post(f"/api/v1/payroll/structures/{struct_id}/rules", json={
        "structure_id": struct_id,
        "name": "Manager Special Bonus",
        "code": "MGR_BONUS",
        "category": "ALLOWANCE",
        "sequence": 15,
        "amount_type": "fixed",
        "amount": 5000,
    }, headers=headers)
    assert res_add_rule.status_code == 201
    rule_id = res_add_rule.json()["id"]

    # 5. Full CRUD Rules: Update rule
    res_update_rule = client.put(f"/api/v1/payroll/rules/{rule_id}", json={
        "name": "Manager Performance Bonus",
        "amount": 6000,
    }, headers=headers)
    assert res_update_rule.status_code == 200

    # 6. Full CRUD Rules: Delete rule
    res_del_rule = client.delete(f"/api/v1/payroll/rules/{rule_id}", headers=headers)
    assert res_del_rule.status_code == 204

    # 7. Full CRUD Structures: Delete
    res_del_struct = client.delete(f"/api/v1/payroll/structures/{struct_id}", headers=headers)
    assert res_del_struct.status_code == 204

    # 8. Full control over HR & Payroll metrics & analytics
    res_metrics = client.get("/api/v1/payroll/metrics", headers=headers)
    assert res_metrics.status_code == 200
    res_analytics = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert res_analytics.status_code == 200

    # 9. REMOVE THE REST: User management & system administration are strictly forbidden
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 403
    res_create_user = client.post("/api/v1/auth/users", json={
        "email": "hacker@test.com", "password": "Password@123", "role": "employee"
    }, headers=headers)
    assert res_create_user.status_code == 403


# ==============================================================================
# Role 5: Admin Boundary Tests
# ==============================================================================

def test_admin_full_platform_and_user_management_access():
    token = create_access_token({"user_id": 1, "email": "admin@peoplepay360.com", "role": ROLE_ADMIN, "employee_id": 1})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. User Management: Admin can list users -> 200 OK
    res_users = client.get("/api/v1/auth/users", headers=headers)
    assert res_users.status_code == 200
    assert len(res_users.json()) >= 5

    # 2. User Management: Admin can create new user -> 201 Created
    new_user_payload = {
        "email": "newtestuser@peoplepay360.com",
        "password": "Password@123",
        "role": "employee",
        "is_active": True
    }
    res_create_user = client.post("/api/v1/auth/users", json=new_user_payload, headers=headers)
    assert res_create_user.status_code == 201
    new_user_id = res_create_user.json()["id"]

    # 3. Role Assignment & Permission Updates: Admin can update user role -> 200 OK
    res_update_role = client.put(f"/api/v1/auth/users/{new_user_id}/role", json={"role": "hr_manager"}, headers=headers)
    assert res_update_role.status_code == 200
    assert res_update_role.json()["role"] == "hr_manager"

    # 4. Status Toggle: Admin can activate / deactivate accounts -> 200 OK
    res_status = client.put(f"/api/v1/auth/users/{new_user_id}/status", json={"is_active": False}, headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["is_active"] is False

    # 5. User Management: Admin can delete user -> 200 OK
    res_del_user = client.delete(f"/api/v1/auth/users/{new_user_id}", headers=headers)
    assert res_del_user.status_code == 200

    # 6. Full Access across all platform modules & models:
    assert client.get("/api/v1/master-data/employees", headers=headers).status_code == 200
    assert client.get("/api/v1/master-data/contracts", headers=headers).status_code == 200
    assert client.get("/api/v1/master-data/leave-requests", headers=headers).status_code == 200
    assert client.get("/api/v1/attendance/shifts", headers=headers).status_code == 200
    assert client.get("/api/v1/attendance/daily-summary", headers=headers).status_code == 200
    assert client.get("/api/v1/payroll/payruns", headers=headers).status_code == 200
    assert client.get("/api/v1/payroll/payslips", headers=headers).status_code == 200
    assert client.get("/api/v1/payroll/structures", headers=headers).status_code == 200
    assert client.get("/api/v1/payroll/metrics", headers=headers).status_code == 200
    assert client.get("/api/v1/analytics/dashboard", headers=headers).status_code == 200
    assert client.get("/api/v1/expenses", headers=headers).status_code == 200
    assert client.get("/api/v1/loans", headers=headers).status_code == 200
    assert client.get("/api/v1/tax/declarations", headers=headers).status_code == 200
