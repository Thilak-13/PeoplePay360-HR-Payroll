from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_

from server.modules.payroll.models import (
    SalaryStructure,
    SalaryRule,
    Payrun,
    Payslip,
    PayslipLine,
)


def round_curr(val: Decimal) -> Decimal:
    """Helper to round decimal to 2 decimal places."""
    if val is None:
        return Decimal("0.00")
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ==========================================
# 1. Temporal Contract Resolution
# ==========================================

def resolve_active_contract(db: Session, employee_id: int, period_start: date, period_end: date) -> Optional[Dict[str, Any]]:
    """
    Temporal contract resolution:
    Query only the contract where start_date <= period_end AND (end_date IS NULL OR end_date >= period_start).
    """
    query = text("""
        SELECT id, employee_id, wage, contract_type, start_date, end_date, status
        FROM contracts
        WHERE employee_id = :employee_id
          AND status != 'cancelled'
          AND start_date <= :period_end
          AND (end_date IS NULL OR end_date >= :period_start)
        ORDER BY start_date DESC, id DESC
        LIMIT 1
    """)
    result = db.execute(query, {
        "employee_id": employee_id,
        "period_start": period_start,
        "period_end": period_end,
    }).fetchone()

    if result:
        return {
            "id": result[0],
            "employee_id": result[1],
            "wage": Decimal(str(result[2])),
            "contract_type": result[3],
            "start_date": result[4],
            "end_date": result[5],
            "status": result[6],
        }
    return None


# ==========================================
# 2. Pre-Validation Compliance Audit
# ==========================================

