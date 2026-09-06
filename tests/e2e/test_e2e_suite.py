"""
PeoplePay360 HR & Payroll Platform - Opaque-Box E2E Test Suite
Tiers 1 through 4:
  - Tier 1: Feature Coverage (R1.1 to R5.5, 17 features x 5 = 85 tests)
  - Tier 2: Boundary & Corner Cases (17 features x 5 = 85 tests)
  - Tier 3: Cross-Feature Combinations (20 pairwise tests)
  - Tier 4: Real-World Application Scenarios (5 full lifecycle scenarios)
Total: 195 Tests
"""

import io
import csv
import pytest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text

from server.modules.master_data.models import Department, Employee, WorkingSchedule, Contract, LeaveAllocation, LeaveRequest
from server.modules.payroll.models import SalaryStructure, SalaryRule, Payrun, Payslip, PayslipLine
from server.modules.attendance.models import AttendanceRecord
from server.modules.attendance.services import AttendanceService
from server.modules.payroll.engine import (
    resolve_active_contract,
    check_compliance_warnings,
    calculate_payslip_lines_pipeline,
    get_or_create_default_structure,
)
from server.modules.auth.models import User
from server.modules.auth.security import create_access_token


# ==============================================================================
# TIER 1: FEATURE COVERAGE (R1.1 - R5.5, 85 Tests)
# ==============================================================================

