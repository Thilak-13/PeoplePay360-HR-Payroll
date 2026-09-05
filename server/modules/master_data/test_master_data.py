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


if __name__ == "__main__":
    test_ping()
    test_working_schedule_calculator()
    test_master_data_flow()
    print("\n>>> ALL MASTER DATA BACKEND TESTS PASSED SUCCESSFULLY! <<<\n")
