"""
PeoplePay360 - Bulk Employee Seed Script
Seeds 300+ realistic Indian employees with contracts, leave allocations,
leave requests, attendance records (Aug 2026), expense claims, loans,
and tax declarations — all logically consistent per employee.

Run from project root:
    python scripts/seed_300_employees.py
"""

import sys
import os
import random
from datetime import date, timedelta, datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.modules.master_data.database import SessionLocal, engine, Base
import server.modules.master_data.models       # noqa: F401
import server.modules.payroll.models           # noqa: F401
import server.modules.auth.models              # noqa: F401
import server.modules.attendance.models        # noqa: F401
import server.modules.loans.models             # noqa: F401
import server.modules.expenses.models          # noqa: F401
import server.modules.statutory_tax.models     # noqa: F401
import server.modules.notifications.models     # noqa: F401

from server.modules.master_data.models import Employee, Contract, LeaveAllocation, LeaveRequest
from server.modules.payroll.models import Payslip, PayslipLine
from server.modules.attendance.models import AttendanceRecord, ShiftAssignment
from server.modules.loans.models import EmployeeLoan
from server.modules.expenses.models import ExpenseClaim
from server.modules.statutory_tax.models import TaxDeclaration

Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Static data pools
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "Aarav", "Aditya", "Akash", "Amit", "Anand", "Ananya", "Anjali", "Ankit",
    "Anshul", "Arjun", "Arvind", "Ashish", "Ashok", "Bharat", "Chandan",
    "Deepak", "Deepa", "Divya", "Ganesh", "Gaurav", "Gautam", "Geeta",
    "Girish", "Gopal", "Harish", "Hari", "Hemant", "Ishaan", "Jatin",
    "Jayesh", "Karan", "Karthik", "Kavitha", "Kedar", "Kishore", "Komal",
    "Krishna", "Kumar", "Lakshmi", "Lavanya", "Lokesh", "Madhav", "Mahesh",
    "Manish", "Manoj", "Meena", "Meenakshi", "Mihir", "Mohan", "Mukesh",
    "Neeraj", "Neha", "Nikhil", "Nilesh", "Nisha", "Nitesh", "Nitin",
    "Pallavi", "Pankaj", "Parag", "Pooja", "Prakash", "Prashant", "Priya",
    "Priyanka", "Rahul", "Rajesh", "Rajan", "Rakesh", "Ram", "Ramesh",
    "Ravi", "Rohit", "Sachin", "Sandeep", "Sanjay", "Santosh", "Sarika",
    "Seema", "Shailesh", "Shikha", "Shiva", "Shruti", "Simran", "Sneha",
    "Soham", "Sonal", "Sridhar", "Sudhir", "Sunil", "Sunita", "Suresh",
    "Swati", "Tanvi", "Tarun", "Tushar", "Uday", "Uma", "Varun", "Vijay",
    "Vikram", "Vinay", "Vinod", "Vishal", "Vivek", "Yash", "Yogesh", "Zara",
]

LAST_NAMES = [
    "Agarwal", "Ahuja", "Balasubramanian", "Banerjee", "Bhat", "Bhatia",
    "Bhattacharya", "Chakraborty", "Chandra", "Chatterjee", "Chaudhary",
    "Choudhury", "Das", "Desai", "Deshpande", "Dey", "Dubey", "Dutt",
    "Gandhi", "Ghosh", "Goswami", "Goyal", "Gupta", "Iyer", "Jain",
    "Jaiswal", "Jha", "Joshi", "Kamath", "Kapoor", "Kaur", "Khanna",
    "Krishnan", "Kumar", "Lal", "Mathur", "Mehta", "Menon", "Mishra",
    "Mukherjee", "Murthy", "Nair", "Narayanan", "Pande", "Pandey", "Patel",
    "Patil", "Pillai", "Prasad", "Rao", "Reddy", "Roy", "Saha", "Saxena",
    "Shah", "Sharma", "Shukla", "Singh", "Sinha", "Srivastava", "Subramanian",
    "Sundaram", "Swaminathan", "Tiwari", "Tripathi", "Varma", "Verma",
    "Yadav", "Malhotra", "Rastogi", "Bajaj", "Chauhan", "Rathore", "Nayak",
]

