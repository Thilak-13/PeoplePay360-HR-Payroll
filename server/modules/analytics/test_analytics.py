import unittest
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from server.modules.analytics.router import (
    ping,
    get_dashboard_analytics,
    export_bank_file,
    send_payslips_batch,
)


class TestAnalyticsModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # In-memory SQLite for fast testing
        cls.engine = create_engine("sqlite:///:memory:")
        cls.SessionLocal = sessionmaker(bind=cls.engine)

        with cls.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE departments (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    code VARCHAR(20),
                    manager_id INTEGER,
                    parent_id INTEGER
                );
            """))
            conn.execute(text("""
                CREATE TABLE employees (
                    id INTEGER PRIMARY KEY,
                    first_name VARCHAR(50) NOT NULL,
                    last_name VARCHAR(50) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    phone VARCHAR(20),
                    department_id INTEGER,
                    working_schedule_id INTEGER,
                    job_title VARCHAR(100),
                    bank_account_number VARCHAR(50),
                    bank_ifsc VARCHAR(20),
                    hire_date DATE,
                    status VARCHAR(20) DEFAULT 'active'
                );
            """))
            conn.execute(text("""
                CREATE TABLE contracts (
                    id INTEGER PRIMARY KEY,
                    employee_id INTEGER NOT NULL,
                    wage NUMERIC(12, 2) NOT NULL,
                    contract_type VARCHAR(50) DEFAULT 'full_time',
                    start_date DATE NOT NULL,
                    end_date DATE,
                    status VARCHAR(20) DEFAULT 'draft'
                );
            """))
            conn.execute(text("""
                CREATE TABLE leave_requests (
                    id INTEGER PRIMARY KEY,
                    employee_id INTEGER NOT NULL,
                    holiday_type VARCHAR(50) NOT NULL,
                    date_from DATE NOT NULL,
                    date_to DATE NOT NULL,
                    number_of_days NUMERIC(5, 2) NOT NULL,
                    status VARCHAR(20) DEFAULT 'draft'
                );
            """))
            conn.execute(text("""
                CREATE TABLE payruns (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    date_start DATE NOT NULL,
                    date_end DATE NOT NULL,
                    status VARCHAR(20) DEFAULT 'draft',
                    structure_id INTEGER,
                    total_basic NUMERIC(12, 2) DEFAULT 0.00,
                    total_gross NUMERIC(12, 2) DEFAULT 0.00,
                    total_net NUMERIC(12, 2) DEFAULT 0.00,
                    payslip_count INTEGER DEFAULT 0,
                    warning_count INTEGER DEFAULT 0
                );
            """))
            conn.execute(text("""
                CREATE TABLE payslips (
                    id INTEGER PRIMARY KEY,
                    payrun_id INTEGER,
                    employee_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    structure_id INTEGER,
                    date_from DATE NOT NULL,
                    date_to DATE NOT NULL,
                    basic_wage NUMERIC(12, 2) DEFAULT 0.00,
                    gross_wage NUMERIC(12, 2) DEFAULT 0.00,
                    total_deductions NUMERIC(12, 2) DEFAULT 0.00,
                    net_wage NUMERIC(12, 2) DEFAULT 0.00,
                    status VARCHAR(20) DEFAULT 'draft',
                    has_warning BOOLEAN DEFAULT 0,
                    warning_message TEXT,
                    bank_account VARCHAR(50),
                    ifsc_code VARCHAR(20),
                    email_sent BOOLEAN DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))

            # Seed Test Data
            conn.execute(text("""
                INSERT INTO departments (id, name, code) VALUES
                (1, 'Engineering', 'ENG'),
                (2, 'Sales', 'SALES');
            """))
            conn.execute(text("""
                INSERT INTO employees (id, first_name, last_name, email, phone, department_id, bank_account_number, bank_ifsc, status) VALUES
                (1, 'Alice', 'Smith', 'alice@test.local', '+1-555-0101', 1, 'ACCT00010101', 'PPAY0001234', 'active'),
                (2, 'Bob', 'Jones', 'bob@test.local', NULL, 2, NULL, NULL, 'active');
            """))
            conn.execute(text("""
                INSERT INTO contracts (id, employee_id, wage, start_date, status) VALUES
                (1, 1, 10000.00, '2026-01-01', 'active'),
                (2, 2, 8000.00, '2026-01-01', 'active');
            """))
            conn.execute(text("""
                INSERT INTO leave_requests (id, employee_id, holiday_type, date_from, date_to, number_of_days, status) VALUES
                (1, 1, 'PTO', '2026-08-01', '2026-08-05', 5.00, 'approved');
            """))
            conn.execute(text("""
                INSERT INTO payruns (id, name, date_start, date_end, status, total_net) VALUES
                (1, 'August 2026 Monthly Payroll', '2026-08-01', '2026-08-31', 'paid', 7500.00);
            """))
            conn.execute(text("""
                INSERT INTO payslips (id, payrun_id, employee_id, date_from, date_to, basic_wage, gross_wage, net_wage, status, bank_account, ifsc_code) VALUES
                (1, 1, 1, '2026-08-01', '2026-08-31', 5000.00, 8500.00, 7500.00, 'paid', 'ACCT00010101', 'PPAY0001234');
            """))
            conn.commit()

    def setUp(self):
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_ping(self):
        res = ping()
        self.assertEqual(res, {"module": "analytics_ready"})

    def test_dashboard_analytics_kpis_and_alerts(self):
        data = get_dashboard_analytics(self.db)
        # Verify KPIs
        self.assertEqual(data.kpis.total_net_paid, 7500.00)
        self.assertEqual(data.kpis.payslip_count, 1)
        self.assertEqual(data.kpis.total_payslips, 1)
        self.assertEqual(data.total_net_paid, 7500.00)
        self.assertEqual(data.total_payslips, 1)
        self.assertEqual(data.kpis.avg_salary, 9000.00)  # (10000 + 8000)/2
        self.assertEqual(data.kpis.approved_leave_days, 5.00)
        self.assertEqual(data.kpis.active_employees_count, 2)

        # Verify Department Spend & Cost Breakdown
        self.assertGreaterEqual(len(data.department_spend), 2)
        self.assertGreaterEqual(len(data.department_costs), 2)
        eng_spend = next(d for d in data.department_spend if d.department_name == "Engineering")
        self.assertGreater(eng_spend.total_gross, 0.0)

        # Verify Monthly Trends
        self.assertGreaterEqual(len(data.monthly_trends), 1)
        self.assertEqual(data.monthly_trends[0].period_start, "2026-08-01")
        self.assertEqual(data.monthly_trends[0].net_wage, 7500.00)

        # Verify Compliance Alerts (Employee 2 has missing phone/bank)
        missing_bank_alerts = [a for a in data.compliance_alerts if a.type == "missing_banking"]
        self.assertEqual(len(missing_bank_alerts), 1)
        self.assertEqual(missing_bank_alerts[0].employee_id, 2)
        self.assertEqual(missing_bank_alerts[0].issue, "Missing Bank Account or IFSC Details")
        self.assertEqual(missing_bank_alerts[0].severity, "warning")
        self.assertEqual(len(data.attention_alerts), 1)
        self.assertEqual(data.attention_alerts[0].employee_id, 2)
        self.assertEqual(data.attention_alerts[0].issue, "Missing Bank Account or IFSC Details")
        self.assertEqual(data.attention_alerts[0].severity, "warning")

    def test_export_bank_file(self):
        from fastapi.responses import StreamingResponse
        response = export_bank_file(1, self.db)
        self.assertTrue(isinstance(response, StreamingResponse))
        self.assertEqual(response.media_type, "text/csv")
        self.assertIn("attachment; filename=", response.headers["Content-Disposition"])
        content = response.body.decode("utf-8")
        self.assertIn("Transaction_Ref,Beneficiary_Name,Account_Number,IFSC_Code,Amount,Remarks", content)
        self.assertIn("Alice Smith", content)
        self.assertIn("ACCT00010101", content)
        self.assertIn("7500.00", content)

    def test_send_payslips(self):
        response = send_payslips_batch(1, self.db)
        self.assertTrue(response.success)
        self.assertEqual(response.payrun_id, 1)
        self.assertEqual(response.dispatched_count, 1)
        self.assertEqual(response.toast.type, "success")


if __name__ == "__main__":
    unittest.main()
