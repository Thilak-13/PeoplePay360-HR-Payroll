from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from server.modules.payroll.database import get_db
from server.modules.payroll.models import (
    SalaryStructure,
    SalaryRule,
    Payrun,
    Payslip,
    PayslipLine,
)
from server.modules.payroll.schemas import (
    SalaryStructureCreate,
    SalaryStructureUpdate,
    SalaryStructureResponse,
    SalaryStructureDetailResponse,
    SalaryRuleCreate,
    SalaryRuleUpdate,
    SalaryRuleResponse,
    PayrunCreate,
    PayrunUpdate,
    PayrunResponse,
    PayrunDetailResponse,
    PayslipResponse,
    PayslipDetailResponse,
    PayrunWizardStep1ValidateRequest,
    PayrunWizardStep1ValidateResponse,
    EligibleEmployeeResponse,
    PayrunWizardStep2ConfirmRequest,
    StateTransitionRequest,
    PayrollSummaryMetrics,
)
from server.modules.payroll.services import PayrollService
from server.modules.payroll.engine import get_eligible_employees

router = APIRouter()


# ==========================================
# 1. Health Check
# ==========================================

@router.get("/ping", tags=["Payroll Baseline"])
def ping():
    return {"module": "payroll_ready"}


# ==========================================
# 2. Metrics & Dashboard Summary
# ==========================================

@router.get("/metrics", response_model=PayrollSummaryMetrics, tags=["Payroll Analytics"])
def get_payroll_metrics(db: Session = Depends(get_db)):
    """Retrieve aggregate payroll KPI metrics."""
    return PayrollService.get_payroll_metrics(db)


# ==========================================
# 3. Salary Structures & Rules
# ==========================================

@router.get("/structures", response_model=List[SalaryStructureResponse], tags=["Salary Structures"])
def list_salary_structures(db: Session = Depends(get_db)):
    """List all available salary structures."""
    return PayrollService.list_structures(db)


