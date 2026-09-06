import sys
import traceback
from datetime import date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
from server.modules.master_data.models import Department, Employee, Contract, WorkingSchedule, WorkingScheduleDay
from server.modules.payroll.models import Payslip, SalaryStructure, SalaryRule
from server.modules.payroll.engine import (
    resolve_active_contract,
    get_eligible_employees,
    compute_single_payslip,
)
from server.main import app

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def clean_db():
    db = TestingSessionLocal()
    try:
        db.query(Payslip).delete()
        db.query(SalaryRule).delete()
        db.query(SalaryStructure).delete()
        db.query(Contract).delete()
        db.query(WorkingScheduleDay).delete()
        db.query(WorkingSchedule).delete()
        db.query(Employee).delete()
        db.query(Department).delete()
        db.commit()
    finally:
        db.close()

def run_all_challenges():
    print("=" * 70)
    print("STARTING EMPIRICAL ADVERSARIAL STRESS SUITE FOR MILESTONE 1 (R1.1, R1.2)")
    print("=" * 70)
    results = {}

    # -------------------------------------------------------------
    # Challenge 1: Edge-to-Edge & Rapid Fire Overlap
    # -------------------------------------------------------------
    try:
        clean_db()
        print("\n[CHALLENGE 1.1] Testing Edge-to-Edge boundary dates...")
        res_emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Edge", "last_name": "Tester", "email": "edge.tester@example.com"
        })
        assert res_emp.status_code == 201
        emp_id = res_emp.json()["id"]

        # Base: 2026-01-01 to 2026-06-30
        res_base = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-01-01", "end_date": "2026-06-30", "status": "active"
        })
        assert res_base.status_code == 201

        # Same day touch end (2026-06-30 to 2026-12-31) -> 409
        res1 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-06-30", "end_date": "2026-12-31", "status": "active"
        })
        assert res1.status_code == 409, f"Expected 409 on 2026-06-30 overlap, got {res1.status_code}"

        # Same day touch start (2025-12-01 to 2026-01-01) -> 409
        res2 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 45000.0, "start_date": "2025-12-01", "end_date": "2026-01-01", "status": "active"
        })
        assert res2.status_code == 409, f"Expected 409 on 2026-01-01 overlap, got {res2.status_code}"

        # Strictly adjacent next day (2026-07-01 to 2026-12-31) -> 201
        res3 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 60000.0, "start_date": "2026-07-01", "end_date": "2026-12-31", "status": "active"
        })
        assert res3.status_code == 201, f"Expected 201 for adjacent next day, got {res3.status_code}"

        # Strictly adjacent prior day (2025-12-01 to 2025-12-31) -> 201
        res4 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 40000.0, "start_date": "2025-12-01", "end_date": "2025-12-31", "status": "active"
        })
        assert res4.status_code == 201, f"Expected 201 for adjacent prior day, got {res4.status_code}"

        print("  --> PASS: Edge-to-edge date boundaries strictly validated (409 on shared border, 201 on adjacent).")
        results["1.1_edge_to_edge_dates"] = "PASS"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["1.1_edge_to_edge_dates"] = f"FAIL: {e}"

    try:
        clean_db()
        print("\n[CHALLENGE 1.2] Testing Rapid-fire concurrent overlapping contract submissions...")
        res_emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Burst", "last_name": "User", "email": "burst@example.com"
        })
        emp_id = res_emp.json()["id"]

        def post_c(i):
            return client.post("/api/v1/master-data/contracts", json={
                "employee_id": emp_id, "wage": 50000.0 + i, "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "active"
            })

        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = [ex.submit(post_c, i) for i in range(10)]
            resps = [f.result() for f in futs]

        sc = [r.status_code for r in resps]
        successes = sc.count(201)
        conflicts = sc.count(409)
        print(f"  Burst status codes: 201 count = {successes}, 409 count = {conflicts}")
        assert successes == 1, f"Expected exactly 1 successful creation, got {successes}"
        assert conflicts == 9, f"Expected 9 conflicts, got {conflicts}"

        db = TestingSessionLocal()
        c_count = db.query(Contract).filter(Contract.employee_id == emp_id, Contract.status == "active").count()
        db.close()
        assert c_count == 1, f"Expected 1 active contract in DB, got {c_count}"
        print("  --> PASS: Concurrency stress handled: exactly 1 active contract created, 9 rejected.")
        results["1.2_rapid_fire_concurrency"] = "PASS"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["1.2_rapid_fire_concurrency"] = f"FAIL: {e}"

    # -------------------------------------------------------------
    # Challenge 2: Mixed-case statuses
    # -------------------------------------------------------------
    try:
        clean_db()
        print("\n[CHALLENGE 2.1] Testing Mixed-Case Statuses ('Active', 'RUNNING', '  active  ')...")
        res_emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Case", "last_name": "User", "email": "case@example.com"
        })
        emp_id = res_emp.json()["id"]

        # Create with "Active"
        r1 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 50000.0, "start_date": "2026-01-01", "end_date": "2026-06-30", "status": "Active"
        })
        assert r1.status_code == 201
        assert r1.json()["status"] == "active"
        c1_id = r1.json()["id"]

        # Overlap with "RUNNING"
        r2 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-04-01", "end_date": "2026-09-30", "status": "RUNNING"
        })
        assert r2.status_code == 409, f"Expected 409 for RUNNING overlap, got {r2.status_code}"

        # Overlap with "  active  "
        r3 = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 55000.0, "start_date": "2026-05-01", "end_date": "2026-08-31", "status": "  active  "
        })
        assert r3.status_code == 409, f"Expected 409 for '  active  ' overlap, got {r3.status_code}"

        # Patch status with "Running"
        # First create a draft adjacent contract
        r_draft = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp_id, "wage": 60000.0, "start_date": "2026-07-01", "end_date": "2026-12-31", "status": "draft"
        })
        assert r_draft.status_code == 201
        draft_id = r_draft.json()["id"]

        r_patch = client.patch(f"/api/v1/master-data/contracts/{draft_id}/status?new_status=Running")
        assert r_patch.status_code == 200
        assert r_patch.json()["status"] == "running"

        # Filter GET /contracts?status=RUNNING
        r_filt = client.get("/api/v1/master-data/contracts?status=RUNNING")
        assert r_filt.status_code == 200
        assert any(c["id"] == draft_id for c in r_filt.json())

        print("  --> PASS: Mixed-case normalization, overlap rejection, patch, and filtering verified.")
        results["2.1_mixed_case_status_handling"] = "PASS"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["2.1_mixed_case_status_handling"] = f"FAIL: {e}"

    try:
        clean_db()
        print("\n[CHALLENGE 2.2] Testing Status Consistency in Payroll Resolution...")
        db = TestingSessionLocal()
        emp = Employee(id=60, first_name="Consistency", last_name="Test", email="consist@example.com", status="active")
        db.add(emp)
        db.commit()

        # Contract with status='running'
        c_run = Contract(
            id=601,
            employee_id=60,
            wage=Decimal("75000.00"),
            contract_type="full_time",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="running"
        )
        db.add(c_run)
        db.commit()

        resolved_running = resolve_active_contract(db, 60, date(2026, 9, 1), date(2026, 9, 30))
        eligible_running = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_ids = [e["employee_id"] for e in eligible_running]

        print(f"  Contract with status='running': resolved = {resolved_running is not None}, in get_eligible_employees = {60 in emp_ids}")

        # Contract with status='active'
        c_run.status = "active"
        db.commit()
        resolved_active = resolve_active_contract(db, 60, date(2026, 9, 1), date(2026, 9, 30))
        eligible_active = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_ids_active = [e["employee_id"] for e in eligible_active]
        print(f"  Contract with status='active': resolved = {resolved_active is not None}, in get_eligible_employees = {60 in emp_ids_active}")

        assert resolved_active is not None
        assert 60 in emp_ids_active
        db.close()
        results["2.2_status_consistency_in_payroll"] = "OBSERVED (status='active' is strictly required by payroll engine per PROJECT.md line 61)"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["2.2_status_consistency_in_payroll"] = f"FAIL: {e}"

    # -------------------------------------------------------------
    # Challenge 3: Multiple Active Contracts Across Depts / Employees
    # -------------------------------------------------------------
    try:
        clean_db()
        print("\n[CHALLENGE 3.1] Testing Multiple Active Contracts for Different Employees & Departments...")
        r_da = client.post("/api/v1/master-data/departments", json={"name": "Engineering", "code": "ENG"})
        r_db = client.post("/api/v1/master-data/departments", json={"name": "Finance", "code": "FIN"})
        da_id = r_da.json()["id"]
        db_id = r_db.json()["id"]

        r_e1 = client.post("/api/v1/master-data/employees", json={"first_name": "E1", "last_name": "L1", "email": "e1@example.com", "department_id": da_id})
        r_e2 = client.post("/api/v1/master-data/employees", json={"first_name": "E2", "last_name": "L2", "email": "e2@example.com", "department_id": db_id})
        r_e3 = client.post("/api/v1/master-data/employees", json={"first_name": "E3", "last_name": "L3", "email": "e3@example.com", "department_id": None})
        e1_id, e2_id, e3_id = r_e1.json()["id"], r_e2.json()["id"], r_e3.json()["id"]

        # Same date range for all 3
        p_start, p_end = "2026-09-01", "2026-09-30"
        c1 = client.post("/api/v1/master-data/contracts", json={"employee_id": e1_id, "wage": 50000.0, "start_date": p_start, "end_date": p_end, "status": "active"})
        c2 = client.post("/api/v1/master-data/contracts", json={"employee_id": e2_id, "wage": 60000.0, "start_date": p_start, "end_date": p_end, "status": "active"})
        c3 = client.post("/api/v1/master-data/contracts", json={"employee_id": e3_id, "wage": 70000.0, "start_date": p_start, "end_date": p_end, "status": "active"})

        assert c1.status_code == 201 and c2.status_code == 201 and c3.status_code == 201

        db = TestingSessionLocal()
        eligible = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        e_ids = [e["employee_id"] for e in eligible]
        assert e1_id in e_ids and e2_id in e_ids and e3_id in e_ids
        print(f"  All 3 employees in different/null departments successfully resolved in get_eligible_employees: {e_ids}")

        # Now test single employee trying to have 2 active contracts across departments
        client.put(f"/api/v1/master-data/employees/{e1_id}", json={"department_id": db_id})
        c_dup = client.post("/api/v1/master-data/contracts", json={"employee_id": e1_id, "wage": 55000.0, "start_date": "2026-09-15", "end_date": "2026-10-15", "status": "active"})
        assert c_dup.status_code == 409
        print("  Single employee attempting second active contract in new department correctly blocked with 409.")
        db.close()
        results["3.1_multiple_employees_and_departments"] = "PASS"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["3.1_multiple_employees_and_departments"] = f"FAIL: {e}"

    # -------------------------------------------------------------
    # Challenge 4: Draft contract insertion during payrun computation
    # -------------------------------------------------------------
    try:
        clean_db()
        print("\n[CHALLENGE 4.1] Testing Draft Contract Insertion with Past & Future Dates During Payrun...")
        db = TestingSessionLocal()
        emp = Employee(id=70, first_name="Draft", last_name="Subject", email="draftsub@example.com", phone="+919999988888", status="active")
        db.add(emp)
        db.commit()

        # Active contract: 2026-09-01 to 2026-09-30 (wage 50000, ID 701)
        c_act = Contract(id=701, employee_id=70, wage=Decimal("50000.00"), contract_type="full_time", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30), status="active")
        # Draft past: 2026-01-01 to 2026-06-30 (wage 40000, ID 702)
        c_dp = Contract(id=702, employee_id=70, wage=Decimal("40000.00"), contract_type="full_time", start_date=date(2026, 1, 1), end_date=date(2026, 6, 30), status="draft")
        # Draft future: 2026-10-01 to 2026-12-31 (wage 60000, ID 703)
        c_df = Contract(id=703, employee_id=70, wage=Decimal("60000.00"), contract_type="full_time", start_date=date(2026, 10, 1), end_date=date(2026, 12, 31), status="draft")
        # Draft overlapping with higher ID and higher wage: 2026-09-01 to 2026-09-30 (wage 99999, ID 799)
        c_do = Contract(id=799, employee_id=70, wage=Decimal("99999.00"), contract_type="full_time", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30), status="draft")
        # Expired: 2026-01-01 to 2026-08-31 (wage 35000, ID 705)
        c_exp = Contract(id=705, employee_id=70, wage=Decimal("35000.00"), contract_type="full_time", start_date=date(2026, 1, 1), end_date=date(2026, 8, 31), status="expired")
        # Cancelled: 2026-09-01 to 2026-09-30 (wage 88888, ID 706)
        c_can = Contract(id=706, employee_id=70, wage=Decimal("88888.00"), contract_type="full_time", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30), status="cancelled")

        db.add_all([c_act, c_dp, c_df, c_do, c_exp, c_can])
        db.commit()

        # 1. resolve_active_contract
        resolved = resolve_active_contract(db, 70, date(2026, 9, 1), date(2026, 9, 30))
        assert resolved is not None
        assert resolved["id"] == 701, f"Expected active contract #701, got #{resolved['id']}"
        assert resolved["wage"] == Decimal("50000.00"), f"Expected wage 50000.00, got {resolved['wage']}"
        print("  1. resolve_active_contract strictly resolved active contract #701 (wage 50000), ignoring draft/expired/cancelled.")

        # 2. get_eligible_employees
        elig = get_eligible_employees(db, date(2026, 9, 1), date(2026, 9, 30))
        emp_match = [e for e in elig if e["employee_id"] == 70]
        assert len(emp_match) == 1
        assert emp_match[0]["contract_id"] == 701
        print("  2. get_eligible_employees picked active contract #701 for employee 70.")

        # 3. compute_single_payslip
        ps = Payslip(employee_id=70, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30), status="draft")
        db.add(ps)
        db.commit()
        computed = compute_single_payslip(db, ps.id)
        assert computed.contract_id == 701
        assert computed.basic_wage == Decimal("50000.00")
        print("  3. compute_single_payslip computed with active contract #701.")

        # 4. Attempt to activate draft overlapping contract #799 via API
        r_act = client.patch("/api/v1/master-data/contracts/799/status?new_status=active")
        assert r_act.status_code == 409, f"Expected 409 on activating overlapping draft contract, got {r_act.status_code}"
        print("  4. Activating overlapping draft contract blocked with 409 Conflict.")

        db.close()
        results["4.1_draft_insertion_during_payrun"] = "PASS"
    except Exception as e:
        print(f"  --> FAIL: {e}")
        traceback.print_exc()
        results["4.1_draft_insertion_during_payrun"] = f"FAIL: {e}"

    print("\n" + "=" * 70)
    print("ALL CHALLENGE RESULTS SUMMARY:")
    for k, v in results.items():
        print(f"  {k}: {v}")
    print("=" * 70)

if __name__ == "__main__":
    run_all_challenges()
