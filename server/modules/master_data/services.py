from datetime import date, timedelta
from typing import Optional, List, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from fastapi import HTTPException, status

from server.modules.master_data.models import (
    Department,
    WorkingSchedule,
    WorkingScheduleDay,
    Employee,
    Contract,
    LeaveAllocation,
    LeaveRequest,
)
from server.modules.master_data.schemas import (
    ContractCreate,
    ContractUpdate,
    LeaveRequestCreate,
    ScheduleCalculationRequest,
    ScheduleCalculationResponse,
)


# ==============================================================================
# 1. WORKING SCHEDULE CALCULATION UTILITIES
# ==============================================================================

def parse_time_hours(time_str: str) -> float:
    """Parses 'HH:MM' string to decimal hours (e.g., '09:30' -> 9.5)."""
    try:
        parts = time_str.strip().split(":")
        return float(parts[0]) + float(parts[1]) / 60.0
    except Exception:
        return 0.0


def compute_hours_from_days(days: List) -> Decimal:
    """Computes total weekly hours from daily schedule lines ((end_hour - start_hour - break_hours))."""
    total = 0.0
    for day in days:
        if isinstance(day, dict):
            s_time = day.get("start_time", "09:00")
            e_time = day.get("end_time", "18:00")
            b_hours = float(day.get("break_hours", 1.0))
        else:
            s_time = getattr(day, "start_time", "09:00")
            e_time = getattr(day, "end_time", "18:00")
            b_hours = float(getattr(day, "break_hours", 1.0))
        
        start = parse_time_hours(str(s_time))
        end = parse_time_hours(str(e_time))
        day_hours = max(0.0, end - start - b_hours)
        total += day_hours
    return Decimal(str(round(total, 2)))


def calculate_working_hours(
    hours_per_week: Decimal = Decimal("40.00"),
    days_per_week: int = 5,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    schedule: Optional[WorkingSchedule] = None,
) -> ScheduleCalculationResponse:
    """Calculates weekly hours, daily hours, and total hours across date ranges, accounting for daily schedule lines if available."""
    if schedule and schedule.days and len(schedule.days) > 0:
        day_hours_map = {}
        for d in schedule.days:
            sh = parse_time_hours(str(d.start_time))
            eh = parse_time_hours(str(d.end_time))
            bh = float(d.break_hours)
            day_hours_map[d.day_of_week] = max(0.0, eh - sh - bh)

        total_weekly_hours = sum(day_hours_map.values())
        num_schedule_days = len(day_hours_map)
        avg_hours_per_day = round(total_weekly_hours / num_schedule_days, 2) if num_schedule_days > 0 else 0.0

        if date_from and date_to:
            if date_from > date_to:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="date_from must be less than or equal to date_to",
                )
            working_days = 0
            total_hours = 0.0
            curr = date_from
            while curr <= date_to:
                dow = curr.weekday()
                if dow in day_hours_map:
                    working_days += 1
                    total_hours += day_hours_map[dow]
                curr += timedelta(days=1)
            total_hours = round(total_hours, 2)
            message = f"Calculated {working_days} working days ({total_hours} total hours) from {date_from} to {date_to} using schedule '{schedule.name}'."
        else:
            working_days = num_schedule_days
            total_hours = round(total_weekly_hours, 2)
            message = f"Schedule '{schedule.name}': {total_weekly_hours:.2f} hours/week ({avg_hours_per_day:.2f} avg hours/day across {num_schedule_days} days)."

        return ScheduleCalculationResponse(
            hours_per_week=round(total_weekly_hours, 2),
            hours_per_day=avg_hours_per_day,
            working_days=working_days,
            total_calculated_hours=total_hours,
            message=message,
        )

    if days_per_week <= 0 or days_per_week > 7:
        days_per_week = 5

    hours_per_week_float = float(hours_per_week)
    hours_per_day_float = round(hours_per_week_float / days_per_week, 2)

    working_days = 0
    if date_from and date_to:
        if date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from must be less than or equal to date_to",
            )
        # Calculate working days (Mon-Fri or by days_per_week)
        curr = date_from
        while curr <= date_to:
            if curr.weekday() < days_per_week:
                working_days += 1
            curr += timedelta(days=1)
        total_hours = round(working_days * hours_per_day_float, 2)
        message = f"Calculated {working_days} working days ({total_hours} total hours) from {date_from} to {date_to}."
    else:
        working_days = days_per_week
        total_hours = hours_per_week_float
        message = f"Standard schedule: {hours_per_week_float} hours/week ({hours_per_day_float} hours/day across {days_per_week} days)."

    return ScheduleCalculationResponse(
        hours_per_week=hours_per_week_float,
        hours_per_day=hours_per_day_float,
        working_days=working_days,
        total_calculated_hours=total_hours,
        message=message,
    )