@router.post("/structures", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED, tags=["Salary Structures"])
def create_salary_structure(data: SalaryStructureCreate, db: Session = Depends(get_db)):
    """Create a new salary structure with optional nested rules."""
    try:
        return PayrollService.create_structure(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/structures/{structure_id}", response_model=SalaryStructureDetailResponse, tags=["Salary Structures"])
def get_salary_structure(structure_id: int, db: Session = Depends(get_db)):
    """Get salary structure details with sequenced rules."""
    struct = PayrollService.get_structure_by_id(db, structure_id)
    if not struct:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Salary structure #{structure_id} not found")
    return struct


@router.put("/structures/{structure_id}", response_model=SalaryStructureResponse, tags=["Salary Structures"])
def update_salary_structure(structure_id: int, data: SalaryStructureUpdate, db: Session = Depends(get_db)):
    """Update salary structure metadata."""
    try:
        return PayrollService.update_structure(db, structure_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/structures/{structure_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Salary Structures"])
def delete_salary_structure(structure_id: int, db: Session = Depends(get_db)):
    """Delete salary structure."""
    try:
        PayrollService.delete_structure(db, structure_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/structures/{structure_id}/rules", response_model=SalaryRuleResponse, status_code=status.HTTP_201_CREATED, tags=["Salary Rules"])
def add_salary_rule(structure_id: int, data: SalaryRuleCreate, db: Session = Depends(get_db)):
    """Add a sequenced calculation rule to a structure."""
    try:
        return PayrollService.add_rule_to_structure(db, structure_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/rules/{rule_id}", response_model=SalaryRuleResponse, tags=["Salary Rules"])
def update_salary_rule(rule_id: int, data: SalaryRuleUpdate, db: Session = Depends(get_db)):
    """Update an individual salary rule."""
    try:
        return PayrollService.update_rule(db, rule_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Salary Rules"])
def delete_salary_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a salary rule."""
    try:
        PayrollService.delete_rule(db, rule_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 4. Payrun Wizard & Eligible Employee Queries
# ==========================================

@router.post("/payruns/wizard/step1-validate", response_model=PayrunWizardStep1ValidateResponse, tags=["Payrun Wizard"])
def wizard_step1_validate(req: PayrunWizardStep1ValidateRequest, db: Session = Depends(get_db)):
    """Step 1 validation: date range, structure validation, and overlap detection."""
    return PayrollService.wizard_step1_validate(db, req)


@router.get("/payruns/wizard/eligible-employees", response_model=List[EligibleEmployeeResponse], tags=["Payrun Wizard"])
def get_wizard_eligible_employees(
    period_start: date = Query(..., description="Payrun period start date (YYYY-MM-DD)"),
    period_end: date = Query(..., description="Payrun period end date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Step 2 – Eligible employee listing.

    Queries all employees who have an active, non-cancelled contract that overlaps
    the requested [period_start, period_end] interval.  For each candidate the
    pre-validation compliance audit is executed (missing bank details, duplicate
    payslip overlap) and the result is surfaced as ``has_warning`` / ``warning_reason``
    on the returned :class:`EligibleEmployeeItem` so the UI can highlight problems
    before the user confirms the payrun.
    """
    if period_start > period_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_start must not be after period_end",
        )
    return get_eligible_employees(db, period_start, period_end)


@router.post("/payruns/wizard/step2-confirm", response_model=PayrunResponse, status_code=status.HTTP_201_CREATED, tags=["Payrun Wizard"])
def wizard_step2_confirm(req: PayrunWizardStep2ConfirmRequest, db: Session = Depends(get_db)):
    """
    Step 2 – Confirm and create payrun.

    Accepts a :class:`PayrunCreate` body.  Creates a :class:`Payrun` record in
    ``'draft'`` status, then creates a placeholder :class:`Payslip` (also
    ``'draft'``, with zeroed wage fields) for every employee ID listed in
    ``selected_employee_ids``.  Each placeholder payslip already has compliance
    warnings resolved (bank details, duplicate overlap) so the UI can display
    them immediately.  Wages are computed later via the ``/compute`` endpoint.
    """
    try:
        return PayrollService.wizard_step2_confirm_and_create(db, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 5. Payrun Batch Management & State Transitions
# ==========================================

@router.get("/payruns", response_model=List[PayrunResponse], tags=["Payruns"])
def list_payruns(
    status: Optional[str] = Query(None, description="Filter by status ('draft', 'computed', 'validated', 'paid')"),
    search: Optional[str] = Query(None, description="Search payruns by name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List payrun batches."""
    payruns, _ = PayrollService.list_payruns(db, status=status, search=search, limit=limit, offset=offset)
    return payruns


@router.post("/payruns", response_model=PayrunResponse, status_code=status.HTTP_201_CREATED, tags=["Payruns"])
def create_payrun(data: PayrunCreate, db: Session = Depends(get_db)):
    """Create a new payrun."""
    try:
        return PayrollService.create_payrun(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/payruns/{payrun_id}", response_model=PayrunDetailResponse, tags=["Payruns"])
def get_payrun_detail(payrun_id: int, db: Session = Depends(get_db)):
    """Get full details of a payrun including its payslip list and warnings."""
    payrun = PayrollService.get_payrun_by_id(db, payrun_id)
    if not payrun:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payrun #{payrun_id} not found")

    # Format payslips with employee info
    slips = []
    for s in payrun.payslips:
        # Fetch employee details from DB
        emp = db.execute(text("SELECT first_name, last_name, email, job_title FROM employees WHERE id = :id"), {"id": s.employee_id}).fetchone()
        emp_name = f"{emp[0]} {emp[1]}".strip() if emp else f"Employee #{s.employee_id}"
        emp_email = emp[2] if emp else None
        job_title = emp[3] if emp else None

        slips.append(PayslipResponse(
            id=s.id,
            payrun_id=s.payrun_id,
            employee_id=s.employee_id,
            contract_id=s.contract_id,
            structure_id=s.structure_id,
            date_from=s.date_from,
            date_to=s.date_to,
            basic_wage=s.basic_wage,
            gross_wage=s.gross_wage,
            net_wage=s.net_wage,
            total_deductions=s.total_deductions,
            status=s.status,
            has_warning=s.has_warning,
            warning_message=s.warning_message,
            bank_account=s.bank_account,
            ifsc_code=s.ifsc_code,
            employee_name=emp_name,
            employee_email=emp_email,
            job_title=job_title,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))

    return PayrunDetailResponse(
        id=payrun.id,
        name=payrun.name,
        date_start=payrun.date_start,
        date_end=payrun.date_end,
        status=payrun.status,
        structure_id=payrun.structure_id,
        total_basic=payrun.total_basic,
        total_gross=payrun.total_gross,
        total_net=payrun.total_net,
        payslip_count=payrun.payslip_count,
        warning_count=payrun.warning_count,
        structure_name=payrun.structure.name if payrun.structure else None,
        created_at=payrun.created_at,
        updated_at=payrun.updated_at,
        payslips=slips
    )


@router.post("/payruns/{payrun_id}/compute", response_model=PayrunDetailResponse, tags=["Payrun Execution"])
def compute_payrun(payrun_id: int, db: Session = Depends(get_db)):
    """Execute computation pipeline on all payslips in a payrun."""
    try:
        PayrollService.compute_payrun(db, payrun_id)
        return get_payrun_detail(payrun_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/payruns/{payrun_id}/transition", response_model=PayrunResponse, tags=["Payrun State Machine"])
def transition_payrun_state(
    payrun_id: int,
    req: StateTransitionRequest,
    db: Session = Depends(get_db)
):
    """
    Transition payrun state: draft -> computed -> validated -> paid
    - Enforces Validation Barrier: blocks transition to 'validated' if warnings exist.
    - Enforces Terminal Lock: transitioning to 'paid' permanently locks payrun and payslips.
    """
    try:
        return PayrollService.transition_payrun_state(db, payrun_id, req.target_status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/payruns/{payrun_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Payruns"])
def delete_payrun(payrun_id: int, db: Session = Depends(get_db)):
    """Delete payrun batch (allowed if not locked in paid status)."""
    try:
        PayrollService.delete_payrun(db, payrun_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 6. Payslips & Detailed Rule Breakdown
# ==========================================

@router.get("/payslips", response_model=List[PayslipResponse], tags=["Payslips"])
def list_payslips(
    payrun_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List payslips with optional filtering."""
    payslips, _ = PayrollService.list_payslips(db, payrun_id=payrun_id, employee_id=employee_id, status=status, limit=limit, offset=offset)
    
    res = []
    for s in payslips:
        emp = db.execute(text("SELECT first_name, last_name, email, job_title FROM employees WHERE id = :id"), {"id": s.employee_id}).fetchone()
        res.append(PayslipResponse(
            id=s.id,
            payrun_id=s.payrun_id,
            employee_id=s.employee_id,
            contract_id=s.contract_id,
            structure_id=s.structure_id,
            date_from=s.date_from,
            date_to=s.date_to,
            basic_wage=s.basic_wage,
            gross_wage=s.gross_wage,
            net_wage=s.net_wage,
            total_deductions=s.total_deductions,
            status=s.status,
            has_warning=s.has_warning,
            warning_message=s.warning_message,
            bank_account=s.bank_account,
            ifsc_code=s.ifsc_code,
            employee_name=f"{emp[0]} {emp[1]}".strip() if emp else None,
            employee_email=emp[2] if emp else None,
            job_title=emp[3] if emp else None,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))
    return res


@router.get("/payslips/{payslip_id}", response_model=PayslipDetailResponse, tags=["Payslips"])
def get_payslip_detail(payslip_id: int, db: Session = Depends(get_db)):
    """Get single payslip with itemized rule breakdown snapshot lines."""
    s = PayrollService.get_payslip_by_id(db, payslip_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payslip #{payslip_id} not found")

    emp = db.execute(text("""
        SELECT e.first_name, e.last_name, e.email, e.job_title, d.name 
        FROM employees e 
        LEFT JOIN departments d ON e.department_id = d.id 
        WHERE e.id = :id
    """), {"id": s.employee_id}).fetchone()

    lines = [
        {
            "id": l.id,
            "payslip_id": l.payslip_id,
            "salary_rule_id": l.salary_rule_id,
            "name": l.name,
            "code": l.code,
            "category": l.category,
            "sequence": l.sequence,
            "rate": l.rate,
            "amount": l.amount,
            "total": l.total,
            "created_at": l.created_at,
            "updated_at": l.updated_at
        }
        for l in s.lines
    ]

    return PayslipDetailResponse(
        id=s.id,
        payrun_id=s.payrun_id,
        employee_id=s.employee_id,
        contract_id=s.contract_id,
        structure_id=s.structure_id,
        date_from=s.date_from,
        date_to=s.date_to,
        basic_wage=s.basic_wage,
        gross_wage=s.gross_wage,
        net_wage=s.net_wage,
        total_deductions=s.total_deductions,
        status=s.status,
        has_warning=s.has_warning,
        warning_message=s.warning_message,
        bank_account=s.bank_account,
        ifsc_code=s.ifsc_code,
        employee_name=f"{emp[0]} {emp[1]}".strip() if emp else None,
        employee_email=emp[2] if emp else None,
        job_title=emp[3] if emp else None,
        department_name=emp[4] if emp else None,
        created_at=s.created_at,
        updated_at=s.updated_at,
        lines=lines,
        structure=s.structure
    )


@router.post("/payslips/{payslip_id}/compute", response_model=PayslipDetailResponse, tags=["Payslips"])
def compute_single_payslip_endpoint(payslip_id: int, db: Session = Depends(get_db)):
    """Recompute individual payslip."""
    try:
        PayrollService.compute_payslip(db, payslip_id)
        return get_payslip_detail(payslip_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