IFSC_CODES = [
    "HDFC0000004", "SBIN0000800", "ICIC0000001", "KKBK0000460",
    "AXIS0000123", "PUNB0012345", "CNRB0001234", "BARB0KHTPUN",
    "UBIN0540994", "UTIB0000001",
]

DEPARTMENTS = [1, 2, 3, 4, 5]
WORKING_SCHEDULES = [1, 2, 3]

JOB_TITLES_BY_DEPT = {
    1: [
        "Chief Operating Officer", "Executive Assistant", "Strategy Analyst",
        "Corporate Communications Manager", "Executive Program Manager",
        "Board Secretary", "Business Development Director",
    ],
    2: [
        "Software Engineer", "Senior Software Engineer", "Backend Engineer",
        "Frontend Engineer", "Full Stack Developer", "DevOps Engineer",
        "QA Engineer", "Data Engineer", "ML Engineer", "Cloud Architect",
        "Site Reliability Engineer", "Security Engineer", "Mobile Developer",
        "Platform Engineer", "Tech Lead", "Engineering Manager",
    ],
    3: [
        "HR Business Partner", "Talent Acquisition Specialist", "HR Generalist",
        "Learning & Development Specialist", "Compensation Analyst",
        "Employee Relations Manager", "HR Operations Coordinator",
        "Recruiter", "People Analytics Specialist", "Onboarding Coordinator",
    ],
    4: [
        "Financial Analyst", "Accounts Executive", "Senior Accountant",
        "Tax Analyst", "Payroll Specialist", "Treasury Analyst",
        "Finance Manager", "Budget Analyst", "Internal Auditor",
        "Accounts Payable Specialist", "Accounts Receivable Specialist",
    ],
    5: [
        "Sales Executive", "Account Manager", "Business Development Executive",
        "Marketing Analyst", "Digital Marketing Specialist", "Content Writer",
        "SEO Specialist", "Product Marketing Manager", "Brand Manager",
        "Sales Manager", "Customer Success Manager", "Growth Hacker",
    ],
}

WAGE_RANGES_BY_DEPT = {
    1: (18000, 60000),
    2: (5500,  20000),
    3: (4500,  14000),
    4: (4500,  16000),
    5: (4500,  16000),
}

# Expense categories realistic per department
EXPENSE_CATEGORIES_BY_DEPT = {
    1: ["client_entertainment", "travel", "training", "office_supplies"],
    2: ["training", "office_supplies", "travel", "other"],
    3: ["training", "travel", "office_supplies", "other"],
    4: ["travel", "office_supplies", "training", "other"],
    5: ["travel", "client_entertainment", "food", "training"],
}

EXPENSE_AMOUNT_RANGES = {
    "travel":               (1500, 12000),
    "food":                 (500,  3000),
    "office_supplies":      (800,  8000),
    "client_entertainment": (2000, 15000),
    "training":             (3000, 25000),
    "other":                (500,  5000),
}

EXPENSE_DESCRIPTIONS = {
    "travel":               ["Client site visit cab fares and train passes",
                             "Inter-city travel for business meeting",
                             "Airport transfer and hotel stay for conference",
                             "Regional office visit — cab + fuel reimbursement"],
    "food":                 ["Team lunch during sprint review",
                             "Working dinner with project stakeholders",
                             "Quarterly retrospective team dinner",
                             "Client welcome lunch"],
    "office_supplies":      ["Ergonomic keyboard and mouse set",
                             "External monitor and desk accessories",
                             "Notebook, pens, and stationery refill",
                             "USB hub and charging cables"],
    "client_entertainment": ["Client dinner at business restaurant",
                             "Corporate event tickets for client relationship",
                             "Gifting for key account milestone",
                             "Client appreciation lunch"],
    "training":             ["Online certification course — Udemy",
                             "AWS Solutions Architect exam fee",
                             "HR conference registration fee",
                             "Finance & Tax compliance seminar"],
    "other":                ["Miscellaneous project-related expense",
                             "Emergency supply purchase for office",
                             "Courier and shipping charges",
                             "Printing and documentation cost"],
}