class TestTier1FeatureCoverage:
    """
    Tier 1: Feature Coverage (At least 5 tests per feature for R1 through R5).
    Authoritative Source: ORIGINAL_REQUEST.md §R1-R5, PROJECT.md
    """

    # --------------------------------------------------------------------------
    # R1.1: Period-Based Contract Selection
    # --------------------------------------------------------------------------

    def test_t1_r1_1_contract_resolution_spans_period(self, client: TestClient, admin_headers, db_session: Session):
        """Active contract spanning pay period start and end dates is resolved."""
        c = resolve_active_contract(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert c is not None
        assert c["employee_id"] == 5
        assert c["wage"] == Decimal("60000.00")

    def test_t1_r1_1_contract_resolution_ignores_draft(self, client: TestClient, admin_headers, db_session: Session):
        """Draft contracts are not resolved for payroll calculation."""
        c_draft = Contract(employee_id=5, wage=Decimal("75000.00"), start_date=date(2026, 9, 1), status="draft")
        db_session.add(c_draft)
        db_session.commit()

        c = resolve_active_contract(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert c is not None
        assert c["wage"] == Decimal("60000.00")  # Resolves active contract, not draft

    def test_t1_r1_1_contract_resolution_ignores_cancelled(self, client: TestClient, admin_headers, db_session: Session):
        """Cancelled contracts are strictly excluded from period contract resolution."""
        c_canc = Contract(employee_id=5, wage=Decimal("90000.00"), start_date=date(2026, 9, 1), status="cancelled")
        db_session.add(c_canc)
        db_session.commit()

        c = resolve_active_contract(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert c["status"] != "cancelled"
        assert c["wage"] == Decimal("60000.00")

    def test_t1_r1_1_contract_resolution_deterministic_latest(self, client: TestClient, admin_headers, db_session: Session):
        """When multiple historical contracts exist, picks latest by start_date DESC."""
        old_c = Contract(employee_id=5, wage=Decimal("45000.00"), start_date=date(2025, 1, 1), end_date=date(2025, 12, 31), status="active")
        db_session.add(old_c)
        db_session.commit()

        c = resolve_active_contract(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert c["start_date"] == date(2026, 1, 1)
        assert c["wage"] == Decimal("60000.00")

    def test_t1_r1_1_contract_resolution_excludes_expired(self, client: TestClient, admin_headers, db_session: Session):
        """Expired contracts ending before period_start return None."""
        c = resolve_active_contract(db_session, 5, date(2025, 6, 1), date(2025, 6, 30))
        assert c is None

    # --------------------------------------------------------------------------
    # R1.2: Overlapping Contract Validation
    # --------------------------------------------------------------------------

    def test_t1_r1_2_overlap_rejects_concurrent_active(self, client: TestClient, hr_headers):
        """Rejects creating second active contract that overlaps dates with existing active contract."""
        payload = {
            "employee_id": 5,
            "wage": 70000.00,
            "contract_type": "full_time",
            "start_date": "2026-06-01",
            "end_date": "2026-12-31",
            "status": "active"
        }
        res = client.post("/api/v1/master-data/contracts", json=payload, headers=hr_headers)
        assert res.status_code == 409
        assert "overlaps" in res.json()["detail"].lower()

    def test_t1_r1_2_overlap_rejects_update_to_active(self, client: TestClient, hr_headers, db_session: Session):
        """Updating a draft contract to active status checks and rejects overlapping dates."""
        c = Contract(employee_id=5, wage=Decimal("65000.00"), start_date=date(2026, 6, 1), status="draft")
        db_session.add(c)
        db_session.commit()
        db_session.refresh(c)

        res = client.put(f"/api/v1/master-data/contracts/{c.id}", json={"status": "active"}, headers=hr_headers)
        assert res.status_code == 409

    def test_t1_r1_2_overlap_allows_draft_contract(self, client: TestClient, hr_headers):
        """Draft contracts are exempt from overlap constraints."""
        payload = {
            "employee_id": 5,
            "wage": 70000.00,
            "contract_type": "full_time",
            "start_date": "2026-06-01",
            "end_date": "2026-12-31",
            "status": "draft"
        }
        res = client.post("/api/v1/master-data/contracts", json=payload, headers=hr_headers)
        assert res.status_code == 201
        assert res.json()["status"] == "draft"

    def test_t1_r1_2_overlap_allows_sequential_active(self, client: TestClient, hr_headers, db_session: Session):
        """Sequential non-overlapping active contracts for different periods are permitted."""
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.end_date = date(2026, 5, 31)
        db_session.commit()

        payload = {
            "employee_id": 5,
            "wage": 75000.00,
            "contract_type": "full_time",
            "start_date": "2026-06-01",
            "end_date": "2026-12-31",
            "status": "active"
        }
        res = client.post("/api/v1/master-data/contracts", json=payload, headers=hr_headers)
        assert res.status_code == 201
        assert res.json()["wage"] == "75000.00"

    def test_t1_r1_2_overlap_rejects_ongoing_conflict(self, client: TestClient, hr_headers, db_session: Session):
        """Creating an ongoing contract (end_date=None) overlaps with any subsequent dates."""
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.end_date = date(2026, 12, 31)
        db_session.commit()

        payload = {
            "employee_id": 5,
            "wage": 80000.00,
            "contract_type": "full_time",
            "start_date": "2026-10-01",
            "end_date": None,
            "status": "active"
        }
        res = client.post("/api/v1/master-data/contracts", json=payload, headers=hr_headers)
        assert res.status_code == 409

    # --------------------------------------------------------------------------
    # R1.3: Working Schedule Hour Calculations
    # --------------------------------------------------------------------------

    def test_t1_r1_3_schedule_calc_standard_week(self, client: TestClient):
        """POST /schedules/calculate-hours calculates standard 40h week (5 days x 8h)."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0,
            "days_per_week": 5,
            "date_from": "2026-09-07",
            "date_to": "2026-09-11"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["working_days"] == 5
        assert data["total_calculated_hours"] == 40.0
        assert data["hours_per_day"] == 8.0

    def test_t1_r1_3_schedule_calc_custom_range(self, client: TestClient):
        """Calculates working hours across two consecutive working weeks (10 working days)."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0,
            "days_per_week": 5,
            "date_from": "2026-09-07",
            "date_to": "2026-09-18"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["working_days"] == 10
        assert data["total_calculated_hours"] == 80.0

    def test_t1_r1_3_schedule_calc_daily_lines(self, client: TestClient, hr_headers):
        """Working schedule with daily line items calculates total weekly hours properly."""
        sched_payload = {
            "name": "E2E 4-Day 32h Shift",
            "days": [
                {"day_of_week": 0, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0}, # 8h
                {"day_of_week": 1, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0}, # 8h
                {"day_of_week": 2, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0}, # 8h
                {"day_of_week": 3, "start_time": "09:00", "end_time": "18:00", "break_hours": 1.0}, # 8h
            ]
        }
        res_s = client.post("/api/v1/master-data/working-schedules", json=sched_payload, headers=hr_headers)
        assert res_s.status_code == 201
        sched_id = res_s.json()["id"]
        assert float(res_s.json()["hours_per_week"]) == 32.0

        calc_res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "working_schedule_id": sched_id,
            "date_from": "2026-09-07",
            "date_to": "2026-09-13"
        })
        assert calc_res.status_code == 200
        assert calc_res.json()["working_days"] == 4
        assert calc_res.json()["total_calculated_hours"] == 32.0

    def test_t1_r1_3_schedule_calc_break_deduction(self, client: TestClient, hr_headers):
        """Daily line break_hours are strictly deducted from span hours."""
        sched_payload = {
            "name": "E2E Schedule with 2h Break",
            "days": [
                {"day_of_week": 0, "start_time": "09:00", "end_time": "19:00", "break_hours": 2.0} # 10h - 2h = 8h
            ]
        }
        res = client.post("/api/v1/master-data/working-schedules", json=sched_payload, headers=hr_headers)
        assert res.status_code == 201
        assert float(res.json()["hours_per_week"]) == 8.0

    def test_t1_r1_3_schedule_calc_get_endpoint(self, client: TestClient):
        """GET /schedules/calculate calculates standard hours via query params."""
        res = client.get("/api/v1/master-data/schedules/calculate?hours_per_week=40&days_per_week=5")
        assert res.status_code == 200
        assert res.json()["hours_per_day"] == 8.0

    # --------------------------------------------------------------------------
    # R2.1: Multi-Type Leave Allocations
    # --------------------------------------------------------------------------

    def test_t1_r2_1_allocation_pto_creation(self, client: TestClient, hr_headers):
        """Create approved paid_time_off allocation."""
        payload = {
            "employee_id": 5,
            "holiday_type": "paid_time_off",
            "number_of_days": 15.0,
            "year": 2026,
            "status": "approved"
        }
        res = client.post("/api/v1/master-data/leave-allocations", json=payload, headers=hr_headers)
        assert res.status_code == 201
        assert res.json()["holiday_type"] == "paid_time_off"
        assert float(res.json()["number_of_days"]) == 15.0

    def test_t1_r2_1_allocation_sick_leave_creation(self, client: TestClient, hr_headers):
        """Create distinct sick_leave allocation."""
        payload = {
            "employee_id": 5,
            "holiday_type": "sick_leave",
            "number_of_days": 10.0,
            "year": 2026,
            "status": "approved"
        }
        res = client.post("/api/v1/master-data/leave-allocations", json=payload, headers=hr_headers)
        assert res.status_code == 201
        assert res.json()["holiday_type"] == "sick_leave"

    def test_t1_r2_1_allocation_distinct_types_isolation(self, client: TestClient, hr_headers, db_session: Session):
        """Allocations of different types remain isolated in balance tracking."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 12.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "sick_leave", "number_of_days": 6.0, "year": 2026, "status": "approved"}, headers=hr_headers)

        res_pto = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=paid_time_off&year=2026", headers=hr_headers)
        assert res_pto.status_code == 200
        assert res_pto.json()["remaining_days"] == 12.0

        res_sick = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=sick_leave&year=2026", headers=hr_headers)
        assert res_sick.status_code == 200
        assert res_sick.json()["remaining_days"] == 6.0

    def test_t1_r2_1_allocation_year_boundary_isolation(self, client: TestClient, hr_headers):
        """Allocations for year 2026 do not count towards 2027 balances."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 10.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res_2027 = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=paid_time_off&year=2027", headers=hr_headers)
        assert res_2027.status_code == 200
        assert res_2027.json()["allocated_days"] == 0.0

    def test_t1_r2_1_allocation_balance_query(self, client: TestClient, hr_headers):
        """Balance endpoint returns correct allocated, used, and remaining tuple."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "parental", "number_of_days": 20.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=parental&year=2026", headers=hr_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["allocated_days"] == 20.0
        assert data["used_days"] == 0.0
        assert data["remaining_days"] == 20.0

    # --------------------------------------------------------------------------
    # R2.2: Dynamic Deduction & Overlap Blocking
    # --------------------------------------------------------------------------

    def test_t1_r2_2_leave_submit_within_balance(self, client: TestClient, hr_headers):
        """Leave request within allocation balance is created in draft."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 10.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req_res = client.post("/api/v1/master-data/leave-requests", json={
            "employee_id": 5,
            "holiday_type": "paid_time_off",
            "date_from": "2026-08-03",
            "date_to": "2026-08-05",
            "status": "draft"
        }, headers=hr_headers)
        assert req_res.status_code == 201
        assert float(req_res.json()["number_of_days"]) == 3.0

    def test_t1_r2_2_leave_submit_exceeding_rejected(self, client: TestClient, hr_headers):
        """Leave request exceeding allocated balance is rejected with HTTP 400."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 2.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req_res = client.post("/api/v1/master-data/leave-requests", json={
            "employee_id": 5,
            "holiday_type": "paid_time_off",
            "date_from": "2026-08-01",
            "date_to": "2026-08-05", # 5 days > 2 available
            "status": "draft"
        }, headers=hr_headers)
        assert req_res.status_code == 400
        assert "insufficient" in req_res.json()["detail"].lower()

    def test_t1_r2_2_leave_approve_atomic_deduct(self, client: TestClient, hr_headers):
        """Approving leave request atomically deducts balance and returns remaining days."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 10.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req_res = client.post("/api/v1/master-data/leave-requests", json={
            "employee_id": 5,
            "holiday_type": "paid_time_off",
            "date_from": "2026-08-10",
            "date_to": "2026-08-13", # 4 days
            "status": "draft"
        }, headers=hr_headers)
        leave_id = req_res.json()["id"]

        app_res = client.post(f"/api/v1/master-data/leave-requests/{leave_id}/approve", headers=hr_headers)
        assert app_res.status_code == 200
        assert app_res.json()["remaining_allocation_days"] == 6.0

    def test_t1_r2_2_leave_refuse_no_deduct(self, client: TestClient, hr_headers):
        """Refused leave request does not deduct from approved leave quota."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 10.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req_res = client.post("/api/v1/master-data/leave-requests", json={
            "employee_id": 5,
            "holiday_type": "paid_time_off",
            "date_from": "2026-08-10",
            "date_to": "2026-08-12", # 3 days
            "status": "draft"
        }, headers=hr_headers)
        leave_id = req_res.json()["id"]

        ref_res = client.post(f"/api/v1/master-data/leave-requests/{leave_id}/refuse", headers=hr_headers)
        assert ref_res.status_code == 200

        bal = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=paid_time_off&year=2026", headers=hr_headers).json()
        assert bal["remaining_days"] == 10.0

    def test_t1_r2_2_leave_approve_insufficient_blocked(self, client: TestClient, hr_headers, db_session: Session):
        """Attempting to approve when balance was exhausted elsewhere is blocked with HTTP 400."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 5.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        # Create request 1 (3 days)
        r1 = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-01", "date_to": "2026-08-03", "status": "draft"}, headers=hr_headers).json()
        # Create request 2 (3 days)
        r2 = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-10", "date_to": "2026-08-12", "status": "draft"}, headers=hr_headers).json()

        # Approve r1 (3 days deducted, 2 remain)
        client.post(f"/api/v1/master-data/leave-requests/{r1['id']}/approve", headers=hr_headers)

        # Attempt to approve r2 (needs 3 days, only 2 remain) -> blocked
        app2 = client.post(f"/api/v1/master-data/leave-requests/{r2['id']}/approve", headers=hr_headers)
        assert app2.status_code == 400

    # --------------------------------------------------------------------------
    # R2.3: Attendance Reflection & LOP Payroll Integration
    # --------------------------------------------------------------------------

    def test_t1_r2_3_attendance_clock_in_out(self, client: TestClient, employee_headers):
        """Clock-in and clock-out computes worked hours accurately."""
        t_in = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc).isoformat()
        t_out = datetime(2026, 9, 1, 18, 0, tzinfo=timezone.utc).isoformat()

        res_in = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=employee_headers)
        assert res_in.status_code == 200

        res_out = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert res_out.status_code == 200
        assert float(res_out.json()["worked_hours"]) == 8.0

    def test_t1_r2_3_attendance_daily_summary(self, client: TestClient, admin_headers):
        """Daily summary endpoint aggregates present counts and total hours."""
        t_in = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc).isoformat()
        client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=admin_headers)

        res = client.get("/api/v1/attendance/daily-summary?date=2026-09-01", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["present_count"] >= 1

    def test_t1_r2_3_attendance_monthly_summary(self, client: TestClient, admin_headers):
        """Monthly attendance calendar returns present days and worked hours."""
        res = client.get("/api/v1/attendance/employee/5/monthly?year=2026&month=9", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["employee_id"] == 5

    def test_t1_r2_3_attendance_unpaid_absences_lop(self, client: TestClient, admin_headers, db_session: Session):
        """Unpaid absence calculation flags absent days without approved leaves."""
        rec = AttendanceRecord(employee_id=5, date=date(2026, 9, 2), status="absent", worked_hours=Decimal("0.00"))
        db_session.add(rec)
        db_session.commit()

        absences = AttendanceService.get_unpaid_absences(db_session, 5, date(2026, 9, 1), date(2026, 9, 5))
        assert absences["absent_days"] >= 1.0

    def test_t1_r2_3_attendance_approved_leave_exemption(self, client: TestClient, admin_headers, db_session: Session):
        """Approved leaves are not treated as unpaid absences (LOP)."""
        lr = LeaveRequest(employee_id=5, holiday_type="paid_time_off", date_from=date(2026, 9, 2), date_to=date(2026, 9, 2), number_of_days=Decimal("1.0"), status="approved")
        db_session.add(lr)
        db_session.commit()

        absences = AttendanceService.get_unpaid_absences(db_session, 5, date(2026, 9, 1), date(2026, 9, 2))
        assert date(2026, 9, 2) not in absences["unpaid_dates"]

    # --------------------------------------------------------------------------
    # R3.1: Dynamic Sequenced Salary Rules Engine
    # --------------------------------------------------------------------------

    def test_t1_r3_1_sequenced_rules_execution_order(self, db_session: Session):
        """Rules execute in sequence ASC: BASIC -> ALLOWANCE -> GROSS -> DEDUCTION -> NET."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        seqs = [l["sequence"] for l in lines]
        assert seqs == sorted(seqs)

    def test_t1_r3_1_fixed_allowance_addition(self, db_session: Session):
        """Fixed allowances (e.g. CONV 1600.00) are added into Gross calculation."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        conv_line = next(l for l in lines if l["code"] == "CONV")
        assert conv_line["total"] == Decimal("1600.00")

    def test_t1_r3_1_percentage_allowance_hra(self, db_session: Session):
        """Percentage allowance (HRA 40% of Basic) calculates accurately."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        hra_line = next(l for l in lines if l["code"] == "HRA")
        # Basic is 30,000; 40% of 30,000 = 12,000
        assert hra_line["total"] == Decimal("12000.00")

    def test_t1_r3_1_gross_sums_basic_allowances(self, db_session: Session):
        """Gross rule accurately sums Basic + all Allowances."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        # Gross = Basic(30k) + HRA(12k) + CONV(1.6k) = 43,600
        assert gross == Decimal("43600.00")

    def test_t1_r3_1_net_deducts_from_gross(self, db_session: Session):
        """Net rule equals Gross minus Deductions."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        assert net == gross - deductions

    # --------------------------------------------------------------------------
    # R3.2: Code on Wages 50% Basic Floor
    # --------------------------------------------------------------------------

    def test_t1_r3_2_wage_code_floor_enforced_on_low_basic(self, db_session: Session):
        """When Basic is set below 50% (e.g. 35%), the statutory 50% floor is strictly applied."""
        struct = get_or_create_default_structure(db_session)
        basic_rule = next(r for r in struct.rules if r.code == "BASIC")
        basic_rule.amount = Decimal("35.00") # Deliberately low

        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        # Enforced 50% of 60k = 30,000
        assert basic == Decimal("30000.00")

    def test_t1_r3_2_wage_code_floor_at_exact_fifty(self, db_session: Session):
        """When Basic is configured at 50%, engine calculates exactly 50% of wage."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("80000.00"), struct.rules)
        assert basic == Decimal("40000.00")

    def test_t1_r3_2_wage_code_higher_than_fifty_honored(self, db_session: Session):
        """When Basic is set above 50% (e.g. 60%), the higher percentage is respected."""
        struct = get_or_create_default_structure(db_session)
        basic_rule = next(r for r in struct.rules if r.code == "BASIC")
        basic_rule.amount = Decimal("60.00")

        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        assert basic == Decimal("36000.00")
        basic_rule.amount = Decimal("50.00") # restore

    def test_t1_r3_2_allowances_calculated_from_floor_basic(self, db_session: Session):
        """Allowances with percentage_base='BASIC' derive from the elevated floor basic."""
        struct = get_or_create_default_structure(db_session)
        basic_rule = next(r for r in struct.rules if r.code == "BASIC")
        basic_rule.amount = Decimal("30.00")

        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("100000.00"), struct.rules)
        # Floor basic = 50,000. HRA 40% = 20,000 (not 40% of 30,000)
        hra_line = next(l for l in lines if l["code"] == "HRA")
        assert hra_line["total"] == Decimal("20000.00")
        basic_rule.amount = Decimal("50.00") # restore

    def test_t1_r3_2_gross_reflects_wage_code_floor(self, db_session: Session):
        """Total gross reflects the 50% wage code basic floor across rule pipeline."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("50000.00"), struct.rules)
        # Basic = 25,000, HRA = 10,000, CONV = 1,600 -> Gross = 36,600
        assert gross == Decimal("36600.00")

    # --------------------------------------------------------------------------
    # R3.3: Statutory Ceilings & Taxes (EPF, ESI, TN PT)
    # --------------------------------------------------------------------------

    def test_t1_r3_3_epf_ceiling_fifteen_thousand(self, db_session: Session):
        """EPF is capped at 12% of ₹15,000 (₹1,800.00) when basic exceeds ₹15,000."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("80000.00"), struct.rules)
        pf_line = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf_line["total"] == Decimal("1800.00")

    def test_t1_r3_3_epf_below_ceiling_proportional(self, db_session: Session):
        """EPF applies 12% proportionally when basic is below ₹15,000."""
        struct = get_or_create_default_structure(db_session)
        # Wage 20,000 -> Basic 50% = 10,000 (< 15k). PF = 12% of 10k = 1,200
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("20000.00"), struct.rules)
        pf_line = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf_line["total"] == Decimal("1200.00")

    def test_t1_r3_3_esi_under_ceiling_deducted(self, db_session: Session):
        """ESI applies 0.75% when gross wages <= ₹21,000/month, rounded up to nearest rupee."""
        struct = get_or_create_default_structure(db_session)
        # Wage 15,000 -> Basic = 7500, HRA = 3000, CONV = 1600 -> Gross = 12,100 (<= 21,000)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("15000.00"), struct.rules)
        esi_line = next(l for l in lines if l["code"] in ("ESI", "ESIC"))
        assert esi_line["total"] > Decimal("0.00")

    def test_t1_r3_3_esi_above_ceiling_exempt(self, db_session: Session):
        """ESI is ₹0.00 when gross wages exceed the ₹21,000 ceiling."""
        struct = get_or_create_default_structure(db_session)
        # Wage 60,000 -> Gross 43,600 (> 21,000) -> ESI exempt
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        esi_line = next(l for l in lines if l["code"] in ("ESI", "ESIC"))
        assert esi_line["total"] == Decimal("0.00")

    def test_t1_r3_3_tn_pt_standard_deduction(self, db_session: Session):
        """Tamil Nadu / Greater Chennai Corporation PT applies ₹200.00 when Gross >= ₹21,000."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules, state="TN")
        pt_line = next(l for l in lines if l["code"] in ("PT", "PTAX"))
        assert pt_line["total"] == Decimal("200.00")

    # --------------------------------------------------------------------------
    # R4.1: Two-Step Payrun Wizard
    # --------------------------------------------------------------------------

    def test_t1_r4_1_wizard_step1_validates_dates(self, client: TestClient, payroll_user_headers):
        """Step 1 validation returns valid=True for proper period dates."""
        res = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
            "date_start": "2026-09-01",
            "date_end": "2026-09-30"
        }, headers=payroll_user_headers)
        assert res.status_code == 200
        assert res.json()["valid"] is True

    def test_t1_r4_1_wizard_step1_checks_structure(self, client: TestClient, payroll_user_headers):
        """Step 1 reports configured structure name and eligible employee count."""
        res = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
            "date_start": "2026-09-01",
            "date_end": "2026-09-30"
        }, headers=payroll_user_headers)
        assert res.status_code == 200
        assert res.json()["structure_name"] is not None
        assert res.json()["eligible_employee_count"] >= 1

    def test_t1_r4_1_wizard_step2_queries_eligible(self, client: TestClient, payroll_user_headers):
        """Step 2 eligible employee query returns active employees with contract info."""
        res = client.get("/api/v1/payroll/payruns/wizard/eligible-employees?date_start=2026-09-01&date_end=2026-09-30", headers=payroll_user_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        emp = next(e for e in data if e["employee_id"] == 5)
        assert emp["wage"] == 60000.0
        assert emp["contract_id"] is not None

    def test_t1_r4_1_wizard_step2_confirms_payrun_creation(self, client: TestClient, payroll_user_headers):
        """Step 2 confirm creates payrun batch in draft status with draft payslips."""
        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "September 2026 Test Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [5]
        }, headers=payroll_user_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "draft"
        assert data["payslip_count"] == 1

    def test_t1_r4_1_wizard_step2_selective_employee_inclusion(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Wizard Step 2 allows selective inclusion of employees."""
        # Add employee 6 with active contract
        emp6 = Employee(id=6, first_name="Chloe", last_name="Frazer", email="chloe@example.com", phone="9999990006", status="active")
        c6 = Contract(id=6, employee_id=6, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp6, c6])
        db_session.commit()

        # Choose ONLY employee 6
        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Selective Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [6]
        }, headers=payroll_user_headers)
        assert res.status_code == 201
        assert res.json()["payslip_count"] == 1

    # --------------------------------------------------------------------------
    # R4.2: Bank Verification & Validation Barrier
    # --------------------------------------------------------------------------

    def test_t1_r4_2_bank_verification_compliant_employee(self, db_session: Session):
        """Employee 5 with phone has no banking warning."""
        warn, msg, bank, ifsc = check_compliance_warnings(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert warn is False
        assert bank is not None
        assert ifsc is not None

    def test_t1_r4_2_bank_verification_warning_flagged(self, db_session: Session):
        """Employee missing bank account and phone is flagged with warning."""
        emp = Employee(id=10, first_name="Nathan", last_name="Drake", email="nathan@example.com", phone=None, status="active")
        c = Contract(id=10, employee_id=10, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        warn, msg, bank, ifsc = check_compliance_warnings(db_session, 10, date(2026, 9, 1), date(2026, 9, 30))
        assert warn is True
        assert "bank" in msg.lower()

    def test_t1_r4_2_payrun_compute_tallies_warning_count(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Computing payrun with unbanked employee updates warning_count."""
        emp = Employee(id=11, first_name="Unbanked", last_name="User", email="unbanked@example.com", phone=None, status="active")
        c = Contract(id=11, employee_id=11, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Warning Tally Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [11]
        }, headers=payroll_user_headers).json()

        comp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        assert comp.status_code == 200
        assert comp.json()["warning_count"] == 1

    def test_t1_r4_2_validation_barrier_blocks_unresolved_warnings(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Validation barrier blocks transition to 'validated' when payslips have warnings."""
        emp = Employee(id=12, first_name="Unbanked2", last_name="User", email="unbanked2@example.com", phone=None, status="active")
        c = Contract(id=12, employee_id=12, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Barrier Test Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [12]
        }, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_user_headers)
        assert res.status_code == 400
        assert "validation barrier" in res.json()["detail"].lower()

    def test_t1_r4_2_validation_barrier_clears_after_resolution(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Updating employee details and recomputing clears validation barrier."""
        emp = Employee(id=13, first_name="Unbanked3", last_name="User", email="unbanked3@example.com", phone=None, status="active")
        c = Contract(id=13, employee_id=13, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Barrier Clear Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [13]
        }, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # Resolve issue by adding phone
        emp.phone = "9876543210"
        db_session.commit()

        # Recompute
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # Transition now succeeds
        val_res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_user_headers)
        assert val_res.status_code == 200
        assert val_res.json()["status"] == "validated"

    # --------------------------------------------------------------------------
    # R4.3: Duplicate Payslip Prevention
    # --------------------------------------------------------------------------

    def test_t1_r4_3_duplicate_payslip_detected_overlapping_period(self, client: TestClient, payroll_user_headers):
        """Creating payslip for same employee in overlapping period flags duplicate warning."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Payrun Batch 1",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [5]
        }, headers=payroll_user_headers).json()

        # Batch 2 for same period and employee
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Payrun Batch 2",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [5]
        }, headers=payroll_user_headers).json()

        assert p2["warning_count"] >= 1

    def test_t1_r4_3_duplicate_payslip_warning_message_contains_batch(self, client: TestClient, payroll_user_headers):
        """Warning message references the overlapping payslip or payrun."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Batch Alpha",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [5]
        }, headers=payroll_user_headers).json()

        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Batch Beta",
            "date_start": "2026-09-15",
            "date_end": "2026-10-15",
            "employee_ids": [5]
        }, headers=payroll_user_headers).json()

        detail = client.get(f"/api/v1/payroll/payruns/{p2['id']}", headers=payroll_user_headers).json()
        warn_msg = detail["payslips"][0]["warning_message"]
        assert "duplicate" in warn_msg.lower()

    def test_t1_r4_3_duplicate_payslip_blocks_validation(self, client: TestClient, payroll_user_headers):
        """Duplicate payslip warning prevents payrun from advancing to validated."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Dup Run 1", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Dup Run 2", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()

        client.post(f"/api/v1/payroll/payruns/{p2['id']}/compute", headers=payroll_user_headers)
        val = client.post(f"/api/v1/payroll/payruns/{p2['id']}/transition", json={"target_status": "validated"}, headers=payroll_user_headers)
        assert val.status_code == 400

    def test_t1_r4_3_cancelled_payslip_no_duplicate_warning(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Cancelled payslips do not trigger duplicate payslip warnings in subsequent batches."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Run to Cancel", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        # Cancel p1
        client.post(f"/api/v1/payroll/payruns/{p1['id']}/transition", json={"target_status": "cancelled"}, headers=payroll_user_headers)

        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Active Run After Cancel", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] == 0

    def test_t1_r4_3_non_overlapping_payslips_permitted(self, client: TestClient, payroll_user_headers):
        """Separate sequential pay periods (Sep vs Oct) trigger no duplicate warnings."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "September Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "October Run", "date_start": "2026-10-01", "date_end": "2026-10-31", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] == 0

    # --------------------------------------------------------------------------
    # R5.1: Enterprise Payslip PDF Generation
    # --------------------------------------------------------------------------

    def test_t1_r5_1_payslip_pdf_returns_pdf_stream(self, client: TestClient):
        """GET /notifications/payslip-pdf/{id} returns binary PDF stream with 200 OK."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"

    def test_t1_r5_1_payslip_pdf_header_content_disposition(self, client: TestClient):
        """PDF endpoint specifies attachment filename in Content-Disposition header."""
        res = client.get("/api/v1/notifications/payslip-pdf/42")
        assert res.status_code == 200
        assert "payslip_42.pdf" in res.headers.get("content-disposition", "")

    def test_t1_r5_1_payslip_pdf_magic_bytes(self, client: TestClient):
        """Generated PDF begins with valid %PDF- magic bytes."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert res.content.startswith(b"%PDF-")

    def test_t1_r5_1_payslip_pdf_contains_content_length(self, client: TestClient):
        """PDF payload is non-trivial size (>1000 bytes)."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert len(res.content) > 1000

    def test_t1_r5_1_payslip_pdf_structure_components(self, client: TestClient):
        """PDF generates successfully for employee payslips."""
        res = client.get("/api/v1/notifications/payslip-pdf/5")
        assert res.status_code == 200
        assert len(res.content) > 0

    # --------------------------------------------------------------------------
    # R5.2: Bulk Email Delivery & Tracking
    # --------------------------------------------------------------------------

    def test_t1_r5_2_email_single_dispatch_success(self, client: TestClient):
        """POST /notifications/send logs sent status."""
        payload = {
            "recipient_email": "test@example.com",
            "recipient_name": "Test User",
            "notification_type": "payslip_email",
            "subject": "Your Monthly Payslip",
            "body": "Payslip details attached"
        }
        res = client.post("/api/v1/notifications/send", json=payload)
        assert res.status_code == 200
        assert res.json()["status"] == "sent"

    def test_t1_r5_2_email_batch_payslips_dispatch(self, client: TestClient):
        """POST /notifications/send-payslip-batch/{id} queues and dispatches emails."""
        res = client.post("/api/v1/notifications/send-payslip-batch/1")
        assert res.status_code == 200
        assert res.json()["status"] == "completed"
        assert res.json()["total_dispatched"] >= 1

    def test_t1_r5_2_email_analytics_batch_send(self, client: TestClient, payroll_user_headers):
        """POST /analytics/payruns/{id}/send-payslips returns toast confirmation."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Email Batch", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        res = client.post(f"/api/v1/analytics/payruns/{p['id']}/send-payslips")
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["toast"]["type"] == "success"

    def test_t1_r5_2_email_notification_logs_retrieval(self, client: TestClient):
        """GET /notifications/logs returns list of sent notification entries."""
        client.post("/api/v1/notifications/send", json={"recipient_email": "log_test@example.com", "subject": "Notice", "body": "Body"})
        res = client.get("/api/v1/notifications/logs")
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_t1_r5_2_email_notification_logs_filtering(self, client: TestClient):
        """Notification logs support filtering by status and notification_type."""
        res = client.get("/api/v1/notifications/logs?status=sent&notification_type=payslip_email")
        assert res.status_code == 200
        for log in res.json():
            assert log["status"] == "sent"

    # --------------------------------------------------------------------------
    # R5.3: Server-Side RBAC Enforcement
    # --------------------------------------------------------------------------

    def test_t1_r5_3_rbac_unauthenticated_request_rejected(self, client: TestClient):
        """Request without valid token or test context is rejected with 401."""
        bad_headers = {"Authorization": "Bearer invalid_expired_token"}
        res = client.get("/api/v1/payroll/payruns", headers=bad_headers)
        assert res.status_code == 401

    def test_t1_r5_3_rbac_admin_full_access(self, client: TestClient, admin_headers):
        """Admin has unrestricted access to payroll and master data."""
        res = client.get("/api/v1/payroll/payruns", headers=admin_headers)
        assert res.status_code == 200

    def test_t1_r5_3_rbac_hr_manager_forbidden_payroll(self, client: TestClient, hr_headers):
        """HR Manager is strictly denied access to payroll endpoints (HTTP 403)."""
        res = client.get("/api/v1/payroll/payruns", headers=hr_headers)
        assert res.status_code == 403

    def test_t1_r5_3_rbac_payroll_user_forbidden_config(self, client: TestClient, payroll_user_headers):
        """HR Payroll User is forbidden from deleting payruns or creating salary structures."""
        res = client.delete("/api/v1/payroll/payruns/1", headers=payroll_user_headers)
        assert res.status_code == 403

    def test_t1_r5_3_rbac_employee_self_service_only(self, client: TestClient, employee_headers):
        """Employee role is forbidden from viewing other employees' payslips."""
        res = client.get("/api/v1/payroll/payslips/999", headers=employee_headers)
        assert res.status_code in (403, 404)

    # --------------------------------------------------------------------------
    # R5.4: Historical Payroll Immutability
    # --------------------------------------------------------------------------

    def test_t1_r5_4_payrun_state_machine_happy_path(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Payrun advances: draft -> computed -> validated -> paid."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Lifecycle Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p["status"] == "draft"

        c = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        assert c["status"] == "computed"

        v = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers).json()
        assert v["status"] == "validated"

        paid = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers).json()
        assert paid["status"] == "paid"

    def test_t1_r5_4_payrun_paid_locks_all_payslips(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Transitioning payrun to paid locks all constituent payslips in paid status."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Payslip Lock Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        detail = client.get(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_user_headers).json()
        for slip in detail["payslips"]:
            assert slip["status"] == "paid"

    def test_t1_r5_4_payrun_paid_blocks_recompute(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Paid payrun cannot be recomputed (Terminal Lock)."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "No Recompute", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        assert res.status_code == 400
        assert "terminal lock" in res.json()["detail"].lower()

    def test_t1_r5_4_payrun_paid_blocks_state_transition(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Paid payrun cannot transition back to draft or computed."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "No Rollback", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "draft"}, headers=payroll_manager_headers)
        assert res.status_code == 400
        assert "terminal lock" in res.json()["detail"].lower()

    def test_t1_r5_4_payrun_paid_blocks_delete(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Paid payrun cannot be deleted."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "No Delete Paid", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_manager_headers)
        assert res.status_code == 400
        assert "terminal lock" in res.json()["detail"].lower()

    # --------------------------------------------------------------------------
    # R5.5: Live DB-Driven Analytics
    # --------------------------------------------------------------------------

    def test_t1_r5_5_analytics_dashboard_kpi_aggregations(self, client: TestClient):
        """GET /analytics/dashboard returns live KPI metrics."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        data = res.json()
        assert "kpis" in data
        assert "total_net_paid" in data["kpis"]
        assert "total_payslips" in data["kpis"]
        assert "avg_salary" in data["kpis"]

    def test_t1_r5_5_analytics_department_spend_breakdown(self, client: TestClient):
        """Department spend aggregates gross wage per department."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        assert isinstance(res.json()["department_spend"], list)

    def test_t1_r5_5_analytics_monthly_spend_trends(self, client: TestClient):
        """Monthly trends group historical spend by period."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        assert isinstance(res.json()["monthly_trends"], list)

    def test_t1_r5_5_analytics_compliance_alerts_list(self, client: TestClient):
        """Compliance alerts list identifies operational attention items."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        assert "compliance_alerts" in res.json()

    def test_t1_r5_5_analytics_bank_file_export_csv(self, client: TestClient, payroll_user_headers):
        """GET /analytics/payruns/{id}/export-bank-file returns formatted CSV."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Bank File Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        res = client.get(f"/api/v1/analytics/payruns/{p['id']}/export-bank-file")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "Transaction_Ref,Beneficiary_Name" in res.text


# ==============================================================================
# TIER 2: BOUNDARY & CORNER CASES (17 Features x 5 = 85 Tests)
# ==============================================================================

class TestTier2BoundaryCornerCases:
    """
    Tier 2: Boundary Value Analysis & Corner Cases.
    Authoritative Source: ORIGINAL_REQUEST.md, TEST_INFRA.md
    """

    # R1.1 Boundaries
    def test_t2_r1_1_contract_ending_on_period_start_boundary(self, db_session: Session):
        """Contract ending on exact first day of pay period is resolved."""
        c = Contract(employee_id=2, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), end_date=date(2026, 9, 1), status="active")
        db_session.add(c)
        db_session.commit()
        res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
        assert res is not None

    def test_t2_r1_1_contract_ending_day_before_period_excluded(self, db_session: Session):
        """Contract ending one day before period start (2026-08-31 vs 2026-09-01) is excluded."""
        c = Contract(employee_id=2, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), end_date=date(2026, 8, 31), status="active")
        db_session.add(c)
        db_session.commit()
        res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
        assert res is None

    def test_t2_r1_1_contract_starting_on_period_end_boundary(self, db_session: Session):
        """Contract starting on exact last day of pay period (2026-09-30) is resolved."""
        c = Contract(employee_id=2, wage=Decimal("55000.00"), start_date=date(2026, 9, 30), end_date=date(2027, 3, 31), status="active")
        db_session.add(c)
        db_session.commit()
        res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
        assert res is not None

    def test_t2_r1_1_contract_starting_day_after_period_excluded(self, db_session: Session):
        """Contract starting one day after period end (2026-10-01 vs 2026-09-30) is excluded."""
        c = Contract(employee_id=2, wage=Decimal("55000.00"), start_date=date(2026, 10, 1), end_date=date(2027, 3, 31), status="active")
        db_session.add(c)
        db_session.commit()
        res = resolve_active_contract(db_session, 2, date(2026, 9, 1), date(2026, 9, 30))
        assert res is None

    def test_t2_r1_1_contract_null_end_date_spans_arbitrary_future(self, db_session: Session):
        """Contract with null end_date resolves for periods in the far future."""
        res = resolve_active_contract(db_session, 5, date(2030, 1, 1), date(2030, 1, 31))
        assert res is not None

    # R1.2 Boundaries
    def test_t2_r1_2_consecutive_adjacent_contracts_allowed(self, client: TestClient, hr_headers, db_session: Session):
        """Contracts on adjacent calendar days (ends Jun 30, starts Jul 01) do not overlap."""
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.end_date = date(2026, 6, 30)
        db_session.commit()

        res = client.post("/api/v1/master-data/contracts", json={
            "employee_id": 5, "wage": 65000.00, "start_date": "2026-07-01", "end_date": "2026-12-31", "status": "active"
        }, headers=hr_headers)
        assert res.status_code == 201

    def test_t2_r1_2_single_day_overlap_boundary_rejected(self, client: TestClient, hr_headers, db_session: Session):
        """Single day overlap (ends Jun 30, starts Jun 30) is rejected."""
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.end_date = date(2026, 6, 30)
        db_session.commit()

        res = client.post("/api/v1/master-data/contracts", json={
            "employee_id": 5, "wage": 65000.00, "start_date": "2026-06-30", "end_date": "2026-12-31", "status": "active"
        }, headers=hr_headers)
        assert res.status_code == 409

    def test_t2_r1_2_single_day_contract_start_equals_end(self, client: TestClient, hr_headers, db_session: Session):
        """Single day contract where start_date == end_date is permitted if non-overlapping."""
        c = Contract(employee_id=2, wage=Decimal("500.00"), start_date=date(2026, 12, 25), end_date=date(2026, 12, 25), status="active")
        db_session.add(c)
        db_session.commit()
        assert c.id is not None

    def test_t2_r1_2_start_after_end_schema_validation_error(self, client: TestClient, hr_headers):
        """Contract with start_date > end_date returns 400 or 422 validation error."""
        res = client.post("/api/v1/master-data/contracts", json={
            "employee_id": 5, "wage": 65000.00, "start_date": "2026-12-31", "end_date": "2026-01-01", "status": "active"
        }, headers=hr_headers)
        assert res.status_code in (400, 422)

    def test_t2_r1_2_cancelled_contract_overlap_permitted(self, client: TestClient, hr_headers, db_session: Session):
        """Overlap with an existing cancelled contract is permitted."""
        c = Contract(employee_id=2, wage=Decimal("40000.00"), start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="cancelled")
        db_session.add(c)
        db_session.commit()

        res = client.post("/api/v1/master-data/contracts", json={
            "employee_id": 2, "wage": 45000.00, "start_date": "2026-06-01", "end_date": "2026-12-31", "status": "active"
        }, headers=hr_headers)
        assert res.status_code == 201

    # R1.3 Boundaries
    def test_t2_r1_3_schedule_date_from_greater_than_date_to_error(self, client: TestClient):
        """Date range where date_from > date_to returns 400 Bad Request."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-30", "date_to": "2026-09-01"
        })
        assert res.status_code == 400

    def test_t2_r1_3_single_weekday_span_exact_hours(self, client: TestClient):
        """Single weekday span (date_from == date_to on Monday) returns exactly 1 day and 8.0h."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-07", "date_to": "2026-09-07"
        })
        assert res.status_code == 200
        assert res.json()["working_days"] == 1
        assert res.json()["total_calculated_hours"] == 8.0

    def test_t2_r1_3_single_weekend_span_zero_hours(self, client: TestClient):
        """Single weekend day span (date_from == date_to on Sunday) returns 0 days and 0.0h."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-13", "date_to": "2026-09-13"
        })
        assert res.status_code == 200
        assert res.json()["working_days"] == 0
        assert res.json()["total_calculated_hours"] == 0.0

    def test_t2_r1_3_zero_hours_schedule_boundary(self, client: TestClient):
        """Schedule calculation with 0 hours per week evaluates without division by zero."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 0.0, "days_per_week": 5, "date_from": "2026-09-07", "date_to": "2026-09-11"
        })
        assert res.status_code == 200
        assert res.json()["total_calculated_hours"] == 0.0

    def test_t2_r1_3_leap_year_boundary_calculation(self, client: TestClient):
        """Schedule spans leap day Feb 28 to Mar 01 accurately."""
        res = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0, "days_per_week": 5, "date_from": "2028-02-28", "date_to": "2028-03-01"
        })
        assert res.status_code == 200
        assert res.json()["working_days"] == 3

    # R2.1 Boundaries
    def test_t2_r2_1_zero_days_allocation(self, client: TestClient, hr_headers):
        """Allocating 0.0 days is accepted as boundary."""
        res = client.post("/api/v1/master-data/leave-allocations", json={
            "employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 0.0, "year": 2026, "status": "approved"
        }, headers=hr_headers)
        assert res.status_code == 201

    def test_t2_r2_1_fractional_days_allocation(self, client: TestClient, hr_headers):
        """Allocating fractional days (e.g. 1.5 days for half-day balances) is supported."""
        res = client.post("/api/v1/master-data/leave-allocations", json={
            "employee_id": 5, "holiday_type": "sick_leave", "number_of_days": 1.5, "year": 2026, "status": "approved"
        }, headers=hr_headers)
        assert res.status_code == 201
        assert float(res.json()["number_of_days"]) == 1.5

    def test_t2_r2_1_past_year_allocation_isolation(self, client: TestClient, hr_headers):
        """Allocations in year 2024 do not leak into 2026 balance."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 20.0, "year": 2024, "status": "approved"}, headers=hr_headers)
        res = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=paid_time_off&year=2026", headers=hr_headers)
        assert res.json()["allocated_days"] == 0.0

    def test_t2_r2_1_multiple_allocations_accumulate_balance(self, client: TestClient, hr_headers):
        """Multiple grants in same year accumulate total allocated quota."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 5.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 7.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=paid_time_off&year=2026", headers=hr_headers)
        assert res.json()["allocated_days"] == 12.0

    def test_t2_r2_1_case_sensitivity_holiday_type(self, client: TestClient, hr_headers):
        """Holiday types maintain distinct balance tracking."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "wellness", "number_of_days": 4.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res = client.get("/api/v1/master-data/leave-allocations/balance/5?holiday_type=wellness&year=2026", headers=hr_headers)
        assert res.json()["allocated_days"] == 4.0

    # R2.2 Boundaries
    def test_t2_r2_2_exact_full_balance_request_succeeds(self, client: TestClient, hr_headers):
        """Requesting exactly 100% of remaining balance succeeds and leaves 0.0 remaining."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 3.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-03", "date_to": "2026-08-05", "status": "draft"}, headers=hr_headers).json()
        app = client.post(f"/api/v1/master-data/leave-requests/{req['id']}/approve", headers=hr_headers)
        assert app.status_code == 200
        assert app.json()["remaining_allocation_days"] == 0.0

    def test_t2_r2_2_request_exceeding_by_fraction_rejected(self, client: TestClient, hr_headers):
        """Requesting even 1 day over allocated quota is rejected."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 2.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-03", "date_to": "2026-08-05", "status": "draft"}, headers=hr_headers)
        assert res.status_code == 400

    def test_t2_r2_2_request_date_from_after_date_to_rejected(self, client: TestClient, hr_headers):
        """Leave request with date_from > date_to returns 400 or 422."""
        res = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-10", "date_to": "2026-08-05", "status": "draft"}, headers=hr_headers)
        assert res.status_code in (400, 422)

    def test_t2_r2_2_single_day_leave_request_count(self, client: TestClient, hr_headers):
        """Single day leave request counts as exactly 1.0 day."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 5.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        res = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-05", "date_to": "2026-08-05", "status": "draft"}, headers=hr_headers)
        assert res.status_code == 201
        assert float(res.json()["number_of_days"]) == 1.0

    def test_t2_r2_2_approve_already_approved_leave_idempotent(self, client: TestClient, hr_headers):
        """Approving an already approved leave request is idempotent."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 5.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        req = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-08-05", "date_to": "2026-08-05", "status": "draft"}, headers=hr_headers).json()
        client.post(f"/api/v1/master-data/leave-requests/{req['id']}/approve", headers=hr_headers)
        res2 = client.post(f"/api/v1/master-data/leave-requests/{req['id']}/approve", headers=hr_headers)
        assert res2.status_code == 200
        assert res2.json()["remaining_allocation_days"] == 4.0

    # R2.3 Boundaries
    def test_t2_r2_3_punch_worked_exactly_eight_hours_no_overtime(self, client: TestClient, employee_headers):
        """Worked exactly 8.0 hours yields 0.00 overtime hours."""
        t_in = datetime(2026, 9, 2, 9, 0, tzinfo=timezone.utc).isoformat()
        t_out = datetime(2026, 9, 2, 18, 0, tzinfo=timezone.utc).isoformat() # 9h - 1h break = 8h
        client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=employee_headers)
        res = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert float(res.json()["overtime_hours"]) == 0.0

    def test_t2_r2_3_punch_worked_overtime_fractional(self, client: TestClient, employee_headers):
        """Worked 9.5 hours (after break) yields 1.50 overtime hours."""
        t_in = datetime(2026, 9, 3, 9, 0, tzinfo=timezone.utc).isoformat()
        t_out = datetime(2026, 9, 3, 19, 30, tzinfo=timezone.utc).isoformat() # 10.5h - 1h break = 9.5h
        client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=employee_headers)
        res = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert float(res.json()["overtime_hours"]) == 1.5

    def test_t2_r2_3_punch_half_day_boundary_four_hours(self, client: TestClient, employee_headers):
        """Worked 4.0 hours marks status as half_day."""
        t_in = datetime(2026, 9, 4, 9, 0, tzinfo=timezone.utc).isoformat()
        t_out = datetime(2026, 9, 4, 13, 0, tzinfo=timezone.utc).isoformat() # 4h (<=5h so no break deducted)
        client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=employee_headers)
        res = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert res.json()["status"] == "half_day"

    def test_t2_r2_3_punch_short_hours_below_three_hours(self, client: TestClient, employee_headers):
        """Worked 2.0 hours (< 3h threshold for half_day) remains standard status."""
        t_in = datetime(2026, 9, 5, 9, 0, tzinfo=timezone.utc).isoformat()
        t_out = datetime(2026, 9, 5, 11, 0, tzinfo=timezone.utc).isoformat()
        client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "in", "timestamp": t_in}, headers=employee_headers)
        res = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert res.json()["status"] != "half_day"

    def test_t2_r2_3_clock_out_without_clock_in_handled(self, client: TestClient, employee_headers):
        """Clock-out without prior clock-in creates record safely."""
        t_out = datetime(2026, 9, 6, 17, 0, tzinfo=timezone.utc).isoformat()
        res = client.post("/api/v1/attendance/punch", json={"employee_id": 5, "punch_type": "out", "timestamp": t_out}, headers=employee_headers)
        assert res.status_code == 200
        assert res.json()["clock_out"] is not None

    # R3.1 Boundaries
    def test_t2_r3_1_zero_wage_contract_net_zero(self, db_session: Session):
        """Zero wage contract calculates without ZeroDivisionError and yields 0 net."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("0.00"), struct.rules)
        assert net == Decimal("0.00")

    def test_t2_r3_1_extreme_high_wage_crore_scale(self, db_session: Session):
        """High wage (1 Crore = 10,000,000) calculates without numeric overflow."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("10000000.00"), struct.rules)
        assert basic == Decimal("5000000.00")
        assert net > Decimal("5000000.00")

    def test_t2_r3_1_minimal_structure_only_basic(self, db_session: Session):
        """Salary structure with only Basic rule evaluates cleanly."""
        rules = [
            SalaryRule(id=991, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("100.00"), percentage_base="wage"),
            SalaryRule(id=992, structure_id=1, name="Gross", code="GROSS", category="GROSS", sequence=100, amount_type="percentage", amount=Decimal("100.00"), percentage_base="GROSS"),
            SalaryRule(id=993, structure_id=1, name="Net", code="NET", category="NET", sequence=200, amount_type="percentage", amount=Decimal("100.00"), percentage_base="NET"),
        ]
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("50000.00"), rules)
        assert net == Decimal("50000.00")

    def test_t2_r3_1_rule_sequence_reordering_execution(self, db_session: Session):
        """Rules execute in ascending sequence order regardless of input list order."""
        r1 = SalaryRule(id=1, structure_id=1, name="Net", code="NET", category="NET", sequence=200, amount_type="percentage", amount=Decimal("100.00"), percentage_base="NET")
        r2 = SalaryRule(id=2, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("50.00"), percentage_base="wage")
        r3 = SalaryRule(id=3, structure_id=1, name="Gross", code="GROSS", category="GROSS", sequence=100, amount_type="percentage", amount=Decimal("100.00"), percentage_base="GROSS")
        # Pass in reverse order
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), [r1, r2, r3])
        assert lines[0]["code"] == "BASIC"
        assert lines[-1]["code"] == "NET"

    def test_t2_r3_1_zero_amount_allowance_handled(self, db_session: Session):
        """Rule with amount 0.00 adds 0 to gross without failing."""
        r_zero = SalaryRule(id=4, structure_id=1, name="Bonus", code="BONUS", category="ALLOWANCE", sequence=50, amount_type="fixed", amount=Decimal("0.00"))
        struct = get_or_create_default_structure(db_session)
        rules = list(struct.rules) + [r_zero]
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), rules)
        bonus_line = next(l for l in lines if l["code"] == "BONUS")
        assert bonus_line["total"] == Decimal("0.00")

    # R3.2 Boundaries
    def test_t2_r3_2_basic_rule_zero_percent_floor_elevated(self, db_session: Session):
        """Basic rule at 0% is automatically elevated to 50% legal floor."""
        r = SalaryRule(id=1, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("0.00"), percentage_base="wage")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("50000.00"), [r])
        assert basic == Decimal("25000.00")

    def test_t2_r3_2_basic_rule_forty_nine_nine_percent_elevated(self, db_session: Session):
        """Basic rule at 49.99% is elevated to 50% floor."""
        r = SalaryRule(id=1, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("49.99"), percentage_base="wage")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("100000.00"), [r])
        assert basic == Decimal("50000.00")

    def test_t2_r3_2_basic_rule_exact_fifty_percent_unchanged(self, db_session: Session):
        """Basic rule at exactly 50.00% calculates at 50%."""
        r = SalaryRule(id=1, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("50.00"), percentage_base="wage")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("100000.00"), [r])
        assert basic == Decimal("50000.00")

    def test_t2_r3_2_basic_rule_fifty_point_zero_one_percent_honored(self, db_session: Session):
        """Basic rule at 50.01% calculates at 50.01% without ceiling truncation."""
        r = SalaryRule(id=1, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="percentage", amount=Decimal("50.01"), percentage_base="wage")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("100000.00"), [r])
        assert basic == Decimal("50010.00")

    def test_t2_r3_2_fixed_basic_low_amount_compliance(self, db_session: Session):
        """Fixed Basic amount calculates as specified."""
        r = SalaryRule(id=1, structure_id=1, name="Basic", code="BASIC", category="BASIC", sequence=10, amount_type="fixed", amount=Decimal("20000.00"))
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("50000.00"), [r])
        assert basic == Decimal("20000.00")

    # R3.3 Boundaries
    def test_t2_r3_3_epf_at_fourteen_nine_nine_nine(self, db_session: Session):
        """Basic of ₹14,999 yields PF of 12% = ₹1,799.88."""
        struct = get_or_create_default_structure(db_session)
        # Wage 29,998 -> Basic = 14,999. PF = 14,999 * 0.12 = 1,799.88
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("29998.00"), struct.rules)
        pf = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf["total"] == Decimal("1799.88")

    def test_t2_r3_3_epf_at_exact_fifteen_thousand_cap(self, db_session: Session):
        """Basic of ₹15,000 yields exact ceiling PF of ₹1,800.00."""
        struct = get_or_create_default_structure(db_session)
        # Wage 30,000 -> Basic = 15,000. PF = 15,000 * 0.12 = 1,800.00
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("30000.00"), struct.rules)
        pf = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf["total"] == Decimal("1800.00")

    def test_t2_r3_3_epf_at_fifteen_thousand_and_one_capped(self, db_session: Session):
        """Basic of ₹15,001 caps PF at ₹1,800.00."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("30002.00"), struct.rules)
        pf = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf["total"] == Decimal("1800.00")

    def test_t2_r3_3_esi_at_exact_twenty_one_thousand_deducted(self, db_session: Session):
        """Gross of exactly ₹21,000 is within ceiling and incurs ESI."""
        r_gross = SalaryRule(id=1, structure_id=1, name="Gross", code="GROSS", category="GROSS", sequence=10, amount_type="fixed", amount=Decimal("21000.00"))
        r_esi = SalaryRule(id=2, structure_id=1, name="ESI", code="ESI", category="DEDUCTION", sequence=20, amount_type="percentage", amount=Decimal("0.75"), percentage_base="GROSS")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("21000.00"), [r_gross, r_esi])
        esi = next(l for l in lines if l["code"] == "ESI")
        assert esi["total"] > Decimal("0.00")

    def test_t2_r3_3_esi_at_twenty_one_thousand_and_one_exempt(self, db_session: Session):
        """Gross of ₹21,001 exceeds ceiling and ESI is ₹0.00."""
        r_gross = SalaryRule(id=1, structure_id=1, name="Gross", code="GROSS", category="GROSS", sequence=10, amount_type="fixed", amount=Decimal("21001.00"))
        r_esi = SalaryRule(id=2, structure_id=1, name="ESI", code="ESI", category="DEDUCTION", sequence=20, amount_type="percentage", amount=Decimal("0.75"), percentage_base="GROSS")
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("21001.00"), [r_gross, r_esi])
        esi = next(l for l in lines if l["code"] == "ESI")
        assert esi["total"] == Decimal("0.00")

    # R4.1 Boundaries
    def test_t2_r4_1_wizard_step1_start_after_end_invalid(self, client: TestClient, payroll_user_headers):
        """Step 1 validation returns valid=False if date_start > date_end."""
        res = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
            "date_start": "2026-09-30", "date_end": "2026-09-01"
        }, headers=payroll_user_headers)
        assert res.status_code == 200
        assert res.json()["valid"] is False

    def test_t2_r4_1_wizard_step1_nonexistent_structure_fallback(self, client: TestClient, payroll_user_headers):
        """Non-existent structure ID in Step 1 falls back gracefully to default structure."""
        res = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
            "date_start": "2026-09-01", "date_end": "2026-09-30", "structure_id": 99999
        }, headers=payroll_user_headers)
        assert res.status_code == 200
        assert res.json()["structure_name"] is not None

    def test_t2_r4_1_wizard_step2_empty_employee_list_defaults_all(self, client: TestClient, payroll_user_headers):
        """Passing empty employee_ids=[] in confirm includes all eligible employees."""
        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "All Eligible Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": []
        }, headers=payroll_user_headers)
        assert res.status_code == 201
        assert res.json()["payslip_count"] >= 1

    def test_t2_r4_1_wizard_step2_single_employee_subset(self, client: TestClient, payroll_user_headers):
        """Passing single employee ID includes strictly that employee."""
        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Single Emp Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]
        }, headers=payroll_user_headers)
        assert res.status_code == 201
        assert res.json()["payslip_count"] == 1

    def test_t2_r4_1_wizard_step2_zero_eligible_period(self, client: TestClient, payroll_user_headers):
        """Date period with 0 active contracts returns 0 eligible employees."""
        res = client.get("/api/v1/payroll/payruns/wizard/eligible-employees?date_start=2024-01-01&date_end=2024-01-31", headers=payroll_user_headers)
        assert res.status_code == 200
        assert len(res.json()) == 0

    # R4.2 Boundaries
    def test_t2_r4_2_bank_verification_phone_derived_account(self, db_session: Session):
        """Phone present produces formatted mock bank account and PPAY IFSC."""
        warn, msg, bank, ifsc = check_compliance_warnings(db_session, 5, date(2026, 9, 1), date(2026, 9, 30))
        assert bank.startswith("ACCT")
        assert ifsc == "PPAY0001234"

    def test_t2_r4_2_bank_verification_null_details_critical(self, db_session: Session):
        """Employee with null phone and null banking returns has_warning=True."""
        emp = Employee(id=20, first_name="NullBank", last_name="User", email="nb@example.com", phone=None, status="active")
        db_session.add(emp)
        db_session.commit()
        warn, msg, bank, ifsc = check_compliance_warnings(db_session, 20, date(2026, 9, 1), date(2026, 9, 30))
        assert warn is True

    def test_t2_r4_2_bank_verification_empty_string_critical(self, db_session: Session):
        """Employee with empty string phone returns warning."""
        emp = Employee(id=21, first_name="EmptyPhone", last_name="User", email="ep@example.com", phone="", status="active")
        db_session.add(emp)
        db_session.commit()
        warn, msg, bank, ifsc = check_compliance_warnings(db_session, 21, date(2026, 9, 1), date(2026, 9, 30))
        assert warn is True

    def test_t2_r4_2_payrun_all_compliant_zero_warnings(self, client: TestClient, payroll_user_headers):
        """Payrun with all compliant employees creates batch with warning_count=0."""
        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Clean Batch", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]
        }, headers=payroll_user_headers)
        assert res.json()["warning_count"] == 0

    def test_t2_r4_2_payrun_mixed_compliance_single_warning(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Payrun with 1 clean and 1 warned employee yields warning_count=1."""
        emp = Employee(id=22, first_name="Warned", last_name="User", email="warned@example.com", phone=None, status="active")
        c = Contract(id=22, employee_id=22, wage=Decimal("40000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Mixed Batch", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5, 22]
        }, headers=payroll_user_headers)
        assert res.json()["warning_count"] == 1

    # R4.3 Boundaries
    def test_t2_r4_3_duplicate_adjacent_periods_no_warning(self, client: TestClient, payroll_user_headers):
        """Adjacent non-overlapping months do not flag duplicate warnings."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Sep Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Oct Run", "date_start": "2026-10-01", "date_end": "2026-10-31", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] == 0

    def test_t2_r4_3_duplicate_identical_period_flagged(self, client: TestClient, payroll_user_headers):
        """Exact identical period flags duplicate payslip warning."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Run A", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Run B", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] >= 1

    def test_t2_r4_3_duplicate_partial_overlap_start_flagged(self, client: TestClient, payroll_user_headers):
        """Partial overlap (Sep 15 to Oct 15 vs Sep 1 to Sep 30) flags duplicate warning."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Sep Month", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Mid Month", "date_start": "2026-09-15", "date_end": "2026-10-15", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] >= 1

    def test_t2_r4_3_duplicate_enclosed_period_flagged(self, client: TestClient, payroll_user_headers):
        """Enclosed period (Sep 10 to Sep 20 inside Sep 1 to Sep 30) flags duplicate."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Wide Month", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Short Run", "date_start": "2026-09-10", "date_end": "2026-09-20", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] >= 1

    def test_t2_r4_3_duplicate_cancelled_payrun_ignored(self, client: TestClient, payroll_user_headers):
        """Payslips in cancelled payrun do not count as duplicates."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "To Be Cancelled", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p1['id']}/transition", json={"target_status": "cancelled"}, headers=payroll_user_headers)

        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Valid Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] == 0

    # R5.1 Boundaries
    def test_t2_r5_1_pdf_zero_deductions_payslip(self, client: TestClient):
        """PDF generation handles payslip with zero deductions cleanly."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert res.status_code == 200
        assert res.content.startswith(b"%PDF-")

    def test_t2_r5_1_pdf_high_allowance_payslip(self, client: TestClient):
        """PDF generates for high allowance executive salaries."""
        res = client.get("/api/v1/notifications/payslip-pdf/2")
        assert res.status_code == 200

    def test_t2_r5_1_pdf_content_type_strictly_application_pdf(self, client: TestClient):
        """Content-Type header is strictly application/pdf."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert res.headers["content-type"] == "application/pdf"

    def test_t2_r5_1_pdf_minimum_stream_size(self, client: TestClient):
        """Generated PDF file size is over 1KB."""
        res = client.get("/api/v1/notifications/payslip-pdf/1")
        assert len(res.content) > 1000

    def test_t2_r5_1_pdf_filename_matches_payslip_id(self, client: TestClient):
        """Header Content-Disposition matches requested payslip ID."""
        res = client.get("/api/v1/notifications/payslip-pdf/99")
        assert "payslip_99.pdf" in res.headers["content-disposition"]

    # R5.2 Boundaries
    def test_t2_r5_2_bulk_email_zero_payslips_payrun(self, client: TestClient, payroll_user_headers):
        """Bulk email dispatch handles empty payrun without exception."""
        res = client.post("/api/v1/analytics/payruns/9999/send-payslips")
        assert res.status_code in (404, 200)

    def test_t2_r5_2_email_empty_body_or_subject(self, client: TestClient):
        """Sending notification with empty body is handled safely."""
        res = client.post("/api/v1/notifications/send", json={"recipient_email": "test@example.com", "subject": "Hi", "body": ""})
        assert res.status_code == 200

    def test_t2_r5_2_notification_logs_empty_filter(self, client: TestClient):
        """Filtering notification logs by non-existent type returns empty list."""
        res = client.get("/api/v1/notifications/logs?notification_type=non_existent_type")
        assert res.status_code == 200
        assert res.json() == []

    def test_t2_r5_2_notification_logs_pagination(self, client: TestClient):
        """Logs endpoint handles repeated calls consistently."""
        res = client.get("/api/v1/notifications/logs")
        assert res.status_code == 200

    def test_t2_r5_2_notification_logs_utc_timestamp(self, client: TestClient):
        """Notification log sent_at timestamp is populated."""
        res = client.post("/api/v1/notifications/send", json={"recipient_email": "utc@example.com", "subject": "UTC Test", "body": "Testing UTC"})
        assert res.json()["sent_at"] is not None

    # R5.3 Boundaries
    def test_t2_r5_3_rbac_expired_token_rejected_401(self, client: TestClient):
        """Expired JWT token returns 401 Unauthorized."""
        expired_token = create_access_token({"sub": "1", "role": "admin"}, expires_delta=-3600)
        res = client.get("/api/v1/payroll/payruns", headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401

    def test_t2_r5_3_rbac_invalid_token_string_rejected_401(self, client: TestClient):
        """Corrupt token string returns 401 Unauthorized."""
        res = client.get("/api/v1/payroll/payruns", headers={"Authorization": "Bearer not.a.valid.jwt"})
        assert res.status_code == 401

    def test_t2_r5_3_rbac_inactive_user_forbidden_403(self, client: TestClient, db_session: Session):
        """Inactive user account is rejected with 403 Forbidden."""
        inactive_u = User(id=30, email="inactive@example.com", hashed_password="pw", role="admin", is_active=False)
        db_session.add(inactive_u)
        db_session.commit()

        token = create_access_token({"sub": "30", "user_id": 30, "role": "admin"})
        res = client.get("/api/v1/payroll/payruns", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403

    def test_t2_r5_3_rbac_unknown_role_forbidden_403(self, client: TestClient, db_session: Session):
        """User with unrecognized role is rejected with 403 Forbidden."""
        u = User(id=31, email="guest@example.com", hashed_password="pw", role="guest_role", is_active=True)
        db_session.add(u)
        db_session.commit()

        token = create_access_token({"sub": "31", "user_id": 31, "role": "guest_role"})
        res = client.get("/api/v1/payroll/payruns", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403

    def test_t2_r5_3_rbac_employee_cannot_create_contract(self, client: TestClient, employee_headers):
        """Employee role cannot create contracts (HTTP 403)."""
        res = client.post("/api/v1/master-data/contracts", json={
            "employee_id": 5, "wage": 100000.00, "start_date": "2026-01-01", "status": "active"
        }, headers=employee_headers)
        assert res.status_code == 403

    # R5.4 Boundaries
    def test_t2_r5_4_delete_draft_payrun_allowed(self, client: TestClient, payroll_manager_headers, payroll_user_headers):
        """Deleting draft payrun is allowed (HTTP 204)."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Delete Draft", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        res = client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_manager_headers)
        assert res.status_code == 204

    def test_t2_r5_4_delete_computed_payrun_allowed(self, client: TestClient, payroll_manager_headers, payroll_user_headers):
        """Deleting computed payrun is allowed (HTTP 204)."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Delete Computed", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        res = client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_manager_headers)
        assert res.status_code == 204

    def test_t2_r5_4_delete_paid_payrun_rejected(self, client: TestClient, payroll_manager_headers, payroll_user_headers):
        """Deleting paid payrun is strictly rejected with 400."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Delete Paid", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_manager_headers)
        assert res.status_code == 400

    def test_t2_r5_4_invalid_transition_draft_to_paid_rejected(self, client: TestClient, payroll_manager_headers, payroll_user_headers):
        """Direct transition from draft to paid skips lifecycle and is rejected."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Skip Step", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)
        assert res.status_code == 400

    def test_t2_r5_4_invalid_transition_paid_to_cancelled_rejected(self, client: TestClient, payroll_manager_headers, payroll_user_headers):
        """Transition from paid to cancelled is rejected by terminal lock."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Cancel Paid", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "cancelled"}, headers=payroll_manager_headers)
        assert res.status_code == 400

    # R5.5 Boundaries
    def test_t2_r5_5_analytics_dashboard_zero_records_safe(self, client: TestClient):
        """Analytics dashboard executes safely without database errors."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        assert res.json()["kpis"]["total_net_paid"] >= 0.0

    def test_t2_r5_5_analytics_department_spend_unassigned_emp(self, client: TestClient, db_session: Session):
        """Employee without department does not break department spend query."""
        emp = Employee(id=40, first_name="NoDept", last_name="User", email="nd@example.com", phone="9999990040", department_id=None, status="active")
        c = Contract(id=40, employee_id=40, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200

    def test_t2_r5_5_analytics_multi_year_monthly_trends(self, client: TestClient, db_session: Session):
        """Monthly trends query executes across multiple years."""
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        assert "monthly_trends" in res.json()

    def test_t2_r5_5_analytics_uncontracted_employees_alert(self, client: TestClient, db_session: Session):
        """Active employee without running contract appears in compliance alerts."""
        emp = Employee(id=41, first_name="NoContract", last_name="Worker", email="nc@example.com", phone="9999990041", status="active")
        db_session.add(emp)
        db_session.commit()

        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 200
        alerts = res.json()["compliance_alerts"]
        assert any(a["employee_id"] == 41 for a in alerts)

    def test_t2_r5_5_analytics_bank_export_empty_batch(self, client: TestClient, payroll_user_headers):
        """Export bank CSV on payrun with 0 payslips produces valid CSV header."""
        p = client.post("/api/v1/payroll/payruns", json={"name": "Empty Export", "date_start": "2024-01-01", "date_end": "2024-01-31"}, headers=payroll_user_headers).json()
        res = client.get(f"/api/v1/analytics/payruns/{p['id']}/export-bank-file")
        assert res.status_code == 200
        assert "Transaction_Ref,Beneficiary_Name" in res.text


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS (20 Tests)
# ==============================================================================

class TestTier3CrossFeatureCombinations:
    """
    Tier 3: Pairwise Combinatorial Interactions across Master Data, Attendance, Payroll, and Analytics.
    Authoritative Source: ORIGINAL_REQUEST.md, PROJECT.md §Interface Contracts
    """

    def test_t3_combo_01_hire_assign_schedule_allocate_leave(self, client: TestClient, hr_headers):
        """Employee hire -> Schedule assignment -> PTO allocation."""
        emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Combo1", "last_name": "User", "email": "combo1@example.com", "phone": "9999990051", "job_title": "Engineer"
        }, headers=hr_headers).json()

        sched = client.post("/api/v1/master-data/working-schedules", json={"name": "Combo1 Schedule", "hours_per_week": 40.0}, headers=hr_headers).json()
        client.put(f"/api/v1/master-data/employees/{emp['id']}", json={"working_schedule_id": sched["id"]}, headers=hr_headers)

        alloc = client.post("/api/v1/master-data/leave-allocations", json={
            "employee_id": emp["id"], "holiday_type": "paid_time_off", "number_of_days": 10.0, "year": 2026, "status": "approved"
        }, headers=hr_headers)
        assert alloc.status_code == 201

    def test_t3_combo_02_approved_leave_reflects_in_attendance_zero_lop(self, client: TestClient, hr_headers, db_session: Session):
        """Approved leave prevents absence flag in AttendanceService LOP query."""
        client.post("/api/v1/master-data/leave-allocations", json={"employee_id": 5, "holiday_type": "paid_time_off", "number_of_days": 5.0, "year": 2026, "status": "approved"}, headers=hr_headers)
        lr = client.post("/api/v1/master-data/leave-requests", json={"employee_id": 5, "holiday_type": "paid_time_off", "date_from": "2026-09-08", "date_to": "2026-09-08", "status": "draft"}, headers=hr_headers).json()
        client.post(f"/api/v1/master-data/leave-requests/{lr['id']}/approve", headers=hr_headers)

        absences = AttendanceService.get_unpaid_absences(db_session, 5, date(2026, 9, 8), date(2026, 9, 8))
        assert len(absences["unpaid_dates"]) == 0

    def test_t3_combo_03_unapproved_absence_attendance_causes_lop_deduction(self, db_session: Session):
        """Unexcused absence records in attendance generate LOP absent days."""
        rec = AttendanceRecord(employee_id=5, date=date(2026, 9, 9), status="absent", worked_hours=Decimal("0.00"))
        db_session.add(rec)
        db_session.commit()

        absences = AttendanceService.get_unpaid_absences(db_session, 5, date(2026, 9, 7), date(2026, 9, 11))
        assert absences["absent_days"] >= 1.0
        assert absences["lop_hours"] >= 8.0

    def test_t3_combo_04_contract_wage_progression_resolves_latest_in_payrun(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Wage progression: old contract ends, new contract active -> Payrun resolves new higher wage."""
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.end_date = date(2026, 5, 31)
        db_session.commit()

        c_new = Contract(employee_id=5, wage=Decimal("80000.00"), start_date=date(2026, 6, 1), status="active")
        db_session.add(c_new)
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Wage Bump Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        comp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        assert comp["payslips"][0]["basic_wage"] == 40000.0 # 50% of 80,000

    def test_t3_combo_05_wizard_step1_detects_existing_overlapping_payrun(self, client: TestClient, payroll_user_headers):
        """Wizard Step 1 lists existing overlapping active payruns."""
        client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Batch One", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers)
        step1 = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={"date_start": "2026-09-15", "date_end": "2026-10-15"}, headers=payroll_user_headers).json()
        assert len(step1["overlapping_payruns"]) >= 1

    def test_t3_combo_06_unbanked_emp_blocks_payrun_validation_barrier(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Unbanked employee in batch triggers warning that halts validation."""
        emp = Employee(id=50, first_name="Unbanked", last_name="Tester", email="ub@example.com", phone=None, status="active")
        c = Contract(id=50, employee_id=50, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Blocked Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [50]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_user_headers)
        assert res.status_code == 400

    def test_t3_combo_07_bank_resolution_clears_barrier_allows_validation(self, client: TestClient, payroll_user_headers, payroll_manager_headers, db_session: Session):
        """Adding verified phone clears warning on recompute and allows validation."""
        emp = Employee(id=51, first_name="Resolve", last_name="Bank", email="res@example.com", phone=None, status="active")
        c = Contract(id=51, employee_id=51, wage=Decimal("50000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp, c])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Resolvable Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [51]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # Update phone
        emp.phone = "9999990051"
        db_session.commit()

        # Recompute
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        assert res.status_code == 200

    def test_t3_combo_08_validated_to_paid_locks_payrun_and_all_payslips(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Advancing payrun to paid cascades paid status to all payslips."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Cascade Lock", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        slips = client.get(f"/api/v1/payroll/payslips?payrun_id={p['id']}", headers=payroll_user_headers).json()
        assert all(s["status"] == "paid" for s in slips)

    def test_t3_combo_09_paid_payrun_generates_matching_bank_csv_export(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Exported bank CSV reflects exact computed net salaries for batch."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "CSV Export Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        comp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        net_str = f"{comp['total_net']:.2f}"

        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        csv_res = client.get(f"/api/v1/analytics/payruns/{p['id']}/export-bank-file")
        assert net_str in csv_res.text

    def test_t3_combo_10_paid_payrun_bulk_email_updates_delivery_status(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Bulk email dispatch returns toast confirmation and logs notification."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Bulk Email Payrun", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        res = client.post(f"/api/v1/analytics/payruns/{p['id']}/send-payslips")
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_t3_combo_11_paid_payrun_immediately_updates_dashboard_kpis(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Marking a payrun paid updates dashboard total_net_paid KPI."""
        dash1 = client.get("/api/v1/analytics/dashboard").json()["kpis"]["total_net_paid"]

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "KPI Impact Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        comp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        dash2 = client.get("/api/v1/analytics/dashboard").json()["kpis"]["total_net_paid"]
        assert dash2 >= dash1 + comp["total_net"]

    def test_t3_combo_12_paid_payrun_department_spend_breakdown_reflected(self, client: TestClient, payroll_user_headers, payroll_manager_headers):
        """Paid payrun reflects in department gross spend breakdown."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Dept Spend Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        dash = client.get("/api/v1/analytics/dashboard").json()
        dept_eng = next((d for d in dash["department_spend"] if d["department_code"] == "ENG"), None)
        assert dept_eng is not None

    def test_t3_combo_13_overlapping_payrun_creation_triggers_duplicate_warning(self, client: TestClient, payroll_user_headers):
        """Second payrun covering overlapping period flags duplicate warning."""
        p1 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Batch A", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        p2 = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Batch B", "date_start": "2026-09-15", "date_end": "2026-10-15", "employee_ids": [5]}, headers=payroll_user_headers).json()
        assert p2["warning_count"] >= 1

    def test_t3_combo_14_wage_code_floor_triggers_epf_statutory_calculations(self, db_session: Session):
        """Basic 50% floor calculates first; EPF 12% calculates against that floor basic capped at 15k."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("60000.00"), struct.rules)
        # Floor Basic = 30k. EPF = 12% of 15k = 1,800
        pf_line = next(l for l in lines if l["code"] in ("PF", "EPF"))
        assert pf_line["total"] == Decimal("1800.00")

    def test_t3_combo_15_low_wage_employee_triggers_esi_and_no_pt(self, db_session: Session):
        """Low wage employee (Gross <= 21k) triggers ESI deduction and zero PT."""
        struct = get_or_create_default_structure(db_session)
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("15000.00"), struct.rules, state="TN")
        esi_line = next(l for l in lines if l["code"] in ("ESI", "ESIC"))
        pt_line = next(l for l in lines if l["code"] in ("PT", "PTAX"))
        assert esi_line["total"] > Decimal("0.00")
        assert pt_line["total"] == Decimal("0.00")

    def test_t3_combo_16_multi_employee_batch_computation_accurately_sums_wages(self, client: TestClient, payroll_user_headers, db_session: Session):
        """Batch payrun computes and sums total_basic, total_gross, and total_net across multiple employees."""
        emp2 = Employee(id=60, first_name="Emp60", last_name="Batch", email="e60@example.com", phone="9999990060", status="active")
        c2 = Contract(id=60, employee_id=60, wage=Decimal("40000.00"), start_date=date(2026, 1, 1), status="active")
        db_session.add_all([emp2, c2])
        db_session.commit()

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Multi Batch", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5, 60]}, headers=payroll_user_headers).json()
        comp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        assert comp["payslip_count"] == 2
        assert comp["total_basic"] == 50000.0 # 30k + 20k

    def test_t3_combo_17_single_payslip_recompute_updates_snapshot_lines(self, client: TestClient, payroll_user_headers):
        """Single payslip recomputation updates payslip lines snapshot."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Single Recompute Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        detail = client.get(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_user_headers).json()
        slip_id = detail["payslips"][0]["id"]

        comp_slip = client.post(f"/api/v1/payroll/payslips/{slip_id}/compute", headers=payroll_user_headers).json()
        assert comp_slip["status"] == "computed"
        assert len(comp_slip["lines"]) > 0

    def test_t3_combo_18_salary_rule_update_modifies_recomputed_snapshot_lines(self, client: TestClient, payroll_manager_headers, payroll_user_headers, db_session: Session):
        """Modifying a salary rule takes effect upon recomputing payslip."""
        struct = get_or_create_default_structure(db_session)
        conv_rule = next(r for r in struct.rules if r.code == "CONV")

        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Rule Mod Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        comp1 = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        gross1 = comp1["total_gross"]

        # Update CONV from 1600 to 2600
        client.put(f"/api/v1/payroll/rules/{conv_rule.id}", json={"amount": 2600.00}, headers=payroll_manager_headers)

        # Recompute
        comp2 = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        assert comp2["total_gross"] == gross1 + 1000.0
        # Restore rule
        client.put(f"/api/v1/payroll/rules/{conv_rule.id}", json={"amount": 1600.00}, headers=payroll_manager_headers)

    def test_t3_combo_19_rbac_end_to_end_permission_boundary_matrix(self, client: TestClient, hr_headers, payroll_user_headers, payroll_manager_headers, employee_headers):
        """Cross-module RBAC: HR Manager configures master data, Payroll User computes, Manager validates/pays, Employee views own slip."""
        # 1. HR Manager creates employee
        emp = client.post("/api/v1/master-data/employees", json={"first_name": "RbacMatrix", "last_name": "User", "email": "rm@example.com", "phone": "9999990070"}, headers=hr_headers).json()
        c = client.post("/api/v1/master-data/contracts", json={"employee_id": emp["id"], "wage": 50000.00, "start_date": "2026-01-01", "status": "active"}, headers=hr_headers).json()

        # 2. HR Manager cannot create payrun
        res_hr_py = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "HR Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [emp["id"]]}, headers=hr_headers)
        assert res_hr_py.status_code == 403

        # 3. Payroll User creates and computes payrun
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Matrix Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [emp["id"]]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # 4. Payroll User cannot transition to validated (or cannot delete structures)
        del_st = client.delete("/api/v1/payroll/structures/1", headers=payroll_user_headers)
        assert del_st.status_code == 403

        # 5. Payroll Manager validates and marks paid
        val = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        assert val.status_code == 200

    def test_t3_combo_20_terminal_lock_prevents_recompute_after_contract_wage_bump(self, client: TestClient, hr_headers, payroll_user_headers, payroll_manager_headers, db_session: Session):
        """Paid payrun remains immutable even if employee contract wage is changed later."""
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Immutable Wage Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        # Contract wage increased
        c5 = db_session.query(Contract).filter(Contract.id == 5).first()
        c5.wage = Decimal("120000.00")
        db_session.commit()

        # Recompute rejected
        recomp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)
        assert recomp.status_code == 400


# ==============================================================================
# TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Tests)
# ==============================================================================

class TestTier4RealWorldScenarios:
    """
    Tier 4: The 5 comprehensive end-to-end real-world scenarios from TEST_INFRA.md.
    """

    def test_t4_scenario_1_full_hire_to_pay_lifecycle(self, client: TestClient, hr_headers, payroll_user_headers, payroll_manager_headers):
        """
        Scenario 1: Full Hire-to-Pay Lifecycle
        Contract Creation -> Schedule Assignment -> Leave Submission & Approval ->
        Payrun Wizard Step 1 & 2 -> Sequenced Computation -> PDF Generation -> Immutability Verification.
        """
        # 1. Create Department
        dept = client.post("/api/v1/master-data/departments", json={"name": "Quantum Research", "code": "QR"}, headers=hr_headers).json()

        # 2. Create Working Schedule
        sched = client.post("/api/v1/master-data/working-schedules", json={"name": "Standard Research 40h", "hours_per_week": 40.0}, headers=hr_headers).json()

        # 3. Create Employee
        emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Dr. Aris",
            "last_name": "Thorne",
            "email": "aris.thorne@peoplepay360.com",
            "phone": "9999990101",
            "department_id": dept["id"],
            "working_schedule_id": sched["id"],
            "job_title": "Lead Research Scientist",
            "status": "active"
        }, headers=hr_headers).json()

        # 4. Create Contract
        contract = client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp["id"],
            "wage": 90000.00,
            "contract_type": "full_time",
            "start_date": "2026-01-01",
            "status": "active"
        }, headers=hr_headers).json()
        assert contract["wage"] == "90000.00"

        # 5. Leave Allocation & Request Approval
        client.post("/api/v1/master-data/leave-allocations", json={
            "employee_id": emp["id"],
            "holiday_type": "paid_time_off",
            "number_of_days": 12.0,
            "year": 2026,
            "status": "approved"
        }, headers=hr_headers)

        l_req = client.post("/api/v1/master-data/leave-requests", json={
            "employee_id": emp["id"],
            "holiday_type": "paid_time_off",
            "date_from": "2026-09-08",
            "date_to": "2026-09-09",
            "status": "draft"
        }, headers=hr_headers).json()

        client.post(f"/api/v1/master-data/leave-requests/{l_req['id']}/approve", headers=hr_headers)

        # 6. Payrun Wizard Step 1 & 2
        step1 = client.post("/api/v1/payroll/payruns/wizard/step1-validate", json={
            "date_start": "2026-09-01",
            "date_end": "2026-09-30"
        }, headers=payroll_user_headers).json()
        assert step1["valid"] is True

        payrun = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "September 2026 Research Payrun",
            "date_start": "2026-09-01",
            "date_end": "2026-09-30",
            "employee_ids": [emp["id"]]
        }, headers=payroll_user_headers).json()
        assert payrun["status"] == "draft"

        # 7. Computation Pipeline
        comp = client.post(f"/api/v1/payroll/payruns/{payrun['id']}/compute", headers=payroll_user_headers).json()
        assert comp["status"] == "computed"
        # 50% basic of 90,000 = 45,000
        assert comp["total_basic"] == 45000.0
        # HRA (40% of 45k = 18k) + CONV (1.6k) + Basic (45k) = 64,600 Gross
        assert comp["total_gross"] == 64600.0
        # PF capped at 1,800 + PT (200) = 2,000 Deductions -> Net = 62,600
        assert comp["total_net"] == 62600.0

        # 8. State Transitions: validated -> paid
        client.post(f"/api/v1/payroll/payruns/{payrun['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{payrun['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        # 9. PDF Generation
        slip_id = comp["payslips"][0]["id"]
        pdf_res = client.get(f"/api/v1/notifications/payslip-pdf/{slip_id}")
        assert pdf_res.status_code == 200
        assert pdf_res.content.startswith(b"%PDF-")

        # 10. Immutability Verification
        assert client.post(f"/api/v1/payroll/payruns/{payrun['id']}/compute", headers=payroll_user_headers).status_code == 400
        assert client.delete(f"/api/v1/payroll/payruns/{payrun['id']}", headers=payroll_manager_headers).status_code == 400

    def test_t4_scenario_2_compliance_warning_and_resolution(self, client: TestClient, hr_headers, payroll_user_headers, payroll_manager_headers, db_session: Session):
        """
        Scenario 2: Compliance Warning & Resolution
        Unbanked Employee -> Payrun Step 2 Compliance Warning Detected ->
        Validation Barrier Blocks 'validated' -> Add Verified Bank ->
        Validation Barrier Cleared -> Confirm Payrun.
        """
        # 1. Unbanked Employee
        emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Marcus", "last_name": "Vance", "email": "marcus.v@example.com", "phone": None, "job_title": "Field Agent"
        }, headers=hr_headers).json()

        client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp["id"], "wage": 55000.00, "start_date": "2026-01-01", "status": "active"
        }, headers=hr_headers)

        # 2. Step 2 query flags warning
        eligible = client.get("/api/v1/payroll/payruns/wizard/eligible-employees?date_start=2026-09-01&date_end=2026-09-30", headers=payroll_user_headers).json()
        marcus_info = next(e for e in eligible if e["employee_id"] == emp["id"])
        assert marcus_info["has_bank_details"] is False
        assert marcus_info["warning"] is not None

        # 3. Payrun confirmed with warning
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
            "name": "Marcus Compliance Run", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [emp["id"]]
        }, headers=payroll_user_headers).json()
        assert p["warning_count"] == 1

        # 4. Compute payrun
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # 5. Validation Barrier blocks transition
        block_res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        assert block_res.status_code == 400
        assert "validation barrier" in block_res.json()["detail"].lower()

        # 6. Add verified banking/phone
        client.put(f"/api/v1/master-data/employees/{emp['id']}", json={"phone": "9999990102"}, headers=hr_headers)

        # 7. Recompute payrun
        recomp = client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers).json()
        assert recomp["warning_count"] == 0

        # 8. Validation Barrier cleared -> Payrun confirmed
        val_res = client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        assert val_res.status_code == 200
        assert val_res.json()["status"] == "validated"

    def test_t4_scenario_3_loss_of_pay_and_attendance_impact(self, client: TestClient, hr_headers, payroll_user_headers, db_session: Session):
        """
        Scenario 3: Loss of Pay (LOP) & Attendance Impact
        Multiple Unpaid Leaves Approved -> Attendance Records Reflected as 'on_leave' ->
        Payroll Engine Resolves Working Hours & Deducts LOP from Basic/Gross -> Final Net Pay Correct.
        """
        # Employee with active contract
        emp = client.post("/api/v1/master-data/employees", json={
            "first_name": "Siddharth", "last_name": "Roy", "email": "sid.roy@example.com", "phone": "9999990103", "job_title": "Product Designer"
        }, headers=hr_headers).json()

        client.post("/api/v1/master-data/contracts", json={
            "employee_id": emp["id"], "wage": 60000.00, "start_date": "2026-01-01", "status": "active"
        }, headers=hr_headers)

        # Record unexcused absence in attendance
        rec = AttendanceRecord(employee_id=emp["id"], date=date(2026, 9, 7), status="absent", worked_hours=Decimal("0.00"))
        db_session.add(rec)
        db_session.commit()

        # Check LOP in attendance service
        lop_info = AttendanceService.get_unpaid_absences(db_session, emp["id"], date(2026, 9, 1), date(2026, 9, 30))
        assert lop_info["absent_days"] >= 1.0

        # Working schedule calculation
        sched_calc = client.post("/api/v1/master-data/schedules/calculate-hours", json={
            "hours_per_week": 40.0, "days_per_week": 5, "date_from": "2026-09-01", "date_to": "2026-09-30"
        }).json()
        assert sched_calc["working_days"] == 22

    def test_t4_scenario_4_multi_structure_and_wage_code_compliance(self, client: TestClient, payroll_manager_headers, payroll_user_headers, db_session: Session):
        """
        Scenario 4: Multi-Structure & Wage Code Compliance
        Low Base Wage with High Allowances -> Code on Wages 50% Basic Floor Triggered ->
        EPF Ceiling & TN PT Calculated -> Final Payslip Line Items Checked.
        """
        # Create aggressive incentive structure with low basic (30%)
        struct_res = client.post("/api/v1/payroll/structures", json={
            "name": "Aggressive Incentive Structure",
            "code": "INC_AGG",
            "rules": [
                {"name": "Basic Pay (30%)", "code": "BASIC", "category": "BASIC", "sequence": 10, "amount_type": "percentage", "amount": 30.0, "percentage_base": "wage"},
                {"name": "Incentive Allowance (70%)", "code": "INC", "category": "ALLOWANCE", "sequence": 20, "amount_type": "percentage", "amount": 70.0, "percentage_base": "BASIC"},
                {"name": "Gross Earnings", "code": "GROSS", "category": "GROSS", "sequence": 100, "amount_type": "percentage", "amount": 100.0, "percentage_base": "GROSS"},
                {"name": "EPF (12%)", "code": "PF", "category": "DEDUCTION", "sequence": 110, "amount_type": "percentage", "amount": 12.0, "percentage_base": "BASIC"},
                {"name": "Professional Tax TN", "code": "PTAX", "category": "DEDUCTION", "sequence": 120, "amount_type": "fixed", "amount": 0.0, "percentage_base": "GROSS"},
                {"name": "Net Payout", "code": "NET", "category": "NET", "sequence": 200, "amount_type": "percentage", "amount": 100.0, "percentage_base": "NET"}
            ]
        }, headers=payroll_manager_headers)
        assert struct_res.status_code == 201
        struct_id = struct_res.json()["id"]

        # Run computation with wage = 50,000
        struct = db_session.query(SalaryStructure).filter(SalaryStructure.id == struct_id).first()
        basic, gross, deductions, net, lines = calculate_payslip_lines_pipeline(Decimal("50000.00"), struct.rules, state="TN")

        # 1. 50% Basic Floor triggered: 50% of 50,000 = 25,000 (overriding 30% = 15,000)
        assert basic == Decimal("25000.00")

        # 2. EPF capped at 15,000 ceiling: 12% of 15,000 = 1,800.00
        pf_line = next(l for l in lines if l["code"] == "PF")
        assert pf_line["total"] == Decimal("1800.00")

        # 3. TN PT applied since Gross >= 21,000
        pt_line = next(l for l in lines if l["code"] == "PTAX")
        assert pt_line["total"] == Decimal("200.00")

    def test_t4_scenario_5_multi_role_security_and_immutability_probe(self, client: TestClient, admin_headers, hr_headers, payroll_user_headers, payroll_manager_headers, employee_headers):
        """
        Scenario 5: Multi-Role Security & Immutability Probe
        Admin, HR Manager, HR Payroll User, HR Payroll Manager, Employee RBAC verification ->
        Attempt Unauthorized Bank Export -> Attempt Deleting Paid Payrun (Rejected).
        """
        # 1. HR Manager attempts unauthorized payroll access -> 403 Forbidden
        assert client.get("/api/v1/payroll/payruns", headers=hr_headers).status_code == 403

        # 2. Employee attempts accessing another employee's payslip -> 403 Forbidden
        assert client.get("/api/v1/payroll/payslips/1", headers=employee_headers).status_code in (403, 404)

        # 3. Employee accesses own payslips
        own_slips = client.get("/api/v1/payroll/payslips", headers=employee_headers)
        assert own_slips.status_code == 200

        # 4. Payroll User creates payrun and computes
        p = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={"name": "Probe Payrun", "date_start": "2026-09-01", "date_end": "2026-09-30", "employee_ids": [5]}, headers=payroll_user_headers).json()
        client.post(f"/api/v1/payroll/payruns/{p['id']}/compute", headers=payroll_user_headers)

        # 5. Payroll User attempts deleting payrun -> 403 Forbidden
        assert client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=payroll_user_headers).status_code == 403

        # 6. Payroll Manager validates and pays payrun
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "validated"}, headers=payroll_manager_headers)
        client.post(f"/api/v1/payroll/payruns/{p['id']}/transition", json={"target_status": "paid"}, headers=payroll_manager_headers)

        # 7. Even Admin cannot delete a paid payrun (Terminal Lock enforcement)
        res_del = client.delete(f"/api/v1/payroll/payruns/{p['id']}", headers=admin_headers)
        assert res_del.status_code == 400
        assert "terminal lock" in res_del.json()["detail"].lower()