# ==============================================================================
# 2. CONTRACT VALIDATION & BUSINESS LOGIC
# ==============================================================================

def validate_contract_dates(start_date: date, end_date: Optional[date]):
    """Validates that start_date <= end_date."""
    if end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract start_date ({start_date}) cannot be after end_date ({end_date}).",
        )


def check_contract_overlap(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: Optional[date],
    exclude_contract_id: Optional[int] = None,
    new_status: str = "active",
):
    """
    Rejects overlapping active contracts for the same employee.
    Two active/running contracts overlap if:
      (contract.start_date <= new_end_date OR new_end_date IS NULL) AND
      (contract.end_date >= new_start_date OR contract.end_date IS NULL)
    """
    if new_status not in ["active", "running"]:
        return  # Only active/running contracts are constrained by overlapping rules

    query = db.query(Contract).filter(
        Contract.employee_id == employee_id,
        Contract.status.in_(["active", "running"]),
    )
    if exclude_contract_id:
        query = query.filter(Contract.id != exclude_contract_id)

    existing_active = query.all()

    for contract in existing_active:
        c_start = contract.start_date
        c_end = contract.end_date

        # Overlap condition
        starts_before_c_ends = (c_end is None) or (start_date <= c_end)
        ends_after_c_starts = (end_date is None) or (end_date >= c_start)

        if starts_before_c_ends and ends_after_c_starts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Contract overlaps with existing active contract (ID #{contract.id}: "
                    f"{c_start} to {c_end or 'Ongoing'}). An employee cannot have multiple overlapping active contracts."
                ),
            )


def create_employee_contract(db: Session, contract_data: ContractCreate) -> Contract:
    """Creates contract after validating dates and active overlap constraints."""
    validate_contract_dates(contract_data.start_date, contract_data.end_date)
    
    # Ensure employee exists
    emp = db.query(Employee).filter(Employee.id == contract_data.employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{contract_data.employee_id} not found.",
        )

    check_contract_overlap(
        db,
        employee_id=contract_data.employee_id,
        start_date=contract_data.start_date,
        end_date=contract_data.end_date,
        new_status=contract_data.status,
    )

    db_contract = Contract(**contract_data.model_dump())
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


def update_employee_contract(db: Session, contract_id: int, update_data: ContractUpdate) -> Contract:
    """Updates contract with validation on dates and active overlap constraints."""
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract #{contract_id} not found.",
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    
    new_start = update_dict.get("start_date", db_contract.start_date)
    new_end = update_dict.get("end_date", db_contract.end_date)
    new_status = update_dict.get("status", db_contract.status)

    validate_contract_dates(new_start, new_end)

    if new_status in ["active", "running"]:
        check_contract_overlap(
            db,
            employee_id=db_contract.employee_id,
            start_date=new_start,
            end_date=new_end,
            exclude_contract_id=contract_id,
            new_status=new_status,
        )

    for field, value in update_dict.items():
        setattr(db_contract, field, value)

    db.commit()
    db.refresh(db_contract)
    return db_contract


# ==============================================================================
# 3. LEAVE ALLOCATION & REQUEST WORKFLOW (ATOMIC DEDUCTIONS)
# ==============================================================================

def calculate_leave_days_count(date_from: date, date_to: date) -> Decimal:
    """Calculates number of leave days between two dates inclusive."""
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave date_from must be less than or equal to date_to",
        )
    # Inclusive count of calendar days
    days = (date_to - date_from).days + 1
    return Decimal(str(days))