LOAN_TYPES = ["salary_advance", "emergency_loan", "personal_loan", "equipment_loan"]

LOAN_REASONS = {
    "salary_advance": "Advance against next month salary for personal emergency.",
    "emergency_loan": "Medical emergency for family member requiring immediate funds.",
    "personal_loan":  "Home renovation and furnishing loan.",
    "equipment_loan": "Purchase of laptop/equipment for remote work setup.",
}


# August 2026 working days (Mon–Fri)
def _aug_2026_working_days():
    days, d = [], date(2026, 8, 1)
    while d <= date(2026, 8, 31):
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


AUG_WORKING_DAYS = _aug_2026_working_days()  # 21 days


# ---------------------------------------------------------------------------
# Helper builders
# ---------------------------------------------------------------------------

def random_phone():
    return f"+91-{random.randint(60000, 99999):05d}-{random.randint(10000, 99999):05d}"


def random_bank_account():
    return f"9876{random.randint(10000000000, 99999999999)}"


def random_hire_date():
    start = date(2020, 1, 1)
    delta = (date(2025, 12, 31) - start).days
    return start + timedelta(days=random.randint(0, delta))


def random_contract_wage(dept_id):
    lo, hi = WAGE_RANGES_BY_DEPT[dept_id]
    return float(round(random.randint(lo, hi) / 500) * 500)


def compute_payslip_figures(basic_wage, gross_wage):
    pf   = round(min(basic_wage, 15000) * 0.12, 2)
    esi  = round(gross_wage * 0.0075, 2) if gross_wage <= 21000 else 0.0
    ptax = 200.0 if gross_wage >= 21000 else 0.0
    total_deductions = round(pf + esi + ptax, 2)
    net_wage = round(gross_wage - total_deductions, 2)
    return total_deductions, net_wage


def make_payslip_lines(payslip_id, basic, gross, net):
    pf   = round(min(basic, 15000) * 0.12, 2)
    hra  = round(basic * 0.40, 2)
    esi  = round(gross * 0.0075, 2) if gross <= 21000 else 0.0
    ptax = 200.0 if gross >= 21000 else 0.0
    return [
        PayslipLine(payslip_id=payslip_id, salary_rule_id=1, name="Basic Pay",
                    code="BASIC", category="BASIC", sequence=10, rate=50.0, amount=50.0, total=basic),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=2, name="House Rent Allowance",
                    code="HRA", category="ALLOWANCE", sequence=20, rate=40.0, amount=40.0, total=hra),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=3, name="Conveyance Allowance",
                    code="CONV", category="ALLOWANCE", sequence=30, rate=1600.0, amount=1600.0, total=1600.0),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=4, name="Gross Earnings",
                    code="GROSS", category="GROSS", sequence=100, rate=100.0, amount=100.0, total=gross),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=5, name="Employee PF (12% of Basic)",
                    code="PF", category="DEDUCTION", sequence=110, rate=12.0, amount=12.0, total=pf),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=6, name="Employee ESI (0.75% of Gross)",
                    code="ESI", category="DEDUCTION", sequence=115, rate=0.75, amount=0.75, total=esi),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=7, name="Professional Tax",
                    code="PTAX", category="DEDUCTION", sequence=120, rate=0.0, amount=0.0, total=ptax),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=8, name="Tax Deducted at Source",
                    code="TDS", category="DEDUCTION", sequence=130, rate=0.0, amount=0.0, total=0.0),
        PayslipLine(payslip_id=payslip_id, salary_rule_id=9, name="Net Salary Payout",
                    code="NET", category="NET", sequence=200, rate=100.0, amount=100.0, total=net),
    ]


