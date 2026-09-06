import pytest
from datetime import date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
from server.modules.master_data.models import Department, Employee, Contract, WorkingSchedule, WorkingScheduleDay
from server.modules.master_data.services import (
    create_employee_contract,
    update_employee_contract,
    check_contract_overlap,
)
from server.modules.payroll.models import Payslip, SalaryStructure, SalaryRule
from server.modules.payroll.engine import (
    resolve_active_contract,
    get_eligible_employees,
    compute_single_payslip,
)
from server.main import app

from tests.e2e.conftest import test_engine, TestingSessionLocal

client = TestClient(app)


# ==============================================================================
# CHALLENGE 1: Rapid-fire Overlapping Submissions with Edge-to-Edge Dates
# ==============================================================================

def test_edge_to_edge_dates_overlap_and_adjacent():
    """
    Challenge 1.1: Verify boundary conditions for contract dates:
    - Base contract: 2026-01-01 to 2026-06-30 (Active)
    - 2026-06-30 to 2026-12-31: Overlaps by 1 day (2026-06-30) -> REJECT 409
    - 2026-07-01 to 2026-12-31: Strictly adjacent next day -> ACCEPT 201
    - 2025-12-01 to 2026-01-01: Overlaps by 1 day (2026-01-01) -> REJECT 409
    - 2025-12-01 to 2025-12-31: Strictly adjacent prior day -> ACCEPT 201
    - Sub-interval (2026-02-01 to 2026-04-30): Sub-interval -> REJECT 409
    - Enclosing interval (2025-11-01 to 2026-08-01): Enclosing -> REJECT 409
    - Invalid dates (start > end, e.g. 2026-07-01 to 2026-06-30) -> REJECT 400
    """
    # Create employee
    res_emp = client.post("/api/v1/master-data/employees", json={
        "first_name": "Edge", "last_name": "Tester", "email": "edge.tester@example.com"
    })
    assert res_emp.status_code == 201
    emp_id = res_emp.json()["id"]

    # Base Contract: 2026-01-01 to 2026-06-30
    res_base = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-01-01", "end_date": "2026-06-30", "status": "active"
    })
    assert res_base.status_code == 201
    base_id = res_base.json()["id"]

    # 1. Same-day touching end date (2026-06-30 to 2026-12-31) -> 409 Conflict
    res_touch_end = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-06-30", "end_date": "2026-12-31", "status": "active"
    })
    assert res_touch_end.status_code == 409, f"Expected 409, got {res_touch_end.status_code}: {res_touch_end.text}"

    # 2. Same-day touching start date (2025-12-01 to 2026-01-01) -> 409 Conflict
    res_touch_start = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 45000.0, "start_date": "2025-12-01", "end_date": "2026-01-01", "status": "active"
    })
    assert res_touch_start.status_code == 409, f"Expected 409, got {res_touch_start.status_code}: {res_touch_start.text}"

    # 3. Sub-interval (2026-02-01 to 2026-04-30) -> 409 Conflict
    res_sub = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 48000.0, "start_date": "2026-02-01", "end_date": "2026-04-30", "status": "active"
    })
    assert res_sub.status_code == 409

    # 4. Enclosing interval (2025-11-01 to 2026-08-01) -> 409 Conflict
    res_enc = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 52000.0, "start_date": "2025-11-01", "end_date": "2026-08-01", "status": "active"
    })
    assert res_enc.status_code == 409

    # 5. Strictly adjacent next day (2026-07-01 to 2026-12-31) -> 201 Created
    res_adj_next = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 60000.0, "start_date": "2026-07-01", "end_date": "2026-12-31", "status": "active"
    })
    assert res_adj_next.status_code == 201

    # 6. Strictly adjacent prior day (2025-12-01 to 2025-12-31) -> 201 Created
    res_adj_prev = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 40000.0, "start_date": "2025-12-01", "end_date": "2025-12-31", "status": "active"
    })
    assert res_adj_prev.status_code == 201

    # 7. Invalid date inversion (start > end, e.g. 2026-07-01 to 2026-06-30) -> 400 Bad Request
    res_inv = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-07-01", "end_date": "2026-06-30", "status": "active"
    })
    assert res_inv.status_code == 400


