from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, desc

from server.modules.payroll.models import (
    SalaryStructure,
    SalaryRule,
    Payrun,
    Payslip,
    PayslipLine,
)
from server.modules.payroll.schemas import (
    PayrunCreate,
    PayrunUpdate,
    SalaryStructureCreate,
    SalaryStructureUpdate,
    SalaryRuleCreate,
    SalaryRuleUpdate,
    PayrunWizardStep1ValidateRequest,
    PayrunWizardStep1ValidateResponse,
    PayrunWizardStep2ConfirmRequest,
)
from server.modules.payroll.engine import (
    get_or_create_default_structure,
    get_eligible_employees,
    resolve_active_contract,
    check_compliance_warnings,
    compute_single_payslip,
    compute_payrun_batch,
)


class PayrollService:

    # ==========================================
    # Salary Structures & Rules
    # ==========================================

    @staticmethod
    def list_structures(db: Session) -> List[SalaryStructure]:
        get_or_create_default_structure(db)
        return db.query(SalaryStructure).order_by(SalaryStructure.name.asc()).all()

    @staticmethod
    def get_structure_by_id(db: Session, structure_id: int) -> Optional[SalaryStructure]:
        return db.query(SalaryStructure).filter(SalaryStructure.id == structure_id).first()

    @staticmethod
    def create_structure(db: Session, data: SalaryStructureCreate) -> SalaryStructure:
        existing = db.query(SalaryStructure).filter(SalaryStructure.code == data.code).first()
        if existing:
            raise ValueError(f"Salary structure with code '{data.code}' already exists")

        structure = SalaryStructure(
            name=data.name,
            code=data.code,
            parent_id=data.parent_id
        )
        db.add(structure)
        db.flush()

        if data.rules:
            for r in data.rules:
                rule = SalaryRule(
                    structure_id=structure.id,
                    name=r.name,
                    code=r.code,
                    category=r.category,
                    sequence=r.sequence,
                    amount_type=r.amount_type,
                    amount=r.amount,
                    percentage_base=r.percentage_base,
                    condition_code=r.condition_code
                )
                db.add(rule)
            db.flush()

        db.commit()
        db.refresh(structure)
        return structure

    @staticmethod
    def update_structure(db: Session, structure_id: int, data: SalaryStructureUpdate) -> SalaryStructure:
        structure = PayrollService.get_structure_by_id(db, structure_id)
        if not structure:
            raise ValueError(f"Salary structure #{structure_id} not found")

        if data.name is not None:
            structure.name = data.name
        if data.code is not None:
            structure.code = data.code
        if data.parent_id is not None:
            structure.parent_id = data.parent_id

        db.commit()
        db.refresh(structure)
        return structure

    @staticmethod
    def delete_structure(db: Session, structure_id: int) -> bool:
        structure = PayrollService.get_structure_by_id(db, structure_id)
        if not structure:
            raise ValueError(f"Salary structure #{structure_id} not found")

        # Check if used by any payslips
        payslip_count = db.query(Payslip).filter(Payslip.structure_id == structure_id).count()
        if payslip_count > 0:
            raise ValueError(f"Cannot delete structure #{structure_id}: linked to {payslip_count} payslips")

        db.delete(structure)
        db.commit()
        return True

    @staticmethod
    def add_rule_to_structure(db: Session, structure_id: int, data: SalaryRuleCreate) -> SalaryRule:
        structure = PayrollService.get_structure_by_id(db, structure_id)
        if not structure:
            raise ValueError(f"Salary structure #{structure_id} not found")

        rule = SalaryRule(
            structure_id=structure_id,
            name=data.name,
            code=data.code,
            category=data.category,
            sequence=data.sequence,
            amount_type=data.amount_type,
            amount=data.amount,
            percentage_base=data.percentage_base,
            condition_code=data.condition_code
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def update_rule(db: Session, rule_id: int, data: SalaryRuleUpdate) -> SalaryRule:
        rule = db.query(SalaryRule).filter(SalaryRule.id == rule_id).first()
        if not rule:
            raise ValueError(f"Salary rule #{rule_id} not found")

        if data.name is not None:
            rule.name = data.name
        if data.code is not None:
            rule.code = data.code
        if data.category is not None:
            rule.category = data.category
        if data.sequence is not None:
            rule.sequence = data.sequence
        if data.amount_type is not None:
            rule.amount_type = data.amount_type
        if data.amount is not None:
            rule.amount = data.amount
        if data.percentage_base is not None:
            rule.percentage_base = data.percentage_base
        if data.condition_code is not None:
            rule.condition_code = data.condition_code

        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def delete_rule(db: Session, rule_id: int) -> bool:
        rule = db.query(SalaryRule).filter(SalaryRule.id == rule_id).first()
        if not rule:
            raise ValueError(f"Salary rule #{rule_id} not found")

        db.delete(rule)
        db.commit()
        return True

    # ==========================================
    # Wizard Validations & Employee Queries
    # ==========================================

    @staticmethod
    def wizard_step1_validate(db: Session, req: PayrunWizardStep1ValidateRequest) -> PayrunWizardStep1ValidateResponse:
        """Step 1 validation: date range, structure validation, and overlap detection."""
        if req.date_start > req.date_end:
            return PayrunWizardStep1ValidateResponse(
                valid=False,
                message="Start date cannot be after end date",
                overlapping_payruns=[],
                eligible_employee_count=0
            )

        # Check overlapping payruns
        overlap_query = db.query(Payrun).filter(
            Payrun.period_start <= req.date_end,
            Payrun.period_end >= req.date_start,
            Payrun.status != "cancelled"
        ).all()

        overlapping_names = [f"{p.name} ({p.period_start} to {p.period_end}) [{p.status}]" for p in overlap_query]

        # Check structure
        structure_name = None
        if req.structure_id:
            st = db.query(SalaryStructure).filter(SalaryStructure.id == req.structure_id).first()
            if st:
                structure_name = st.name
        else:
            default_st = get_or_create_default_structure(db)
            structure_name = default_st.name

        # Count eligible employees
        eligible = get_eligible_employees(db, req.date_start, req.date_end)

        return PayrunWizardStep1ValidateResponse(
            valid=True,
            message="Step 1 parameters are valid",
            overlapping_payruns=overlapping_names,
            eligible_employee_count=len(eligible),
            structure_name=structure_name
        )

    @staticmethod
    def wizard_step2_confirm_and_create(db: Session, req: PayrunWizardStep2ConfirmRequest) -> Payrun:
        """Step 2 confirmation: creates payrun in 'draft' and draft placeholder payslips for selected employees."""
        if req.period_start > req.period_end:
            raise ValueError("period_start cannot be after period_end")

        # Resolve structure (fall back to default when not specified)
        structure_id = req.structure_id
        if not structure_id:
            default_st = get_or_create_default_structure(db)
            structure_id = default_st.id

        # Create Payrun in 'draft' status
        payrun = Payrun(
            name=req.name,
            period_start=req.period_start,
            period_end=req.period_end,
            structure_id=structure_id,
            status="draft"
        )
        db.add(payrun)
        db.flush()

        # Determine selected employee IDs – prefer selected_employee_ids, fall back to all eligible
        selected_ids: set[int] = set(req.selected_employee_ids) if req.selected_employee_ids else set()

        # If no explicit selection was provided, include all eligible employees
        if not selected_ids:
            eligible_all = get_eligible_employees(db, req.period_start, req.period_end)
            selected_ids = {e["employee_id"] for e in eligible_all}

        # Fetch eligible employee records to validate contracts exist
        eligible = get_eligible_employees(db, req.period_start, req.period_end)
        eligible_map = {e["employee_id"]: e for e in eligible}

        for emp_id in selected_ids:
            emp = eligible_map.get(emp_id)
            if not emp:
                # Skip employees that have no valid active contract for this period
                continue

            has_warn, warn_msg, bank_acc, ifsc = check_compliance_warnings(
                db, emp_id, req.period_start, req.period_end, current_payrun_id=payrun.id
            )

            # Placeholder payslip – wages are zeroed until /compute is called
            payslip = Payslip(
                payrun_id=payrun.id,
                employee_id=emp_id,
                contract_id=emp["contract_id"],
                structure_id=structure_id,
                date_from=req.period_start,
                date_to=req.period_end,
                basic_wage=Decimal("0.00"),
                gross_wage=Decimal("0.00"),
                net_wage=Decimal("0.00"),
                total_deductions=Decimal("0.00"),
                status="draft",
                has_warning=has_warn,
                warning_message=warn_msg,
                bank_account=bank_acc,
                ifsc_code=ifsc
            )
            db.add(payslip)

        db.flush()
        payrun.payslip_count = len(payrun.payslips)
        payrun.warning_count = sum(1 for p in payrun.payslips if p.has_warning)
        db.commit()
        db.refresh(payrun)
        return payrun


    # ==========================================
    # Payrun Management & State Machine
    # ==========================================

    @staticmethod
    def list_payruns(
        db: Session,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Payrun], int]:
        query = db.query(Payrun)
        if status:
            query = query.filter(Payrun.status == status)
        if search:
            query = query.filter(Payrun.name.ilike(f"%{search}%"))

        total = query.count()
        payruns = query.order_by(desc(Payrun.period_start), desc(Payrun.id)).offset(offset).limit(limit).all()
        return payruns, total

    @staticmethod
    def get_payrun_by_id(db: Session, payrun_id: int) -> Optional[Payrun]:
        return db.query(Payrun).filter(Payrun.id == payrun_id).first()

    @staticmethod
    def create_payrun(db: Session, data: PayrunCreate) -> Payrun:
        default_st = get_or_create_default_structure(db)
        struct_id = data.structure_id or default_st.id

        payrun = Payrun(
            name=data.name,
            date_start=data.date_start,
            date_end=data.date_end,
            structure_id=struct_id,
            status="draft"
        )
        db.add(payrun)
        db.flush()

        # Populate eligible employee payslips
        eligible = get_eligible_employees(db, data.date_start, data.date_end)
        for emp in eligible:
            has_warn, warn_msg, bank_acc, ifsc = check_compliance_warnings(
                db, emp["employee_id"], data.date_start, data.date_end, current_payrun_id=payrun.id
            )
            payslip = Payslip(
                payrun_id=payrun.id,
                employee_id=emp["employee_id"],
                contract_id=emp["contract_id"],
                structure_id=struct_id,
                date_from=data.date_start,
                date_to=data.date_end,
                status="draft",
                has_warning=has_warn,
                warning_message=warn_msg,
                bank_account=bank_acc,
                ifsc_code=ifsc
            )
            db.add(payslip)

        db.flush()
        payrun.payslip_count = len(payrun.payslips)
        payrun.warning_count = sum(1 for p in payrun.payslips if p.has_warning)
        db.commit()
        db.refresh(payrun)
        return payrun

    @staticmethod
    def compute_payrun(db: Session, payrun_id: int) -> Payrun:
        """Compute all payslips in a payrun batch."""
        payrun = compute_payrun_batch(db, payrun_id)
        db.commit()
        db.refresh(payrun)
        return payrun

    @staticmethod
    def transition_payrun_state(db: Session, payrun_id: int, target_status: str) -> Payrun:
        """
        State Machine: draft -> computed -> validated -> paid (or cancelled)
        - Enforces validation barrier: Block transition to validated if unresolved warnings exist.
        - Enforce terminal lock: Transitioning to paid locks payslips and payruns from further edits.
        """
        payrun = PayrollService.get_payrun_by_id(db, payrun_id)
        if not payrun:
            raise ValueError(f"Payrun #{payrun_id} not found")

        current_status = payrun.status
        target_status = target_status.lower()

        # Terminal lock enforcement
        if current_status == "paid":
            raise ValueError("Terminal Lock: Payrun is in 'paid' status and cannot be modified or re-transitioned.")

        # Valid transition rules
        valid_transitions = {
            "draft": ["computed", "cancelled"],
            "computed": ["draft", "validated", "cancelled"],
            "validated": ["computed", "paid", "cancelled"],
            "cancelled": ["draft"]
        }

        if target_status not in valid_transitions.get(current_status, []):
            raise ValueError(f"Invalid state transition from '{current_status}' to '{target_status}'. Allowed: {valid_transitions.get(current_status, [])}")

        # Validation Barrier: Block transition to 'validated' if unresolved warnings exist
        if target_status == "validated":
            unresolved_warnings = [p for p in payrun.payslips if p.has_warning]
            if unresolved_warnings:
                warning_details = [f"Emp #{p.employee_id}: {p.warning_message}" for p in unresolved_warnings[:3]]
                raise ValueError(
                    f"Validation Barrier Blocked: Cannot transition to 'validated' while {len(unresolved_warnings)} payslips have unresolved compliance warnings. ({'; '.join(warning_details)})"
                )

        # Transition to paid: Lock payslips
        if target_status == "paid":
            for slip in payrun.payslips:
                slip.status = "paid"
            payrun.status = "paid"
        else:
            payrun.status = target_status
            for slip in payrun.payslips:
                slip.status = target_status

        db.commit()
        db.refresh(payrun)
        return payrun

    @staticmethod
    def delete_payrun(db: Session, payrun_id: int) -> bool:
        payrun = PayrollService.get_payrun_by_id(db, payrun_id)
        if not payrun:
            raise ValueError(f"Payrun #{payrun_id} not found")

        if payrun.status == "paid":
            raise ValueError("Terminal Lock: Paid payruns cannot be deleted.")

        db.delete(payrun)
        db.commit()
        return True

    # ==========================================
    # Payslips & Line Items
    # ==========================================

    @staticmethod
    def list_payslips(
        db: Session,
        payrun_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Payslip], int]:
        query = db.query(Payslip)
        if payrun_id:
            query = query.filter(Payslip.payrun_id == payrun_id)
        if employee_id:
            query = query.filter(Payslip.employee_id == employee_id)
        if status:
            query = query.filter(Payslip.status == status)

        total = query.count()
        payslips = query.order_by(desc(Payslip.id)).offset(offset).limit(limit).all()
        return payslips, total

    @staticmethod
    def get_payslip_by_id(db: Session, payslip_id: int) -> Optional[Payslip]:
        return db.query(Payslip).filter(Payslip.id == payslip_id).first()

    @staticmethod
    def compute_payslip(db: Session, payslip_id: int) -> Payslip:
        payslip = compute_single_payslip(db, payslip_id)
        db.commit()
        db.refresh(payslip)
        return payslip

    # ==========================================
    # Metrics & Dashboard Summaries
    # ==========================================

    @staticmethod
    def get_payroll_metrics(db: Session) -> Dict[str, Any]:
        all_payruns = db.query(Payrun).all()
        total_payruns = len(all_payruns)
        draft_payruns = sum(1 for p in all_payruns if p.status == "draft")
        computed_payruns = sum(1 for p in all_payruns if p.status == "computed")
        validated_payruns = sum(1 for p in all_payruns if p.status == "validated")
        paid_payruns = sum(1 for p in all_payruns if p.status == "paid")

        total_paid_ytd = sum(p.total_net for p in all_payruns if p.status == "paid")
        
        # Current month payout
        current_month = date.today().month
        current_year = date.today().year
        cur_month_net = sum(
            p.total_net for p in all_payruns 
            if p.period_start.month == current_month and p.period_start.year == current_year and p.status in ("computed", "validated", "paid")
        )

        pending_warnings = sum(p.warning_count for p in all_payruns if p.status != "cancelled")

        return {
            "total_payruns": total_payruns,
            "draft_payruns": draft_payruns,
            "computed_payruns": computed_payruns,
            "validated_payruns": validated_payruns,
            "paid_payruns": paid_payruns,
            "total_paid_ytd": total_paid_ytd,
            "current_month_net_payout": cur_month_net,
            "pending_warnings": pending_warnings
        }