def make_leave_request(emp_id):
    """60 % of employees take 1–5 days leave in Aug 2026."""
    if random.random() > 0.60:
        return None, set()

    days = random.randint(1, 5)
    valid_starts = AUG_WORKING_DAYS[: len(AUG_WORKING_DAYS) - days]
    if not valid_starts:
        return None, set()

    date_from = random.choice(valid_starts)
    date_to   = date_from + timedelta(days=days - 1)
    while date_to.weekday() >= 5:
        date_to += timedelta(days=1)

    leave_dates = set()
    d = date_from
    while d <= date_to:
        if d.weekday() < 5:
            leave_dates.add(d)
        d += timedelta(days=1)

    req = LeaveRequest(
        employee_id    = emp_id,
        holiday_type   = "Paid Time Off",
        date_from      = date_from,
        date_to        = date_to,
        number_of_days = float(len(leave_dates)),
        status         = "approved",
    )
    return req, leave_dates


def make_attendance_records(emp_id, leave_dates):
    """
    Attendance for all 21 Aug 2026 working days.
    Attendance status is derived from the employee's leave — no orphan records.
      - On leave days   → on_leave (no clock-in/out)
      - 4% chance       → absent
      - 6% chance       → late (arrived after 9:15)
      - rest            → present (20% chance of paid overtime)
    Clock times are realistic 9 AM–5 PM window.
    """
    records = []
    for work_date in AUG_WORKING_DAYS:
        if work_date in leave_dates:
            records.append(AttendanceRecord(
                employee_id=emp_id, date=work_date,
                clock_in=None, clock_out=None,
                worked_hours=0.0, overtime_hours=0.0,
                status="on_leave",
            ))
            continue

        roll = random.random()

        if roll < 0.04:                        # Absent
            records.append(AttendanceRecord(
                employee_id=emp_id, date=work_date,
                clock_in=None, clock_out=None,
                worked_hours=0.0, overtime_hours=0.0,
                status="absent",
            ))

        elif roll < 0.10:                      # Late
            late_mins  = random.randint(16, 55)
            ci = datetime(2026, work_date.month, work_date.day,
                          9, late_mins, random.randint(0, 59), tzinfo=timezone.utc)
            co = datetime(2026, work_date.month, work_date.day,
                          17, random.randint(0, 30), 0, tzinfo=timezone.utc)
            worked = round((co - ci).seconds / 3600, 2)
            records.append(AttendanceRecord(
                employee_id=emp_id, date=work_date,
                clock_in=ci, clock_out=co,
                worked_hours=worked, overtime_hours=0.0,
                status="late",
            ))

        else:                                  # Present
            ci = datetime(2026, work_date.month, work_date.day,
                          9, random.randint(0, 14), random.randint(0, 59),
                          tzinfo=timezone.utc)
            if random.random() < 0.20:         # Overtime
                extra = random.randint(30, 120)
                co_hour = 17 + extra // 60
                co_min  = extra % 60
                co = datetime(2026, work_date.month, work_date.day,
                              co_hour, co_min, random.randint(0, 59), tzinfo=timezone.utc)
            else:
                co = datetime(2026, work_date.month, work_date.day,
                              17, random.randint(0, 30), random.randint(0, 59),
                              tzinfo=timezone.utc)
            worked   = round((co - ci).seconds / 3600, 2)
            overtime = round(max(0.0, worked - 8.0), 2)
            records.append(AttendanceRecord(
                employee_id=emp_id, date=work_date,
                clock_in=ci, clock_out=co,
                worked_hours=worked, overtime_hours=overtime,
                status="present",
            ))

    return records