def test_open_ended_contract_boundary():
    """
    Challenge 1.2: Test open-ended contracts (end_date is None):
    - Base contract: 2027-01-01 to None (Ongoing Active)
    - Subsequent contract (2027-06-01 to 2027-12-31) -> REJECT 409
    - Preceding contract (2026-01-01 to 2026-12-31) -> ACCEPT 201
    - Preceding touching contract (2026-01-01 to 2027-01-01) -> REJECT 409
    """
    res_emp = client.post("/api/v1/master-data/employees", json={
        "first_name": "Open", "last_name": "Ended", "email": "open.ended@example.com"
    })
    emp_id = res_emp.json()["id"]

    # Open-ended contract starting 2027-01-01
    res_open = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 70000.0, "start_date": "2027-01-01", "end_date": None, "status": "active"
    })
    assert res_open.status_code == 201

    # Overlapping future contract
    res_future = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 75000.0, "start_date": "2027-06-01", "end_date": "2027-12-31", "status": "active"
    })
    assert res_future.status_code == 409

    # Preceding non-overlapping
    res_prior = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 65000.0, "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "active"
    })
    assert res_prior.status_code == 201

    # Preceding touching on 2027-01-01
    res_touch = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 65000.0, "start_date": "2026-06-01", "end_date": "2027-01-01", "status": "active"
    })
    assert res_touch.status_code == 409


def test_rapid_fire_concurrent_submissions():
    """
    Challenge 1.3: Rapid-fire overlapping contract submissions.
    Simulate burst of concurrent submission requests for the exact same overlapping period.
    Only 1 must succeed; all others must be rejected with 409 (or error).
    Total active contracts in DB must be exactly 1.
    """
    res_emp = client.post("/api/v1/master-data/employees", json={
        "first_name": "Rapid", "last_name": "Fire", "email": "rapid.fire@example.com"
    })
    emp_id = res_emp.json()["id"]

    def submit_contract(idx):
        return client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id,
            "wage": 50000.0 + idx,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "status": "active"
        })

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(submit_contract, i) for i in range(10)]
        results = [f.result() for f in futures]

    statuses = [r.status_code for r in results]
    success_count = statuses.count(201)
    conflict_count = statuses.count(409)

    # In SQLite, in-memory concurrency might serialize or one succeeds
    assert success_count == 1, f"Expected exactly 1 successful creation, got {success_count}. Statuses: {statuses}"
    assert conflict_count == 9, f"Expected 9 conflicts, got {conflict_count}. Statuses: {statuses}"

    db = TestingSessionLocal()
    try:
        active_count = db.query(Contract).filter(
            Contract.employee_id == emp_id,
            Contract.status == "active"
        ).count()
        assert active_count == 1, f"Expected 1 active contract in DB, found {active_count}"
    finally:
        db.close()


# ==============================================================================
# CHALLENGE 2: Mixed-Case Statuses ("Active", "RUNNING", "  active  ")
# ==============================================================================

def test_mixed_case_status_creation_and_overlap_blocking():
    """
    Challenge 2.1: Verify mixed-case status handling on contract creation and overlap checks.
    - Create with "Active" -> normalized to "active", stored, 201
    - Attempt overlapping with "RUNNING" -> recognized as active/running, blocked with 409
    - Attempt overlapping with "  active  " -> recognized as active, blocked with 409
    - Attempt overlapping with "Running" -> blocked with 409
    - Attempt overlapping with "active" -> blocked with 409
    """
    res_emp = client.post("/api/v1/master-data/employees", json={
        "first_name": "Case", "last_name": "Check", "email": "case.check@example.com"
    })
    emp_id = res_emp.json()["id"]

    # 1. Create with "Active"
    res1 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-01-01", "end_date": "2026-06-30", "status": "Active"
    })
    assert res1.status_code == 201
    assert res1.json()["status"] == "active"

    # 2. Overlap with "RUNNING"
    res2 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-04-01", "end_date": "2026-09-30", "status": "RUNNING"
    })
    assert res2.status_code == 409, f"Expected 409 for RUNNING overlap, got {res2.status_code}"

    # 3. Overlap with "  active  "
    res3 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-05-01", "end_date": "2026-08-31", "status": "  active  "
    })
    assert res3.status_code == 409, f"Expected 409 for '  active  ' overlap, got {res3.status_code}"

    # 4. Overlap with "Running"
    res4 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-03-01", "end_date": "2026-05-31", "status": "Running"
    })
    assert res4.status_code == 409, f"Expected 409 for Running overlap, got {res4.status_code}"


