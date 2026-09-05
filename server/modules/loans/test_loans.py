import pytest
from datetime import date
from decimal import Decimal
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.loans.models
from server.modules.loans.router import router as loans_router
from server.modules.loans.services import LoanService
from server.modules.master_data.models import Employee

test_app = FastAPI()
test_app.include_router(loans_router, prefix="/api/v1/loans", tags=["Loans"])

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


test_app.dependency_overrides[get_db] = override_get_db
client = TestClient(test_app)


@pytest.fixture(autouse=True)
def seed_test_employees():
    """Seed test employee data before each test."""
    db = TestingSessionLocal()
    if not db.query(Employee).filter(Employee.id == 201).first():
        emp = Employee(
            id=201,
            first_name="Diana",
            last_name="Prince",
            email="diana.prince@peoplepay360.com",
            phone="9876543210",
            status="active"
        )
        db.add(emp)
        db.commit()
    db.close()


def test_loans_ping():
    res = client.get("/api/v1/loans/ping")
    assert res.status_code == 200
    assert res.json() == {"module": "loans_ready"}


def test_loan_application_and_emi_calculation():
    # 1. Salary advance (0% interest, 1 month tenure)
    res_adv = client.post("/api/v1/loans/apply", json={
        "employee_id": 201,
        "loan_type": "salary_advance",
        "principal_amount": 20000.0,
        "tenure_months": 1,
        "interest_rate": 0.0,
        "reason": "Emergency Medical Advance"
    })
    assert res_adv.status_code == 201
    adv_data = res_adv.json()
    assert float(adv_data["total_repayable"]) == 20000.0
    assert float(adv_data["monthly_emi"]) == 20000.0
    assert adv_data["status"] == "pending_approval"

    # 2. Personal loan with 6% annual interest over 12 months (tenure = 12)
    # Principal: 120,000 -> Interest = 120,000 * 0.06 * (12/12) = 7,200 -> Total: 127,200 -> EMI: 10,600
    res_loan = client.post("/api/v1/loans/apply", json={
        "employee_id": 201,
        "loan_type": "personal_loan",
        "principal_amount": 120000.0,
        "tenure_months": 12,
        "interest_rate": 6.0,
        "reason": "Relocation Assistance"
    })
    assert res_loan.status_code == 201
    loan_data = res_loan.json()
    assert float(loan_data["total_repayable"]) == 127200.0
    assert float(loan_data["monthly_emi"]) == 10600.0


def test_loan_approval_lifecycle():
    # Apply
    res_apply = client.post("/api/v1/loans/apply", json={
        "employee_id": 201,
        "loan_type": "equipment_loan",
        "principal_amount": 30000.0,
        "tenure_months": 3,
        "interest_rate": 0.0
    })
    assert res_apply.status_code == 201
    loan_id = res_apply.json()["id"]

    # Approve
    res_appr = client.post(f"/api/v1/loans/{loan_id}/approve", json={
        "disbursement_date": str(date.today()),
        "approved_by": 1
    })
    assert res_appr.status_code == 200
    assert res_appr.json()["status"] == "active"
    assert float(res_appr.json()["remaining_balance"]) == 30000.0


def test_monthly_emi_deduction_and_repaid_status():
    # 1. Create and approve a small 2-month loan of 10,000 (5,000/mo)
    res_apply = client.post("/api/v1/loans/apply", json={
        "employee_id": 201,
        "loan_type": "emergency_loan",
        "principal_amount": 10000.0,
        "tenure_months": 2,
        "interest_rate": 0.0
    })
    loan_id = res_apply.json()["id"]
    client.post(f"/api/v1/loans/{loan_id}/approve")

    # 2. Record First Installment (5,000)
    res_ded1 = client.post("/api/v1/loans/record-deduction", json={
        "loan_id": loan_id,
        "amount_paid": 5000.0,
        "payslip_id": 1001,
        "notes": "Month 1 payroll deduction"
    })
    assert res_ded1.status_code == 200
    assert float(res_ded1.json()["balance_after"]) == 5000.0

    # Verify loan remains active
    res_detail1 = client.get(f"/api/v1/loans/{loan_id}")
    assert res_detail1.json()["status"] == "active"

    # 3. Record Second Installment (5,000)
    res_ded2 = client.post("/api/v1/loans/record-deduction", json={
        "loan_id": loan_id,
        "amount_paid": 5000.0,
        "payslip_id": 1002,
        "notes": "Month 2 payroll deduction"
    })
    assert res_ded2.status_code == 200
    assert float(res_ded2.json()["balance_after"]) == 0.0

    # Verify loan automatically marked as 'repaid'
    res_detail2 = client.get(f"/api/v1/loans/{loan_id}")
    assert res_detail2.json()["status"] == "repaid"
    assert float(res_detail2.json()["remaining_balance"]) == 0.0


def test_active_deduction_query_for_payroll():
    # Query active deductions for employee 201
    res = client.get("/api/v1/loans/active-deduction/201")
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == 201
    assert "total_monthly_emi" in data
    assert "total_remaining_balance" in data