def make_expense_claim(emp_id, dept_id, wage):
    """40 % of employees have 1 expense claim, amount proportional to wage."""
    if random.random() > 0.40:
        return None
    category = random.choice(EXPENSE_CATEGORIES_BY_DEPT[dept_id])
    lo, hi   = EXPENSE_AMOUNT_RANGES[category]
    scale    = min(1.0, wage / 20000)
    max_amt  = lo + int((hi - lo) * (0.4 + 0.6 * scale))
    amount   = round(random.randint(lo, max_amt) / 50) * 50
    exp_date = date(2026, random.randint(7, 8), random.randint(1, 28))
    status   = random.choices(["approved", "submitted", "reimbursed"], weights=[50, 35, 15])[0]
    approved_by = 2 if status in ("approved", "reimbursed") else None

    return ExpenseClaim(
        employee_id   = emp_id,
        category      = category,
        amount        = float(amount),
        currency      = "INR",
        expense_date  = exp_date,
        description   = random.choice(EXPENSE_DESCRIPTIONS[category]),
        receipt_url   = f"https://receipts.peoplepay360.local/{emp_id}/{category}_{exp_date}.pdf",
        status        = status,
        approved_by   = approved_by,
        approval_date = exp_date + timedelta(days=3) if approved_by else None,
    )


def make_loan(emp_id, wage):
    """15 % of employees have a loan. EMI computed from principal + rate + tenure."""
    if random.random() > 0.15:
        return None

    loan_type  = random.choice(LOAN_TYPES)
    principal  = round(wage * random.uniform(1.0, 3.0) / 500) * 500

    if loan_type == "salary_advance":
        rate, tenure = 0.0, random.choice([1, 2, 3])
    elif loan_type == "emergency_loan":
        rate, tenure = round(random.uniform(3.0, 6.0), 1), random.choice([3, 6, 9])
    elif loan_type == "personal_loan":
        rate, tenure = round(random.uniform(7.0, 12.0), 1), random.choice([6, 12, 18, 24])
    else:
        rate, tenure = round(random.uniform(5.0, 8.0), 1), random.choice([6, 12])

    if rate == 0.0:
        emi, total_repayable = round(principal / tenure, 2), round(principal, 2)
    else:
        r   = (rate / 100) / 12
        emi = round(principal * r * (1 + r) ** tenure / ((1 + r) ** tenure - 1), 2)
        total_repayable = round(emi * tenure, 2)

    paid               = random.randint(0, tenure - 1)
    remaining_balance  = round(max(0, principal - emi * paid), 2)
    status             = random.choices(["active", "approved", "pending_approval"],
                                        weights=[60, 25, 15])[0]
    disb_date          = (date(2026, random.randint(1, 8), random.randint(1, 28))
                          if status == "active" else None)

    return EmployeeLoan(
        employee_id       = emp_id,
        loan_type         = loan_type,
        principal_amount  = float(principal),
        interest_rate     = float(rate),
        tenure_months     = tenure,
        total_repayable   = float(total_repayable),
        monthly_emi       = float(emi),
        remaining_balance = float(remaining_balance),
        status            = status,
        reason            = LOAN_REASONS[loan_type],
        disbursement_date = disb_date,
        approved_by       = 2 if status in ("active", "approved") else None,
    )


def make_tax_declaration(emp_id, wage):
    """70 % of employees submit FY 2025-2026 tax declaration."""
    if random.random() > 0.70:
        return None

    annual = wage * 12
    regime = "new" if annual < 700000 else random.choice(["new", "old"])
    sec_80c     = round(min(150000, annual * random.uniform(0.05, 0.12)) / 1000) * 1000
    sec_80d     = random.choice([0, 5000, 10000, 15000, 25000])
    hra_rent    = round(wage * random.uniform(0.3, 0.5) * 12 / 1000) * 1000
    home_loan   = (round(random.randint(50000, 200000) / 5000) * 5000
                   if regime == "old" and random.random() < 0.30 else 0.0)
    status      = random.choices(["submitted", "verified", "draft"], weights=[50, 35, 15])[0]

    return TaxDeclaration(
        employee_id       = emp_id,
        financial_year    = "2025-2026",
        regime            = regime,
        section_80c_amount = float(sec_80c),
        section_80d_amount = float(sec_80d),
        hra_rent_paid      = float(hra_rent),
        home_loan_interest = float(home_loan),
        status             = status,
        remarks            = f"FY 2025-26 declaration — {regime.upper()} regime",
    )


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------