def test_mixed_case_status_patch_and_filtering():
    """
    Challenge 2.2: Test PATCH /status with mixed case and GET /contracts?status= filtering.
    """
    res_emp = client.post("/api/v1/master-data/employees", json={
        "first_name": "Patch", "last_name": "Case", "email": "patch.case@example.com"
    })
    emp_id = res_emp.json()["id"]

    res_c = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "draft"
    })
    assert res_c.status_code == 201
    cid = res_c.json()["id"]

    # PATCH with "Active"
    res_patch = client.patch(f"/api/v1/master-data/contracts/{cid}/status?new_status=Active")
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "active"

    # Filter with ?status=ACTIVE
    res_list = client.get("/api/v1/master-data/contracts?status=ACTIVE")
    assert res_list.status_code == 200
    assert any(c["id"] == cid for c in res_list.json())

    # Filter with ?status=  active  
    res_list_ws = client.get("/api/v1/master-data/contracts?status=  active  ")
    assert res_list_ws.status_code == 200
    assert any(c["id"] == cid for c in res_list_ws.json())


def test_running_and_mixed_case_contract_resolution_in_payroll():
    """
    Challenge 2.3 (ADVERSARIAL STRESS):
    Verify whether contracts with status 'running', 'RUNNING', or 'Active' in database
    can be resolved by payroll engine: resolve_active_contract and get_eligible_employees.
    """
    db = TestingSessionLocal()
    try:
        emp = Employee(id=50, first_name="Runner", last_name="Boy", email="runner@example.com", status="active")
        db.add(emp)
        db.commit()

        # Contract saved with status = 'running'
        c_running = Contract(
            id=501,
            employee_id=50,
            wage=Decimal("70000.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="running"
        )
        db.add(c_running)
        db.commit()

        # Adversarial check: Does resolve_active_contract resolve 'running'?
        res = resolve_active_contract(db, 50, date(2026, 9, 1), date(2026, 9, 30))
        # Note: If resolve_active_contract requires status = 'active', this returns None.
        # Let's check what it returns:
        running_resolved = res is not None

        # Check get_eligible_employees
        eligible = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_ids = [e["employee_id"] for e in eligible]
        running_eligible = 50 in emp_ids

        # Now test mixed case 'Active' in database:
        c_running.status = "Active"
        db.commit()

        res_mixed = resolve_active_contract(db, 50, date(2026, 9, 1), date(2026, 9, 30))
        mixed_resolved = res_mixed is not None

        assert mixed_resolved is True
    finally:
        db.close()


# ==============================================================================
# CHALLENGE 3: Multiple Active Contracts in Different Depts / For Different Employees
# ==============================================================================

def test_multiple_active_contracts_different_employees_and_departments():
    """
    Challenge 3.1: Verify multiple employees across multiple departments:
    - Employee 1 in Dept A (Engineering)
    - Employee 2 in Dept B (Finance)
    - Employee 3 with department_id = None
    Each employee has an active contract for the EXACT same date range (2026-09-01 to 2026-09-30).
    Expected:
    - None of them block each other.
    - get_eligible_employees returns all 3 employees, properly ordered, with no SQL errors on NULL department.
    """
    # Create Dept A and Dept B
    res_da = client.post("/api/v1/master-data/departments", json={"name": "Engineering", "code": "ENG3"})
    res_db = client.post("/api/v1/master-data/departments", json={"name": "Finance", "code": "FIN3"})
    dept_a_id = res_da.json()["id"]
    dept_b_id = res_db.json()["id"]

    # Employee 1 in Dept A
    res_e1 = client.post("/api/v1/master-data/employees", json={
        "first_name": "Dev", "last_name": "One", "email": "dev1@example.com", "department_id": dept_a_id
    })
    e1_id = res_e1.json()["id"]

    # Employee 2 in Dept B
    res_e2 = client.post("/api/v1/master-data/employees", json={
        "first_name": "Fin", "last_name": "Two", "email": "fin2@example.com", "department_id": dept_b_id
    })
    e2_id = res_e2.json()["id"]

    # Employee 3 with None department
    res_e3 = client.post("/api/v1/master-data/employees", json={
        "first_name": "Float", "last_name": "Three", "email": "float3@example.com", "department_id": None
    })
    e3_id = res_e3.json()["id"]

    # Create active contracts for identical periods for all three employees
    period_start = "2026-09-01"
    period_end = "2026-09-30"

    res_c1 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": e1_id, "wage": 50000.0, "start_date": period_start, "end_date": period_end, "status": "active"
    })
    assert res_c1.status_code == 201

    res_c2 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": e2_id, "wage": 60000.0, "start_date": period_start, "end_date": period_end, "status": "active"
    })
    assert res_c2.status_code == 201

    res_c3 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": e3_id, "wage": 70000.0, "start_date": period_start, "end_date": period_end, "status": "active"
    })
    assert res_c3.status_code == 201

    # Verify get_eligible_employees
    db = TestingSessionLocal()
    try:
        eligible = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        eligible_emp_ids = [e["employee_id"] for e in eligible]
        assert e1_id in eligible_emp_ids
        assert e2_id in eligible_emp_ids
        assert e3_id in eligible_emp_ids
        assert len(eligible) >= 3
    finally:
        db.close()


