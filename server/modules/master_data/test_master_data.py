from datetime import date, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models  # Ensure all models are registered on Base.metadata
from server.main import app

# Test in-memory SQLite database with StaticPool so all sessions share the same in-memory schema
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables on the test engine
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_ping():
    res = client.get("/api/v1/master-data/ping")
    assert res.status_code == 200
    assert res.json() == {"module": "master_data_ready"}


def test_working_schedule_calculator():
    # 2026-09-07 is Monday, 2026-09-11 is Friday -> exactly 5 working days
    res = client.post(
        "/api/v1/master-data/schedules/calculate-hours",
        json={"hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-07", "date_to": "2026-09-11"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hours_per_week"] == 40.0
    assert data["hours_per_day"] == 8.0
    assert data["working_days"] == 5
    assert data["total_calculated_hours"] == 40.0


def test_master_data_flow():
    # 1. Create Department
    res_dept = client.post(
        "/api/v1/master-data/departments",
        json={"name": "Engineering", "code": "ENG"},
    )
    assert res_dept.status_code == 201
    dept_id = res_dept.json()["id"]

    # 2. Create Working Schedule
    res_sched = client.post(
        "/api/v1/master-data/working-schedules",
        json={"name": "Standard 40h", "hours_per_week": 40.0},
    )
    assert res_sched.status_code == 201
    sched_id = res_sched.json()["id"]

    # 3. Create Employee
    res_emp = client.post(
        "/api/v1/master-data/employees",
        json={
            "first_name": "Alice",
            "last_name": "Smith",
            "email": "alice.smith@example.com",
            "phone": "+1234567890",
            "department_id": dept_id,
            "working_schedule_id": sched_id,
            "job_title": "Software Engineer",
            "hire_date": "2026-01-15",
            "status": "active",
        },
    )
    assert res_emp.status_code == 201
    emp_id = res_emp.json()["id"]

    # 4. Create Contract with Date Validation
    # Test invalid date (start_date > end_date)
    bad_contract = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5000.00,
            "contract_type": "full_time",
            "start_date": "2026-12-31",
            "end_date": "2026-01-01",
            "status": "active",
        },
    )
    assert bad_contract.status_code in [400, 422]

    # Valid Contract
    res_contract1 = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5000.00,
            "contract_type": "full_time",
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "status": "active",
        },
    )
    assert res_contract1.status_code == 201
    contract1_id = res_contract1.json()["id"]

    # Test Contract Overlap Rejection
    overlap_contract = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 6000.00,
            "contract_type": "full_time",
            "start_date": "2026-03-01",
            "end_date": "2026-09-30",
            "status": "active",
        },
    )
    assert overlap_contract.status_code == 409

    # Non-overlapping Contract
    res_contract2 = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5500.00,
            "contract_type": "full_time",
            "start_date": "2026-07-01",
            "end_date": "2026-12-31",
            "status": "draft",
        },
    )
    assert res_contract2.status_code == 201

    # 5. Leave Allocations & Requests Workflow
    # Allocate 10 days of paid_time_off
    res_alloc = client.post(
        "/api/v1/master-data/leave-allocations",
        json={
            "employee_id": emp_id,
            "holiday_type": "paid_time_off",
            "number_of_days": 10.0,
            "year": 2026,
            "status": "approved",
        },
    )
    assert res_alloc.status_code == 201

    # Submit Leave Request for 4 days
    res_leave = client.post(
        "/api/v1/master-data/leave-requests",
        json={
            "employee_id": emp_id,
            "holiday_type": "paid_time_off",
            "date_from": "2026-08-01",
            "date_to": "2026-08-04",
            "status": "draft",
        },
    )
    assert res_leave.status_code == 201
    leave_id = res_leave.json()["id"]
    assert float(res_leave.json()["number_of_days"]) == 4.0

    # Approve Leave Request with atomic deduction
    res_approve = client.post(f"/api/v1/master-data/leave-requests/{leave_id}/approve")
    assert res_approve.status_code == 200
    assert res_approve.json()["remaining_allocation_days"] == 6.0

    # 6. Check Employee Detail & Smart-Stats
    res_detail = client.get(f"/api/v1/master-data/employees/{emp_id}/detail")
    assert res_detail.status_code == 200
    detail_data = res_detail.json()
    assert detail_data["contracts_count"] == 2
    assert detail_data["time_off_count"] == 1
    assert detail_data["allocations_count"] == 1
    assert len(detail_data["contracts"]) == 2
    assert len(detail_data["leave_requests"]) == 1
    assert len(detail_data["leave_allocations"]) == 1