def seed(target=310):
    db = SessionLocal()
    existing_count = db.query(Employee).count()
    print(f"[INFO] Existing employees: {existing_count}")

    to_add = max(0, target - existing_count)
    if to_add == 0:
        print(f"[INFO] Already have {existing_count} employees. Seeding related data only...")

    # ── Step 1: Create employee records ───────────────────────────────────
    new_employee_info = []   # (emp_id, dept_id, wage)

    if to_add > 0:
        print(f"[INFO] Will add {to_add} new employees...")
        used_emails = {e for (e,) in db.query(Employee.email).all()}
        used_combos = set()
        added = 0
        attempts = 0

        while added < to_add and attempts < to_add * 15:
            attempts += 1
            first = random.choice(FIRST_NAMES)
            last  = random.choice(LAST_NAMES)
            combo = (first, last)

            suffix = str(added + 1) if combo in used_combos else ""
            used_combos.add(combo)

            email = f"{first.lower()}.{last.lower()}{suffix}@peoplepay360.local"
            if email in used_emails:
                email = f"{first.lower()}.{last.lower()}{random.randint(100,9999)}@peoplepay360.local"
            if email in used_emails:
                continue
            used_emails.add(email)

            dept_id   = random.choice(DEPARTMENTS)
            sched_id  = random.choice(WORKING_SCHEDULES)
            hire_date = random_hire_date()
            has_bank  = random.random() > 0.08

            emp = Employee(
                first_name          = first,
                last_name           = last + suffix,
                email               = email,
                phone               = random_phone(),
                department_id       = dept_id,
                working_schedule_id = sched_id,
                job_title           = random.choice(JOB_TITLES_BY_DEPT[dept_id]),
                hire_date           = hire_date,
                status              = "active",
                bank_account_number = random_bank_account() if has_bank else None,
                bank_ifsc           = random.choice(IFSC_CODES) if has_bank else None,
            )
            db.add(emp)
            db.flush()

            wage = random_contract_wage(dept_id)
            contract = Contract(
                employee_id   = emp.id,
                wage          = wage,
                contract_type = "full_time",
                start_date    = hire_date,
                end_date      = None,
                status        = "active",
            )
            db.add(contract)
            db.flush()

            db.add(LeaveAllocation(
                employee_id    = emp.id,
                holiday_type   = "Paid Time Off",
                number_of_days = 21.00,
                year           = 2026,
                status         = "approved",
            ))

            if has_bank:
                basic = round(wage * 0.50, 2)
                hra   = round(basic * 0.40, 2)
                gross = round(basic + hra + 1600, 2)
                total_deductions, net = compute_payslip_figures(basic, gross)

                slip = Payslip(
                    payrun_id        = 1,
                    employee_id      = emp.id,
                    contract_id      = contract.id,
                    structure_id     = 1,
                    date_from        = date(2026, 8, 1),
                    date_to          = date(2026, 8, 31),
                    basic_wage       = basic,
                    gross_wage       = gross,
                    total_deductions = total_deductions,
                    net_wage         = net,
                    status           = "paid",
                    has_warning      = False,
                    bank_account     = emp.bank_account_number,
                    ifsc_code        = emp.bank_ifsc,
                )
                db.add(slip)
                db.flush()
                for line in make_payslip_lines(slip.id, basic, gross, net):
                    db.add(line)

            new_employee_info.append((emp.id, dept_id, wage))
            added += 1
            if added % 50 == 0:
                db.commit()
                print(f"  -> Committed {added}/{to_add} employees...")

        db.commit()
        print(f"[INFO] Employee records done. Total in DB: {db.query(Employee).count()}")

    # ── Step 2: Seed related data for ALL employees missing it ────────────
    # Collect (emp_id, dept_id, wage) for every employee not yet covered
    all_emp_rows = (
        db.query(Employee.id, Employee.department_id, Contract.wage)
        .join(Contract, (Contract.employee_id == Employee.id) & (Contract.status == "active"))
        .all()
    )
    # Merge newly added employees into the coverage set
    new_ids = {r[0] for r in new_employee_info}
    for row in all_emp_rows:
        if row[0] not in new_ids and row[1] is not None and row[2] is not None:
            new_employee_info.append((row[0], row[1], float(row[2])))

    if not new_employee_info:
        print("[INFO] Nothing to seed.")
        db.close()
        return

    print(f"\n[INFO] Seeding related data for {len(new_employee_info)} employees...")

    existing_att_ids    = {r[0] for r in db.query(AttendanceRecord.employee_id)
                           .filter(AttendanceRecord.date >= date(2026, 8, 1)).all()}
    existing_leave_ids  = {r[0] for r in db.query(LeaveRequest.employee_id)
                           .filter(LeaveRequest.date_from >= date(2026, 8, 1)).all()}
    existing_expense_ids = {r[0] for r in db.query(ExpenseClaim.employee_id).all()}
    existing_loan_ids    = {r[0] for r in db.query(EmployeeLoan.employee_id).all()}
    existing_tax_ids     = {r[0] for r in db.query(TaxDeclaration.employee_id).all()}

    processed = 0
    for emp_id, dept_id, wage in new_employee_info:

        # Leave request → determines on_leave days in attendance
        leave_dates = set()
        if emp_id not in existing_leave_ids:
            leave_req, leave_dates = make_leave_request(emp_id)
            if leave_req:
                db.add(leave_req)

        # Attendance (derived from leave_dates — no orphan records)
        if emp_id not in existing_att_ids:
            for rec in make_attendance_records(emp_id, leave_dates):
                db.add(rec)

        # Shift assignment
        db.add(ShiftAssignment(
            employee_id = emp_id,
            shift_id    = random.choice([1, 2, 3]),
            start_date  = date(2026, 1, 1),
        ))

        # Expense claim
        if emp_id not in existing_expense_ids:
            claim = make_expense_claim(emp_id, dept_id, wage)
            if claim:
                db.add(claim)

        # Loan
        if emp_id not in existing_loan_ids:
            loan = make_loan(emp_id, wage)
            if loan:
                db.add(loan)

        # Tax declaration
        if emp_id not in existing_tax_ids:
            tax = make_tax_declaration(emp_id, wage)
            if tax:
                db.add(tax)

        processed += 1
        if processed % 50 == 0:
            db.commit()
            print(f"  -> Related data committed for {processed}/{len(new_employee_info)} employees...")

    db.commit()

    # ── Final summary ──────────────────────────────────────────────────────
    total_emp     = db.query(Employee).count()
    total_att     = db.query(AttendanceRecord).count()
    total_leave   = db.query(LeaveRequest).count()
    total_expense = db.query(ExpenseClaim).count()
    total_loan    = db.query(EmployeeLoan).count()
    total_tax     = db.query(TaxDeclaration).count()

    print(f"""
=== Seed Complete ===
  Employees          : {total_emp}
  Attendance records : {total_att}
  Leave requests     : {total_leave}
  Expense claims     : {total_expense}
  Loans              : {total_loan}
  Tax declarations   : {total_tax}
====================
""")
    db.close()


if __name__ == "__main__":
    seed(target=310)