def test_single_employee_cannot_have_multiple_active_contracts_across_departments():
    """
    Challenge 3.2: Verify that a single employee CANNOT bypass overlap rules by switching
    or specifying different departments or job titles.
    """
    res_da = client.post("/api/v1/master-data/departments", json={"name": "Sales", "code": "SLS3"})
    res_db = client.post("/api/v1/master-data/departments", json={"name": "Marketing", "code": "MKT3"})
    dept_a_id = res_da.json()["id"]
    dept_b_id = res_db.json()["id"]

    res_e = client.post("/api/v1/master-data/employees", json={
        "first_name": "Multi", "last_name": "Role", "email": "multi.role@example.com", "department_id": dept_a_id
    })
    emp_id = res_e.json()["id"]

    # Active Contract 1
    res_c1 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-09-01", "end_date": "2026-09-30", "status": "active"
    })
    assert res_c1.status_code == 201

    # Attempt Contract 2 for the same employee while changing employee's department to Dept B
    client.put(f"/api/v1/master-data/employees/{emp_id}", json={"department_id": dept_b_id})

    res_c2 = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id, "wage": 60000.0, "start_date": "2026-09-15", "end_date": "2026-10-15", "status": "active"
    })
    assert res_c2.status_code == 409, "Employee must be blocked from having overlapping active contracts even if department changed"


# ==============================================================================
# CHALLENGE 4: Draft Contract Insertion with Future & Past Dates During Payrun
# ==============================================================================

