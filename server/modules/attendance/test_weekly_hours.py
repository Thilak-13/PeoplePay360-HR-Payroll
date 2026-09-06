import pytest
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.attendance.models
import server.modules.payroll.models
import server.modules.auth.models


from server.modules.attendance.router import router as attendance_router
from server.modules.attendance.services import AttendanceService
from server.modules.attendance.models import AttendanceRecord
from server.modules.master_data.models import Employee, Contract, LeaveRequest

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
def setup_test_data():
    db = TestingSessionLocal()
    db.query(AttendanceRecord).delete()
    db.query(LeaveRequest).delete()
    db.query(Contract).delete()
    db.query(Employee).delete()
    db.commit()

    e1 = Employee(id=1, first_name="Executive", last_name="Leader", email="exec@example.com", status="active")
    c1 = Contract(id=1, employee_id=1, wage=Decimal("64000.00"), start_date=date(2026, 9, 1), status="active")

    e2 = Employee(id=2, first_name="Standard", last_name="Worker", email="std@example.com", status="active")
    c2 = Contract(id=2, employee_id=2, wage=Decimal("64000.00"), start_date=date(2026, 9, 1), status="active")

    e3 = Employee(id=3, first_name="PartTime", last_name="Associate", email="part@example.com", status="active")
    c3 = Contract(id=3, employee_id=3, wage=Decimal("64000.00"), start_date=date(2026, 9, 1), status="active")

    db.add_all([e1, c1, e2, c2, e3, c3])
    db.commit()
    db.close()

def test_weekly_hours_and_salary_categorization():
    db = TestingSessionLocal()
    try:
        for d in [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26]:
            db.add(AttendanceRecord(employee_id=1, date=date(2026, 9, d), worked_hours=Decimal("10.00"), status="present"))
        for d in [29, 30]:
            db.add(AttendanceRecord(employee_id=1, date=date(2026, 9, d), worked_hours=Decimal("15.00"), status="present"))

        for d in [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26]:
            db.add(AttendanceRecord(employee_id=2, date=date(2026, 9, d), worked_hours=Decimal("8.40"), status="present"))
        for d in [29, 30]:
            db.add(AttendanceRecord(employee_id=2, date=date(2026, 9, d), worked_hours=Decimal("21.00"), status="present"))

        for d in [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26]:
            db.add(AttendanceRecord(employee_id=3, date=date(2026, 9, d), worked_hours=Decimal("5.00"), status="present"))
        db.commit()

        lv_unpaid = LeaveRequest(
            employee_id=2,
            holiday_type="unpaid",
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 2),
            number_of_days=Decimal("2.0"),
            status="approved"
        )
        lv_paid = LeaveRequest(
            employee_id=1,
            holiday_type="sick",
            date_from=date(2026, 9, 3),
            date_to=date(2026, 9, 4),
            number_of_days=Decimal("2.0"),
            status="approved"
        )
        db.add_all([lv_unpaid, lv_paid])
        db.commit()

        results = AttendanceService.get_weekly_working_hours(db, year=2026, month=9)
        assert len(results) == 3

        r1 = next(r for r in results if r["employee_id"] == 1)
        assert r1["salary_category"] == "Executive Schedule"
        assert r1["avg_weekly_hours"] >= 45.0
        assert r1["leave_deduction"] == 0.0
        assert r1["overtime_bonus"] == 24000.0

        r2 = next(r for r in results if r["employee_id"] == 2)
        assert r2["salary_category"] == "Standard Full-Time"
        assert 40.0 <= r2["avg_weekly_hours"] < 45.0
        assert r2["overtime_bonus"] > 0.0
        assert r2["unpaid_leave_days"] == 2
        assert r2["leave_deduction"] > 0.0

        r3 = next(r for r in results if r["employee_id"] == 3)
        assert r3["salary_category"] == "Part-Time Schedule"
        assert 20.0 <= r3["avg_weekly_hours"] < 40.0
        assert r3["overtime_bonus"] == 0.0
        assert r3["net_adjusted_salary"] == 40000.0
    finally:
        db.close()

def test_weekly_hours_api_endpoint():
    res = client.get("/api/v1/attendance/weekly-hours?year=2026&month=9")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
