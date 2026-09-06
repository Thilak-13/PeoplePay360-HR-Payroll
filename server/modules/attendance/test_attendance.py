import pytest
from datetime import datetime, date, timedelta, time as dt_time, timezone
from decimal import Decimal
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.attendance.models
from server.modules.attendance.router import router as attendance_router
from server.modules.attendance.services import AttendanceService
from server.modules.master_data.models import Employee, LeaveRequest

app = FastAPI()
app.include_router(attendance_router, prefix="/api/v1/attendance", tags=["Attendance"])

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


@pytest.fixture(autouse=True)
def seed_test_employees():
    """Seed test employee data before each test."""
    db = TestingSessionLocal()
    if not db.query(Employee).filter(Employee.id == 101).first():
        emp = Employee(
            id=101,
            first_name="Marcus",
            last_name="Vance",
            email="marcus.vance@peoplepay360.com",
            phone="1234567890",
            status="active"
        )
        db.add(emp)
        db.commit()
    db.close()


def test_attendance_ping():
    res = client.get("/api/v1/attendance/ping")
    assert res.status_code == 200
    assert res.json() == {"module": "attendance_ready"}


def test_clock_in_and_clock_out_math():
    today = date(2026, 9, 8)
    cin = datetime.combine(today, dt_time(9, 0))
    cout = datetime.combine(today, dt_time(19, 30))  # 10.5h raw - 1h break = 9.5h worked -> 1.5h OT

    # 1. Clock In
    res_in = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "in",
        "timestamp": cin.isoformat()
    })
    assert res_in.status_code == 200
    rec_in = res_in.json()
    assert rec_in["status"] == "present"

    # 2. Clock Out
    res_out = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "out",
        "timestamp": cout.isoformat()
    })
    assert res_out.status_code == 200
    rec_out = res_out.json()
    assert float(rec_out["worked_hours"]) == 9.50
    assert float(rec_out["overtime_hours"]) == 1.50


def test_grace_period_and_late_status():
    # 1. Create a shift with 15 mins grace period starting at 09:00
    res_sh = client.post("/api/v1/attendance/shifts", json={
        "name": "Morning Shift (9-6)",
        "start_time": "09:00",
        "end_time": "18:00",
        "break_hours": 1.0,
        "grace_period_mins": 15
    })
    assert res_sh.status_code == 201
    shift_id = res_sh.json()["id"]

    # Assign shift to employee 101
    today = date(2026, 9, 9)
    res_assign = client.post("/api/v1/attendance/shift-assignments", json={
        "employee_id": 101,
        "shift_id": shift_id,
        "start_date": str(today)
    })
    assert res_assign.status_code == 201

    # Clock in at 09:25 (after 09:15 grace period) -> should be marked 'late'
    late_cin = datetime.combine(today, dt_time(9, 25))
    res_punch = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "in",
        "timestamp": late_cin.isoformat()
    })
    assert res_punch.status_code == 200
    assert res_punch.json()["status"] == "late"


def test_unpaid_absence_lop_calculation():
    # Test LOP across a 5-day week: 2026-09-07 (Mon) to 2026-09-11 (Fri)
    # Add an approved leave for 2026-09-08
    db = TestingSessionLocal()
    leave = LeaveRequest(
        employee_id=101,
        holiday_type="Paid Annual Leave",
        date_from=date(2026, 9, 8),
        date_to=date(2026, 9, 8),
        number_of_days=Decimal("1.0"),
        status="approved"
    )
    db.add(leave)
    db.commit()
    db.close()

    # Query unpaid absences for employee 101
    res = client.get("/api/v1/attendance/unpaid-absences/101?start_date=2026-09-07&end_date=2026-09-11")
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == 101
    assert "absent_days" in data
    assert "lop_hours" in data


def test_clock_out_mixed_timezone_and_none_timestamp():
    """Verify that clocking out does not crash with offset-naive vs offset-aware datetime error."""
    today = date(2026, 9, 15)
    cin_naive = datetime.combine(today, dt_time(9, 0))  # naive datetime

    # 1. Clock in with naive timestamp
    res_in = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "in",
        "timestamp": cin_naive.isoformat()
    })
    assert res_in.status_code == 200

    # 2. Clock out with aware UTC timestamp
    cout_aware = datetime.combine(today, dt_time(17, 0)).replace(tzinfo=timezone.utc)
    res_out = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "out",
        "timestamp": cout_aware.isoformat()
    })
    assert res_out.status_code == 200
    assert float(res_out.json()["worked_hours"]) >= 7.0

    # 3. Clock out without timestamp (uses datetime.now(timezone.utc) against naive in DB)
    res_out_live = client.post("/api/v1/attendance/punch", json={
        "employee_id": 101,
        "punch_type": "out",
    })
    assert res_out_live.status_code == 200