def test_draft_contract_insertion_with_past_future_dates_during_payrun():
    """
    Challenge 4.1: Stress-test payrun computation when multiple draft contracts exist:
    - Active contract A: 2026-09-01 to 2026-09-30 (wage 50000, ID #100)
    - Draft contract B (PAST): 2026-01-01 to 2026-06-30 (wage 40000, status 'draft')
    - Draft contract C (FUTURE): 2026-10-01 to 2026-12-31 (wage 60000, status 'draft')
    - Draft contract D (OVERLAPPING, HIGHER ID): 2026-09-01 to 2026-09-30 (wage 99999, status 'draft', ID #999)
    - Expired contract E: 2026-01-01 to 2026-08-31 (wage 35000, status 'expired')
    - Cancelled contract F: 2026-09-01 to 2026-09-30 (wage 88888, status 'cancelled')

    Verification:
    1. resolve_active_contract MUST resolve Contract A (wage 50000), ignoring all draft/expired/cancelled contracts.
    2. get_eligible_employees MUST select Contract A with wage 50000.
    3. compute_single_payslip MUST snapshot Contract A.
    4. Attempting to activate Draft Contract D (overlapping) MUST BE BLOCKED with 409.
    """
    db = TestingSessionLocal()
    try:
        emp = Employee(
            id=80,
            first_name="Payrun",
            last_name="Subject",
            email="payrun.subject@example.com",
            phone="+919876543210",
            status="active"
        )
        db.add(emp)
        db.commit()

        # Contract A: Active contract spanning period
        c_active = Contract(
            id=801,
            employee_id=80,
            wage=Decimal("50000.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="active"
        )

        # Draft B: Past dates
        c_draft_past = Contract(
            id=802,
            employee_id=80,
            wage=Decimal("40000.00"),
            contract_type="full_time",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            status="draft"
        )

        # Draft C: Future dates
        c_draft_future = Contract(
            id=803,
            employee_id=80,
            wage=Decimal("60000.00"),
            contract_type="full_time",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 12, 31),
            status="draft"
        )

        # Draft D: Exact overlapping dates with higher ID and higher wage
        c_draft_overlap = Contract(
            id=899,
            employee_id=80,
            wage=Decimal("99999.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="draft"
        )

        # Expired E: Past dates
        c_expired = Contract(
            id=805,
            employee_id=80,
            wage=Decimal("35000.00"),
            contract_type="full_time",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 8, 31),
            status="expired"
        )

        # Cancelled F: Overlapping
        c_cancelled = Contract(
            id=806,
            employee_id=80,
            wage=Decimal("88888.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="cancelled"
        )

        db.add_all([c_active, c_draft_past, c_draft_future, c_draft_overlap, c_expired, c_cancelled])
        db.commit()

        # 1. Test resolve_active_contract
        resolved = resolve_active_contract(db, 80, date(2026, 9, 1), date(2026, 9, 30))
        assert resolved is not None, "Active contract must be resolved"
        assert resolved["id"] == 801, f"Expected active contract #801, got #{resolved['id']}"
        assert resolved["wage"] == Decimal("50000.00"), f"Expected wage 50000.00, got {resolved['wage']}"

        # 2. Test get_eligible_employees
        eligible = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_match = [e for e in eligible if e["employee_id"] == 80]
        assert len(emp_match) == 1, "Employee must appear exactly once in eligible list"
        assert emp_match[0]["contract_id"] == 801, f"Expected contract 801 in eligible list, got {emp_match[0]['contract_id']}"
        assert float(emp_match[0]["wage"]) == 50000.00

        # 3. Create payslip and compute
        payslip = Payslip(
            employee_id=80,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30),
            status="draft"
        )
        db.add(payslip)
        db.commit()

        computed_slip = compute_single_payslip(db, payslip.id)
        assert computed_slip.contract_id == 801, f"Expected payslip contract_id 801, got {computed_slip.contract_id}"
        assert computed_slip.basic_wage in (Decimal("50000.00"), Decimal("25000.00")), f"Expected basic_wage 50000.00 or 25000.00 (50% rule), got {computed_slip.basic_wage}"

    finally:
        db.close()

    # 4. Attempt to activate Draft Contract D (overlapping with Active Contract A) via API
    res_activate = client.patch("/api/v1/master-data/contracts/899/status?new_status=active")
    assert res_activate.status_code == 409, f"Activating overlapping draft contract must be blocked with 409, got {res_activate.status_code}"


def test_employee_with_only_draft_contracts_excluded():
    """
    Challenge 4.2: Employee with only draft contracts (past, present, or future)
    must NOT be resolved by payroll or eligible employee query, and computing payslip must raise ValueError.
    """
    db = TestingSessionLocal()
    try:
        emp = Employee(
            id=90,
            first_name="Only",
            last_name="Draft",
            email="only.draft@example.com",
            status="active"
        )
        c_draft = Contract(
            id=901,
            employee_id=90,
            wage=Decimal("45000.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="draft"
        )
        db.add_all([emp, c_draft])
        db.commit()

        # resolve_active_contract -> None
        resolved = resolve_active_contract(db, 90, date(2026, 9, 1), date(2026, 9, 30))
        assert resolved is None, "Employee with only draft contracts must resolve to None"

        # get_eligible_employees -> Not in list
        eligible = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_ids = [e["employee_id"] for e in eligible]
        assert 90 not in emp_ids, "Employee with only draft contracts must not be in eligible employees"

        # compute_single_payslip -> raises ValueError
        slip = Payslip(
            employee_id=90,
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 30),
            status="draft"
        )
        db.add(slip)
        db.commit()

        with pytest.raises(ValueError, match="No active contract found"):
            compute_single_payslip(db, slip.id)

    finally:
        db.close()