def test_working_schedule_with_daily_lines():
    # Create schedule with 4 daily lines: Mon-Wed (8h each) + Thu (9h) -> Total 33h
    payload = {
        "name": "Custom 4-day 33h Schedule",
        "days": [
            {"day_of_week": 0, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0},
            {"day_of_week": 1, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0},
            {"day_of_week": 2, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0},
            {"day_of_week": 3, "start_time": "09:00", "end_time": "19:00", "break_hours": 1.0},
        ],
    }
    res = client.post("/api/v1/master-data/working-schedules", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert float(data["hours_per_week"]) == 33.0
    assert len(data["days"]) == 4
    sched_id = data["id"]

    # Verify GET /working-schedules/{id}
    res_get = client.get(f"/api/v1/master-data/working-schedules/{sched_id}")
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert float(get_data["hours_per_week"]) == 33.0
    assert len(get_data["days"]) == 4
    assert get_data["days"][0]["day_of_week"] == 0
    assert get_data["days"][3]["day_of_week"] == 3

    # Verify schedule calculation using custom schedule ID across 2026-09-07 (Mon) to 2026-09-13 (Sun)
    res_calc = client.post(
        "/api/v1/master-data/schedules/calculate-hours",
        json={
            "working_schedule_id": sched_id,
            "date_from": "2026-09-07",
            "date_to": "2026-09-13",
        },
    )
    assert res_calc.status_code == 200
    calc_data = res_calc.json()
    assert calc_data["working_days"] == 4
    assert calc_data["total_calculated_hours"] == 33.0
    assert calc_data["hours_per_week"] == 33.0

    # Test updating days on schedule
    update_payload = {
        "days": [
            {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "break_hours": 1.0}, # 7h
            {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "break_hours": 1.0}, # 7h
        ]
    }
    res_up = client.put(f"/api/v1/master-data/working-schedules/{sched_id}", json=update_payload)
    assert res_up.status_code == 200
    up_data = res_up.json()
    assert float(up_data["hours_per_week"]) == 14.0
    assert len(up_data["days"]) == 2


def test_contract_status_normalization_and_overlap_blocking():
    # Create employee
    res_emp = client.post(
        "/api/v1/master-data/employees",
        json={
            "first_name": "Marcus",
            "last_name": "Vance",
            "email": "marcus.vance@example.com",
            "phone": "+1999888777",
            "job_title": "QA Engineer",
            "hire_date": "2026-01-01",
            "status": "active",
        },
    )
    assert res_emp.status_code == 201
    emp_id = res_emp.json()["id"]

    # 1. Create contract with mixed-case status "Active" -> normalized to "active"
    res_c1 = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 6500.00,
            "contract_type": "full_time",
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "status": "Active",
        },
    )
    assert res_c1.status_code == 201
    c1_data = res_c1.json()
    c1_id = c1_data["id"]
    assert c1_data["status"] == "active"

    # 2. Attempt to create overlapping contract with mixed-case "ACTIVE" -> 409 Conflict
    res_overlap_active = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 7000.00,
            "contract_type": "full_time",
            "start_date": "2026-04-01",
            "end_date": "2026-09-30",
            "status": "ACTIVE",
        },
    )
    assert res_overlap_active.status_code == 409
    assert "overlaps with existing active contract" in res_overlap_active.json()["detail"]

    # 3. Attempt to create overlapping contract with status "Running" -> 409 Conflict
    res_overlap_running = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 7000.00,
            "contract_type": "full_time",
            "start_date": "2026-05-01",
            "end_date": "2026-08-31",
            "status": "Running",
        },
    )
    assert res_overlap_running.status_code == 409

    # 4. Attempt to create overlapping contract with status " active " -> 409 Conflict
    res_overlap_spaced = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 7000.00,
            "contract_type": "full_time",
            "start_date": "2026-05-01",
            "end_date": "2026-08-31",
            "status": " active ",
        },
    )
    assert res_overlap_spaced.status_code == 409

    # 5. Create Draft contract spanning overlapping dates -> 201 Created (allowed)
    res_draft = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 8000.00,
            "contract_type": "full_time",
            "start_date": "2026-06-01",
            "end_date": "2026-12-31",
            "status": "Draft",
        },
    )
    assert res_draft.status_code == 201
    draft_id = res_draft.json()["id"]
    assert res_draft.json()["status"] == "draft"

    # 6. Attempt to activate draft contract via PATCH while overlapping -> 409 Conflict
    res_patch_fail = client.patch(
        f"/api/v1/master-data/contracts/{draft_id}/status?new_status=Active"
    )
    assert res_patch_fail.status_code == 409
    # Ensure draft contract remained draft
    res_draft_check = client.get(f"/api/v1/master-data/contracts/{draft_id}")
    assert res_draft_check.json()["status"] == "draft"

    # 7. Shorten existing active contract so no overlap exists with draft (ends 2026-05-31)
    res_shorten = client.put(
        f"/api/v1/master-data/contracts/{c1_id}",
        json={"end_date": "2026-05-31"}
    )
    assert res_shorten.status_code == 200

    # 8. Now activate draft contract -> 200 OK
    res_patch_success = client.patch(
        f"/api/v1/master-data/contracts/{draft_id}/status?new_status=Active"
    )
    assert res_patch_success.status_code == 200
    assert res_patch_success.json()["status"] == "active"


