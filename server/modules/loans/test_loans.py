import unittest
from datetime import date
from decimal import Decimal
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import server.modules.master_data.models  # Register master data models on Base.metadata
from server.modules.loans.database import Base, get_db
from server.modules.loans.models import EmployeeLoan, LoanRepayment
from server.modules.loans.services import (
    compute_monthly_emi,
    generate_installment_schedule,
    approve_loan,
    reject_loan,
    get_active_deduction,
    record_monthly_deduction,
)
from server.modules.loans.router import router as loans_router


class TestLoansModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an in-memory SQLite database with StaticPool to share connection
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

        # Create all tables registered on Base.metadata
        Base.metadata.create_all(bind=cls.engine)

        with cls.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO employees (id, first_name, last_name, email, phone, status) VALUES
                (1, 'Eleanor', 'Vance', 'eleanor@test.local', '+1-555-0101', 'active'),
                (2, 'Liam', 'Patel', 'liam@test.local', '+1-555-0102', 'active');
            """))
            conn.commit()

        # Build FastAPI test client with database override
        cls.app = FastAPI()
        cls.app.include_router(loans_router, prefix="/api/v1/loans")

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        cls.app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(cls.app)

    def setUp(self):
        self.db = self.SessionLocal()
        with self.engine.begin() as conn:
            conn.execute(text("DELETE FROM loan_repayments;"))
            conn.execute(text("DELETE FROM employee_loans;"))

    def tearDown(self):
        self.db.close()

    def test_ping(self):
        response = self.client.get("/api/v1/loans/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"module": "loans_ready"})

    def test_emi_computation_zero_interest(self):
        """0% interest rate salary advance: principal / tenure."""
        emi = compute_monthly_emi(principal=12000, interest_rate=0.0, tenure_months=6)
        self.assertEqual(emi, Decimal("2000.00"))

        emi2 = compute_monthly_emi(principal=5000, interest_rate=0.0, tenure_months=3)
        self.assertEqual(emi2, Decimal("1666.67"))

    def test_emi_computation_with_interest(self):
        """Amortized EMI calculation with non-zero interest rate."""
        # Principal: 10,000, 12% p.a., 12 months -> EMI = 888.49
        emi = compute_monthly_emi(principal=10000, interest_rate=12.0, tenure_months=12)
        self.assertEqual(emi, Decimal("888.49"))

        # Schedule generation
        schedule = generate_installment_schedule(
            principal=10000,
            interest_rate=12.0,
            tenure_months=12,
            monthly_emi=emi,
            start_date=date(2026, 1, 1),
        )
        self.assertEqual(len(schedule), 12)
        self.assertEqual(schedule[0]["installment_number"], 1)
        self.assertAlmostEqual(schedule[0]["emi_amount"], 888.49, places=2)

    def test_loan_application_and_status_transitions(self):
        """Test status transitions: draft -> pending_approval -> active."""
        # 1. Create a draft loan directly
        loan = EmployeeLoan(
            employee_id=1,
            loan_type="salary_advance",
            principal_amount=Decimal("6000.00"),
            interest_rate=Decimal("0.0"),
            tenure_months=3,
            monthly_emi=Decimal("2000.00"),
            remaining_balance=Decimal("6000.00"),
            status="draft",
            reason="Emergency medical advance",
        )
        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)
        self.assertEqual(loan.status, "draft")

        # 2. Transition to pending_approval
        loan.status = "pending_approval"
        self.db.commit()
        self.db.refresh(loan)
        self.assertEqual(loan.status, "pending_approval")

        # 3. Approve loan -> moves to 'active'
        approved_loan = approve_loan(self.db, loan.id, approver_id=1)
        self.assertEqual(approved_loan.status, "active")
        self.assertEqual(approved_loan.remaining_balance, Decimal("6000.00"))
        self.assertIsNotNone(approved_loan.disbursement_date)

    def test_repayment_deduction_and_auto_repaid_trigger(self):
        """Test repayment reduces balance and marks loan as 'repaid' at 0 balance."""
        loan = EmployeeLoan(
            employee_id=2,
            loan_type="emergency_loan",
            principal_amount=Decimal("4000.00"),
            interest_rate=Decimal("0.0"),
            tenure_months=2,
            monthly_emi=Decimal("2000.00"),
            remaining_balance=Decimal("4000.00"),
            status="active",
            disbursement_date=date.today(),
            reason="Relocation assistance",
        )
        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)

        # First deduction: 2000.00
        rep1 = record_monthly_deduction(self.db, loan_id=loan.id, amount=2000.00, payslip_id=101)
        self.assertEqual(rep1.amount_paid, Decimal("2000.00"))
        self.assertEqual(rep1.balance_after, Decimal("2000.00"))
        self.assertEqual(loan.remaining_balance, Decimal("2000.00"))
        self.assertEqual(loan.status, "active")

        # Second deduction: 2000.00 -> balance reaches 0 -> status becomes 'repaid'
        rep2 = record_monthly_deduction(self.db, loan_id=loan.id, amount=2000.00, payslip_id=102)
        self.assertEqual(rep2.amount_paid, Decimal("2000.00"))
        self.assertEqual(rep2.balance_after, Decimal("0.00"))
        self.assertEqual(loan.remaining_balance, Decimal("0.00"))
        self.assertEqual(loan.status, "repaid")

    def test_active_deduction_query(self):
        """Test get_active_deduction returns active installment amount."""
        # Create an active loan for employee 1
        loan = EmployeeLoan(
            employee_id=1,
            loan_type="salary_advance",
            principal_amount=Decimal("3000.00"),
            interest_rate=Decimal("0.0"),
            tenure_months=3,
            monthly_emi=Decimal("1000.00"),
            remaining_balance=Decimal("3000.00"),
            status="active",
            disbursement_date=date.today(),
        )
        self.db.add(loan)
        self.db.commit()

        deduction = get_active_deduction(self.db, employee_id=1)
        self.assertEqual(deduction["loan_id"], loan.id)
        self.assertEqual(deduction["monthly_emi"], 1000.0)
        self.assertEqual(deduction["remaining_balance"], 3000.0)

        # Clean up remaining balance to 0
        loan.remaining_balance = Decimal("0.00")
        loan.status = "repaid"
        self.db.commit()

        # Now active deduction should return empty/0
        no_deduction = get_active_deduction(self.db, employee_id=999)
        self.assertIsNone(no_deduction["loan_id"])
        self.assertEqual(no_deduction["monthly_emi"], 0.0)

    def test_loan_endpoints_via_api(self):
        """Test REST endpoints via TestClient."""
        # POST /apply
        payload = {
            "employee_id": 1,
            "loan_type": "salary_advance",
            "principal_amount": 9000.0,
            "tenure_months": 3,
            "interest_rate": 0.0,
            "reason": "Festival advance",
        }
        res = self.client.post("/api/v1/loans/apply", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        loan_id = data["id"]
        self.assertEqual(data["status"], "pending_approval")
        self.assertEqual(data["monthly_emi"], 3000.0)

        # POST /{id}/approve
        res_approve = self.client.post(f"/api/v1/loans/{loan_id}/approve", json={"approver_id": 1})
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.json()["status"], "active")

        # GET /active-deduction/{employee_id}
        res_ded = self.client.get("/api/v1/loans/active-deduction/1")
        self.assertEqual(res_ded.status_code, 200)
        self.assertEqual(res_ded.json()["monthly_emi"], 3000.0)

        # POST /record-deduction
        res_rec = self.client.post("/api/v1/loans/record-deduction", json={
            "loan_id": loan_id,
            "amount": 3000.0,
            "payslip_id": 201,
            "notes": "September deduction",
        })
        self.assertEqual(res_rec.status_code, 200)
        self.assertEqual(res_rec.json()["balance_after"], 6000.0)

        # GET /employee/{employee_id}
        res_emp = self.client.get("/api/v1/loans/employee/1")
        self.assertEqual(res_emp.status_code, 200)
        self.assertGreaterEqual(len(res_emp.json()), 1)

        # POST /{id}/reject (apply a second loan to reject)
        payload2 = {
            "employee_id": 2,
            "loan_type": "equipment_loan",
            "principal_amount": 15000.0,
            "tenure_months": 6,
            "reason": "Personal computer upgrade",
        }
        res2 = self.client.post("/api/v1/loans/apply", json=payload2)
        l2_id = res2.json()["id"]
        res_rej = self.client.post(f"/api/v1/loans/{l2_id}/reject", json={"remarks": "Exceeds advance limits"})
        self.assertEqual(res_rej.status_code, 200)
        self.assertEqual(res_rej.json()["status"], "rejected")


if __name__ == "__main__":
    unittest.main()