def check_compliance_warnings(
    db: Session,
    employee_id: int,
    period_start: date,
    period_end: date,
    current_payrun_id: Optional[int] = None
) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Pre-validation compliance audit.

    Returns a 4-tuple: (has_warning, warning_message, bank_account, ifsc_code).

    Rules applied in order:

    1. **Bank details** – query ``bank_account_number`` and ``bank_ifsc`` from the
       employees table.  If either column is absent/NULL/empty, fall back to
       deriving a synthetic account from ``phone``.  If no usable value exists,
       flag ``(True, "Missing Bank Account or IFSC details", None, None)``.

    2. **Duplicate payslip** – check whether the employee already has a payslip
       whose date range overlaps ``[period_start, period_end]`` inside *another*
       payrun whose status is ``'validated'`` or ``'paid'``.  If so, flag
       ``(True, "Duplicate payslip in overlapping batch", bank_acc, ifsc)``.

    3. **Clean** – return ``(False, None, bank_acc, ifsc)``.
    """
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None

    # ------------------------------------------------------------------
    # 1. Bank-details check
    # ------------------------------------------------------------------
    # Try to read dedicated bank columns; fall back gracefully if the
    # column does not exist yet in the running schema.
    try:
        emp_row = db.execute(
            text("""
                SELECT id, phone, bank_account_number, bank_ifsc
                FROM employees
                WHERE id = :eid
            """),
            {"eid": employee_id},
        ).fetchone()
    except Exception:
        # bank_account_number / bank_ifsc columns not present – fall back
        emp_row = None

    if emp_row is None:
        # Retry without the bank columns
        emp_row = db.execute(
            text("SELECT id, phone FROM employees WHERE id = :eid"),
            {"eid": employee_id},
        ).fetchone()

        if emp_row is None:
            return True, "Employee record not found in system", None, None

        # emp_row has (id, phone)
        emp_id_val = emp_row[0]
        phone_val = emp_row[1]
        bank_account_col: Optional[str] = None
        ifsc_col: Optional[str] = None
    else:
        # emp_row has (id, phone, bank_account_number, bank_ifsc)
        emp_id_val = emp_row[0]
        phone_val = emp_row[1]
        bank_account_col = emp_row[2] if len(emp_row) > 2 else None
        ifsc_col = emp_row[3] if len(emp_row) > 3 else None

    # Resolve bank_account and ifsc_code
    if bank_account_col and ifsc_col:
        # Genuine bank details present in the DB
        bank_account = bank_account_col
        ifsc_code = ifsc_col
    elif phone_val:
        # Derive a deterministic synthetic account from phone (demo fallback)
        bank_account = f"ACCT{emp_id_val:04d}{str(phone_val)[-4:]}"
        ifsc_code = "PPAY0001234"
    else:
        # No bank data and no phone – hard flag
        return True, "Missing Bank Account or IFSC details", None, None

    # ------------------------------------------------------------------
    # 2. Duplicate payslip check (validated / paid payruns only)
    # ------------------------------------------------------------------
    dup_results = db.execute(
        text("""
            SELECT p.id, pr.name
            FROM payslips p
            JOIN payruns pr ON p.payrun_id = pr.id
            WHERE p.employee_id  = :employee_id
              AND p.date_from    <= :period_end
              AND p.date_to      >= :period_start
              AND p.status       != 'cancelled'
              AND pr.status      IN ('validated', 'paid')
              AND (:current_payrun_id IS NULL OR pr.id != :current_payrun_id)
        """),
        {
            "employee_id": employee_id,
            "period_start": period_start,
            "period_end": period_end,
            "current_payrun_id": current_payrun_id if current_payrun_id is not None else -1,
        },
    ).fetchall()

    if dup_results:
        batch_names = [f"#{r[0]} (payrun: {r[1] or 'unknown'})" for r in dup_results]
        return (
            True,
            f"Duplicate payslip in overlapping batch: {', '.join(batch_names)}",
            bank_account,
            ifsc_code,
        )

    # ------------------------------------------------------------------
    # 3. All clear
    # ------------------------------------------------------------------
    return False, None, bank_account, ifsc_code


# ==========================================
# 3. Eligible Employees Query
# ==========================================

def get_eligible_employees(db: Session, period_start: date, period_end: date) -> List[Dict[str, Any]]:
    """
    Fetch all active employees who have an active contract covering the given period.
    """
    query = text("""
        SELECT 
            e.id AS employee_id,
            e.first_name,
            e.last_name,
            e.email,
            e.job_title,
            d.name AS department_name,
            c.id AS contract_id,
            c.wage,
            c.contract_type,
            c.start_date AS contract_start,
            c.end_date AS contract_end
        FROM employees e
        INNER JOIN contracts c ON e.id = c.employee_id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.status = 'active'
          AND c.status != 'cancelled'
          AND c.start_date <= :period_end
          AND (c.end_date IS NULL OR c.end_date >= :period_start)
        ORDER BY d.name ASC, e.first_name ASC
    """)
    
    rows = db.execute(query, {
        "period_start": period_start,
        "period_end": period_end
    }).fetchall()

    eligible = []
    seen_employees = set()
    for row in rows:
        emp_id = row[0]
        if emp_id in seen_employees:
            continue
        seen_employees.add(emp_id)

        has_warn, warn_msg, bank_acc, ifsc = check_compliance_warnings(
            db, emp_id, period_start, period_end
        )

        emp_name = f"{row[1]} {row[2]}".strip()
        dept = row[5] or "General"
        contract_id = row[6]
        wage_dec = Decimal(str(row[7]))

        eligible.append({
            "id": emp_id,
            "name": emp_name,
            "department": dept,
            "active_contract_id": contract_id,
            "wage": wage_dec,
            "has_warning": has_warn,
            "warning_reason": warn_msg,
            # Extended fields for full frontend and router support
            "employee_id": emp_id,
            "employee_name": emp_name,
            "employee_email": row[3],
            "job_title": row[4],
            "department_name": dept,
            "contract_id": contract_id,
            "contract_type": row[8],
            "contract_start": row[9],
            "contract_end": row[10],
            "has_bank_details": bool(bank_acc and ifsc),
            "bank_account": bank_acc,
            "ifsc_code": ifsc,
            "warning": warn_msg
        })

    return eligible


# ==========================================
# 4. Sequenced Salary Rules Pipeline
# ==========================================

def get_or_create_default_structure(db: Session) -> SalaryStructure:
    """Retrieve default salary structure or create standard Indian/Global compliant structure."""
    struct = db.query(SalaryStructure).filter(SalaryStructure.code == "STD_STRUCTURE").first()
    if not struct:
        struct = SalaryStructure(
            name="Standard Salary Structure",
            code="STD_STRUCTURE"
        )
        db.add(struct)
        db.flush()

        # Define default sequenced rules pipeline:
        # BASIC -> ALLOWANCE -> GROSS -> DEDUCTION -> NET
        rules_data = [
            # 1. Basic Pay
            {"name": "Basic Salary", "code": "BASIC", "category": "BASIC", "sequence": 10, "amount_type": "percentage", "amount": Decimal("50.00"), "percentage_base": "wage"},
            # 2. Allowances
            {"name": "House Rent Allowance (HRA)", "code": "HRA", "category": "ALLOWANCE", "sequence": 20, "amount_type": "percentage", "amount": Decimal("50.00"), "percentage_base": "BASIC"},
            {"name": "Special Allowance", "code": "SPEC_ALLW", "category": "ALLOWANCE", "sequence": 30, "amount_type": "percentage", "amount": Decimal("25.00"), "percentage_base": "BASIC"},
            {"name": "Conveyance Allowance", "code": "CONV_ALLW", "category": "ALLOWANCE", "sequence": 40, "amount_type": "fixed", "amount": Decimal("1600.00"), "percentage_base": "BASIC"},
            # 3. Gross
            {"name": "Gross Earnings", "code": "GROSS", "category": "GROSS", "sequence": 50, "amount_type": "percentage", "amount": Decimal("100.00"), "percentage_base": "GROSS"},
            # 4. Deductions
            {"name": "Provident Fund (PF)", "code": "PF", "category": "DEDUCTION", "sequence": 60, "amount_type": "percentage", "amount": Decimal("12.00"), "percentage_base": "BASIC"},
            {"name": "Professional Tax (PT)", "code": "PT", "category": "DEDUCTION", "sequence": 70, "amount_type": "fixed", "amount": Decimal("200.00"), "percentage_base": "GROSS"},
            {"name": "TDS / Income Tax", "code": "TDS", "category": "DEDUCTION", "sequence": 80, "amount_type": "percentage", "amount": Decimal("5.00"), "percentage_base": "GROSS"},
            # 5. Net
            {"name": "Net Salary Payout", "code": "NET", "category": "NET", "sequence": 100, "amount_type": "percentage", "amount": Decimal("100.00"), "percentage_base": "NET"}
        ]

        for rd in rules_data:
            r = SalaryRule(
                structure_id=struct.id,
                name=rd["name"],
                code=rd["code"],
                category=rd["category"],
                sequence=rd["sequence"],
                amount_type=rd["amount_type"],
                amount=rd["amount"],
                percentage_base=rd["percentage_base"]
            )
            db.add(r)
        db.flush()

    return struct


def calculate_payslip_lines_pipeline(
    wage: Decimal,
    rules: List[SalaryRule]
) -> Tuple[Decimal, Decimal, Decimal, Decimal, List[Dict[str, Any]]]:
    """
    Execute rules ordered by sequence ASC across categories:
    (BASIC -> ALLOWANCE -> GROSS -> DEDUCTION -> NET)
    Returns: (basic_wage, gross_wage, total_deductions, net_wage, snapshot_lines)
    """
    # Sort rules strictly by sequence ASC
    sorted_rules = sorted(rules, key=lambda r: r.sequence)

    category_totals = {
        "BASIC": Decimal("0.00"),
        "ALLOWANCE": Decimal("0.00"),
        "GROSS": Decimal("0.00"),
        "DEDUCTION": Decimal("0.00"),
        "NET": Decimal("0.00"),
    }
    computed_lines: List[Dict[str, Any]] = []

    # Map for rule codes to values for reference
    rule_values: Dict[str, Decimal] = {"wage": wage}

    for rule in sorted_rules:
        category = rule.category.upper()
        amount_type = rule.amount_type.lower()
        rule_amt = Decimal(str(rule.amount or 0.00))
        rate = Decimal("100.00")
        line_total = Decimal("0.00")

        if category == "BASIC":
            if amount_type == "percentage":
                rate = rule_amt
                line_total = round_curr(wage * (rule_amt / Decimal("100.00")))
            else:
                line_total = round_curr(rule_amt if rule_amt > 0 else wage)
            category_totals["BASIC"] += line_total
            rule_values[rule.code] = line_total
            rule_values["BASIC"] = category_totals["BASIC"]

        elif category == "ALLOWANCE":
            if amount_type == "percentage":
                rate = rule_amt
                base = rule_values.get(rule.percentage_base or "BASIC", category_totals["BASIC"])
                line_total = round_curr(base * (rule_amt / Decimal("100.00")))
            else:
                line_total = round_curr(rule_amt)
            category_totals["ALLOWANCE"] += line_total
            rule_values[rule.code] = line_total

        elif category == "GROSS":
            # Auto compute total gross from basic + allowances
            computed_gross = category_totals["BASIC"] + category_totals["ALLOWANCE"]
            line_total = round_curr(computed_gross)
            category_totals["GROSS"] = line_total
            rule_values[rule.code] = line_total
            rule_values["GROSS"] = line_total

        elif category == "DEDUCTION":
            if amount_type == "percentage":
                rate = rule_amt
                base_code = rule.percentage_base or "BASIC"
                base = rule_values.get(base_code, category_totals["BASIC"] if base_code == "BASIC" else category_totals["GROSS"])
                line_total = round_curr(base * (rule_amt / Decimal("100.00")))
            else:
                line_total = round_curr(rule_amt)
            category_totals["DEDUCTION"] += line_total
            rule_values[rule.code] = line_total

        elif category == "NET":
            # Net = Gross - Deductions
            computed_net = max(Decimal("0.00"), category_totals["GROSS"] - category_totals["DEDUCTION"])
            line_total = round_curr(computed_net)
            category_totals["NET"] = line_total
            rule_values[rule.code] = line_total
            rule_values["NET"] = line_total

        else:
            line_total = round_curr(rule_amt)

        computed_lines.append({
            "salary_rule_id": rule.id,
            "name": rule.name,
            "code": rule.code,
            "category": category,
            "sequence": rule.sequence,
            "rate": rate,
            "amount": rule_amt,
            "total": line_total
        })

    # Summary wages
    final_basic = category_totals["BASIC"]
    final_gross = category_totals["GROSS"]
    final_deductions = category_totals["DEDUCTION"]
    final_net = category_totals["NET"]

    return final_basic, final_gross, final_deductions, final_net, computed_lines


# ==========================================
# 5. Payslip Snapshot & Engine Execution
# ==========================================

def compute_single_payslip(
    db: Session,
    payslip_id: int
) -> Payslip:
    """
    Execute full computation for an individual payslip:
    - Resolves active contract
    - Checks compliance warnings
    - Executes sequenced salary rules pipeline
    - Inserts computed rule outputs into payslip_lines snapshot
    """
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise ValueError(f"Payslip #{payslip_id} not found")

    if payslip.status == "paid":
        raise ValueError("Terminal Lock: Paid payslips cannot be recomputed.")

    # 1. Resolve Contract
    contract_data = resolve_active_contract(db, payslip.employee_id, payslip.date_from, payslip.date_to)
    if not contract_data:
        raise ValueError(f"No active contract found covering period {payslip.date_from} to {payslip.date_to} for Employee #{payslip.employee_id}")

    payslip.contract_id = contract_data["id"]
    wage = contract_data["wage"]

    # 2. Compliance Audit
    has_warning, warning_msg, bank_acc, ifsc = check_compliance_warnings(
        db, payslip.employee_id, payslip.date_from, payslip.date_to, current_payrun_id=payslip.payrun_id
    )
    payslip.has_warning = has_warning
    payslip.warning_message = warning_msg
    payslip.bank_account = bank_acc
    payslip.ifsc_code = ifsc

    # 3. Structure & Rules
    structure = None
    if payslip.structure_id:
        structure = db.query(SalaryStructure).filter(SalaryStructure.id == payslip.structure_id).first()
    if not structure:
        structure = get_or_create_default_structure(db)
        payslip.structure_id = structure.id

    rules = structure.rules
    if not rules:
        structure = get_or_create_default_structure(db)
        rules = structure.rules

    # 4. Sequenced Pipeline
    basic, gross, deductions, net, snapshot_lines = calculate_payslip_lines_pipeline(wage, rules)

    payslip.basic_wage = basic
    payslip.gross_wage = gross
    payslip.total_deductions = deductions
    payslip.net_wage = net
    payslip.status = "computed"

    # 5. Clear old lines & Insert snapshot lines
    db.query(PayslipLine).filter(PayslipLine.payslip_id == payslip.id).delete()
    db.flush()

    for line_data in snapshot_lines:
        line = PayslipLine(
            payslip_id=payslip.id,
            salary_rule_id=line_data["salary_rule_id"],
            name=line_data["name"],
            code=line_data["code"],
            category=line_data["category"],
            sequence=line_data["sequence"],
            rate=line_data["rate"],
            amount=line_data["amount"],
            total=line_data["total"]
        )
        db.add(line)

    db.flush()
    return payslip


def compute_payrun_batch(db: Session, payrun_id: int) -> Payrun:
    """
    Compute all payslips in a payrun batch, updating summary statistics.
    """
    payrun = db.query(Payrun).filter(Payrun.id == payrun_id).first()
    if not payrun:
        raise ValueError(f"Payrun #{payrun_id} not found")

    if payrun.status == "paid":
        raise ValueError("Terminal Lock: Paid payruns cannot be recomputed.")

    tot_basic = Decimal("0.00")
    tot_gross = Decimal("0.00")
    tot_net = Decimal("0.00")
    warning_cnt = 0

    for slip in payrun.payslips:
        computed_slip = compute_single_payslip(db, slip.id)
        tot_basic += computed_slip.basic_wage
        tot_gross += computed_slip.gross_wage
        tot_net += computed_slip.net_wage
        if computed_slip.has_warning:
            warning_cnt += 1

    payrun.total_basic = tot_basic
    payrun.total_gross = tot_gross
    payrun.total_net = tot_net
    payrun.payslip_count = len(payrun.payslips)
    payrun.warning_count = warning_cnt
    payrun.status = "computed"

    db.flush()
    return payrun
