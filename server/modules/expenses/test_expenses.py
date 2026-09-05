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
import server.modules.expenses.models
from server.modules.expenses.router import router as expenses_router
from server.modules.master_data.models import Employee

app = FastAPI()
app.include_router(expenses_router, prefix="/api/v1/expenses", tags=["Expenses"])

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
    if not db.query(Employee).filter(Employee.id == 301).first():
        emp = Employee(
            id=301,
            first_name="Victor",
            last_name="Stone",
            email="victor.stone@peoplepay360.com",
            phone="8888888888",
            status="active"
        )
        db.add(emp)
        db.commit()
    db.close()


def test_expenses_ping():
    res = client.get("/api/v1/expenses/ping")
    assert res.status_code == 200
    assert res.json() == {"module": "expenses_ready"}


def test_expense_claim_submission():
    payload = {
        "employee_id": 301,
        "category": "travel",
        "amount": 3500.0,
        "currency": "INR",
        "expense_date": str(date.today()),
        "description": "Airport cab fare for client meeting",
        "receipt_url": "https://example.com/receipt123.jpg"
    }
    res = client.post("/api/v1/expenses/submit", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["employee_id"] == 301
    assert float(data["amount"]) == 3500.0
    assert data["status"] == "submitted"


def test_expense_approval_and_rejection_lifecycle():
    # 1. Submit claim to approve
    res_claim1 = client.post("/api/v1/expenses/submit", json={
        "employee_id": 301,
        "category": "food",
        "amount": 1200.0,
        "description": "Team lunch during deployment"
    })
    claim1_id = res_claim1.json()["id"]

    # Approve
    res_appr = client.post(f"/api/v1/expenses/{claim1_id}/approve", json={"approved_by": 1})
    assert res_appr.status_code == 200
    assert res_appr.json()["status"] == "approved"

    # 2. Submit claim to reject
    res_claim2 = client.post("/api/v1/expenses/submit", json={
        "employee_id": 301,
        "category": "other",
        "amount": 5000.0,
        "description": "Unverified personal expense"
    })
    claim2_id = res_claim2.json()["id"]

    # Reject
    res_rej = client.post(f"/api/v1/expenses/{claim2_id}/reject", json={"reason": "Receipt missing"})
    assert res_rej.status_code == 200
    assert res_rej.json()["status"] == "rejected"
    assert res_rej.json()["rejection_reason"] == "Receipt missing"


def test_pending_reimbursements_query_for_payroll():
    # Submit and approve a claim for employee 301
    res_claim = client.post("/api/v1/expenses/submit", json={
        "employee_id": 301,
        "category": "office_supplies",
        "amount": 2500.0,
        "description": "Wireless mouse and monitor stand"
    })
    claim_id = res_claim.json()["id"]
    client.post(f"/api/v1/expenses/{claim_id}/approve")

    # Query pending reimbursements
    res_pending = client.get("/api/v1/expenses/pending-reimbursements/301")
    assert res_pending.status_code == 200
    data = res_pending.json()
    assert data["employee_id"] == 301
    assert data["approved_claims_count"] >= 1
    assert float(data["total_reimbursement_amount"]) >= 2500.0


def test_mark_as_reimbursed():
    # 1. Create and approve claim
    res_claim = client.post("/api/v1/expenses/submit", json={
        "employee_id": 301,
        "category": "training",
        "amount": 8000.0,
        "description": "Cloud Architecture Certification Fee"
    })
    claim_id = res_claim.json()["id"]
    client.post(f"/api/v1/expenses/{claim_id}/approve")

    # 2. Mark as reimbursed in payroll batch 501
    res_mark = client.post("/api/v1/expenses/mark-reimbursed", json={
        "claim_ids": [claim_id],
        "payslip_id": 501
    })
    assert res_mark.status_code == 200
    reimbursed_claims = res_mark.json()
    assert len(reimbursed_claims) == 1
    assert reimbursed_claims[0]["status"] == "reimbursed"
    assert reimbursed_claims[0]["payslip_id"] == 501