def get_leave_balance(db: Session, employee_id: int, holiday_type: str, year: int) -> Tuple[Decimal, Decimal, Decimal]:
    """
    Returns (allocated_days, used_days, remaining_days) for employee, holiday_type, and year.
    """
    # Sum of approved allocations
    total_alloc = db.query(func.coalesce(func.sum(LeaveAllocation.number_of_days), 0)).filter(
        LeaveAllocation.employee_id == employee_id,
        LeaveAllocation.holiday_type == holiday_type,
        LeaveAllocation.year == year,
        LeaveAllocation.status == "approved",
    ).scalar() or Decimal("0")

    # Sum of approved leave requests
    total_used = db.query(func.coalesce(func.sum(LeaveRequest.number_of_days), 0)).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.holiday_type == holiday_type,
        LeaveRequest.status == "approved",
        func.extract("year", LeaveRequest.date_from) == year,
    ).scalar() or Decimal("0")

    remaining = Decimal(str(total_alloc)) - Decimal(str(total_used))
    return Decimal(str(total_alloc)), Decimal(str(total_used)), remaining


def submit_leave_request(db: Session, request_data: LeaveRequestCreate) -> LeaveRequest:
    """Submits a leave request and validates allocation balance availability."""
    emp = db.query(Employee).filter(Employee.id == request_data.employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{request_data.employee_id} not found.",
        )

    # Calculate days if not provided
    num_days = request_data.number_of_days
    if not num_days or num_days <= 0:
        num_days = calculate_leave_days_count(request_data.date_from, request_data.date_to)

    year = request_data.date_from.year
    total_alloc, total_used, remaining = get_leave_balance(
        db, request_data.employee_id, request_data.holiday_type, year
    )

    if num_days > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient leave allocation balance for '{request_data.holiday_type}' in {year}. "
                f"Requested: {num_days} days, Available Remaining: {remaining} days (Allocated: {total_alloc}, Used: {total_used})."
            ),
        )

    db_request = LeaveRequest(
        employee_id=request_data.employee_id,
        holiday_type=request_data.holiday_type,
        date_from=request_data.date_from,
        date_to=request_data.date_to,
        number_of_days=num_days,
        status=request_data.status or "draft",
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


def approve_leave_request(db: Session, leave_request_id: int) -> Tuple[LeaveRequest, Decimal]:
    """
    Approves leave request with atomic verification and balance validation.
    """
    # Lock row for atomic approval
    leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_request_id).with_for_update().first()
    if not leave_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request #{leave_request_id} not found.",
        )

    if leave_req.status == "approved":
        total_alloc, total_used, remaining = get_leave_balance(
            db, leave_req.employee_id, leave_req.holiday_type, leave_req.date_from.year
        )
        return leave_req, remaining

    year = leave_req.date_from.year
    total_alloc, total_used, remaining = get_leave_balance(
        db, leave_req.employee_id, leave_req.holiday_type, year
    )

    if leave_req.number_of_days > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot approve leave request #{leave_request_id}: Insufficient balance. "
                f"Requested: {leave_req.number_of_days} days, Remaining balance: {remaining} days."
            ),
        )

    leave_req.status = "approved"
    db.commit()
    db.refresh(leave_req)

    # Calculate remaining balance after atomic approval deduction
    _, _, updated_remaining = get_leave_balance(
        db, leave_req.employee_id, leave_req.holiday_type, year
    )
    return leave_req, updated_remaining


def refuse_leave_request(db: Session, leave_request_id: int) -> LeaveRequest:
    """Refuses/rejects a leave request."""
    leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_request_id).first()
    if not leave_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request #{leave_request_id} not found.",
        )

    leave_req.status = "refused"
    db.commit()
    db.refresh(leave_req)
    return leave_req


# ==============================================================================
# 4. SMART-STAT COUNTS & EMPLOYEE DETAIL
# ==============================================================================

def get_employee_smart_stats(db: Session, employee_id: int) -> dict:
    """Calculates smart-stat counts: contracts_count, time_off_count, allocations_count."""
    contracts_count = db.query(func.count(Contract.id)).filter(Contract.employee_id == employee_id).scalar() or 0
    time_off_count = db.query(func.count(LeaveRequest.id)).filter(LeaveRequest.employee_id == employee_id).scalar() or 0
    allocations_count = db.query(func.count(LeaveAllocation.id)).filter(LeaveAllocation.employee_id == employee_id).scalar() or 0

    return {
        "contracts_count": contracts_count,
        "time_off_count": time_off_count,
        "allocations_count": allocations_count,
    }