def test_contract_boundary_and_self_exclusion():
    res_emp = client.post(
        "/api/v1/master-data/employees",
        json={
            "first_name": "Boundary",
            "last_name": "Tester",
            "email": "boundary.tester@example.com",
            "job_title": "Tester",
            "status": "active",
        },
    )
    assert res_emp.status_code == 201
    emp_id = res_emp.json()["id"]

    # Active Contract A: 2026-01-01 to 2026-06-30
    res_a = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5000.00,
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
            "status": "active",
        },
    )
    assert res_a.status_code == 201
    contract_a_id = res_a.json()["id"]

    # 1. Touching boundary: 2026-06-30 to 2026-12-31 -> 409 Conflict (touches on June 30)
    res_touch = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5500.00,
            "start_date": "2026-06-30",
            "end_date": "2026-12-31",
            "status": "active",
        },
    )
    assert res_touch.status_code == 409

    # 2. Next calendar day: 2026-07-01 to 2026-12-31 -> 201 Created (strictly adjacent)
    res_adj = client.post(
        "/api/v1/master-data/contracts",
        json={
            "employee_id": emp_id,
            "wage": 5500.00,
            "start_date": "2026-07-01",
            "end_date": "2026-12-31",
            "status": "active",
        },
    )
    assert res_adj.status_code == 201

    # 3. Self-exclusion on update: updating wage on Contract A does not collide with Contract A
    res_up = client.put(
        f"/api/v1/master-data/contracts/{contract_a_id}",
        json={"wage": 6000.00}
    )
    assert res_up.status_code == 200
    assert float(res_up.json()["wage"]) == 6000.00


def test_working_schedule_hour_calculations_and_fallback():
    # 1. Full month fallback calculation (September 2026: 30 calendar days, 8 weekend days, 22 working days, 176h)
    res = client.post(
        "/api/v1/master-data/schedules/calculate-hours",
        json={"hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-01", "date_to": "2026-09-30"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["working_days"] == 22
    assert data["total_calculated_hours"] == 176.0
    assert data["hours_per_day"] == 8.0

    # 2. Weekend-only date range (2026-09-05 Sat to 2026-09-06 Sun) -> 0 working days, 0.0 hours
    res_we = client.post(
        "/api/v1/master-data/schedules/calculate-hours",
        json={"hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-05", "date_to": "2026-09-06"},
    )
    assert res_we.status_code == 200
    data_we = res_we.json()
    assert data_we["working_days"] == 0
    assert data_we["total_calculated_hours"] == 0.0

    # 3. Invalid date order (date_from > date_to) -> 400 Bad Request
    res_bad = client.post(
        "/api/v1/master-data/schedules/calculate-hours",
        json={"hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-30", "date_to": "2026-09-01"},
    )
    assert res_bad.status_code == 400


if __name__ == "__main__":
    test_ping()
    test_working_schedule_calculator()
    test_working_schedule_with_daily_lines()
    test_master_data_flow()
    test_contract_status_normalization_and_overlap_blocking()
    test_contract_boundary_and_self_exclusion()
    test_working_schedule_hour_calculations_and_fallback()
    print("\n>>> ALL MASTER DATA BACKEND TESTS PASSED SUCCESSFULLY! <<<\n")
