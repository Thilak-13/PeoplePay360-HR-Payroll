from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from server.modules.master_data.database import get_db, Base, engine
from server.modules.master_data.models import (
    Department,
    WorkingSchedule,
    Employee,
    Contract,
    LeaveAllocation,
    LeaveRequest,
)
from server.modules.master_data.schemas import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    WorkingScheduleCreate,
    WorkingScheduleUpdate,
    WorkingScheduleResponse,
    ScheduleCalculationRequest,
    ScheduleCalculationResponse,
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    LeaveAllocationCreate,
    LeaveAllocationUpdate,
    LeaveAllocationResponse,
    LeaveRequestCreate,
    LeaveRequestUpdate,
    LeaveRequestResponse,
    LeaveActionResponse,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeDetailResponse,
    EmployeeSmartStats,
)
from server.modules.master_data.services import (
    calculate_working_hours,
    create_employee_contract,
    update_employee_contract,
    submit_leave_request,
    approve_leave_request,
    refuse_leave_request,
    get_leave_balance,
    get_employee_smart_stats,
)

# Auto-create tables if they don't exist
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

router = APIRouter()


# ==============================================================================
# 0. BASELINE HEALTH CHECK
# ==============================================================================

@router.get("/ping", tags=["Health"])
def ping():
    """Baseline module readiness check."""
    return {"module": "master_data_ready"}


# ==============================================================================
# 1. WORKING SCHEDULES & CALCULATOR
# ==============================================================================

@router.post("/schedules/calculate-hours", response_model=ScheduleCalculationResponse, tags=["Schedules"])
def calculate_schedule_hours_endpoint(req: ScheduleCalculationRequest, db: Session = Depends(get_db)):
    """Utility to calculate weekly hours, daily hours, and span hours based on schedule."""
    hours_per_week = req.hours_per_week or Decimal("40.00")
    if req.working_schedule_id:
        schedule = db.query(WorkingSchedule).filter(WorkingSchedule.id == req.working_schedule_id).first()
        if schedule:
            hours_per_week = schedule.hours_per_week

    return calculate_working_hours(
        hours_per_week=hours_per_week,
        days_per_week=req.days_per_week or 5,
        date_from=req.date_from,
        date_to=req.date_to,
    )


@router.get("/schedules/calculate", response_model=ScheduleCalculationResponse, tags=["Schedules"])
def calculate_schedule_get(
    hours_per_week: float = 40.0,
    days_per_week: int = 5,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """GET endpoint for schedule weekly hours calculation."""
    return calculate_working_hours(
        hours_per_week=Decimal(str(hours_per_week)),
        days_per_week=days_per_week,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/working-schedules", response_model=List[WorkingScheduleResponse], tags=["Schedules"])
def list_working_schedules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(WorkingSchedule).offset(skip).limit(limit).all()


@router.post("/working-schedules", response_model=WorkingScheduleResponse, status_code=status.HTTP_201_CREATED, tags=["Schedules"])
def create_working_schedule(sched_in: WorkingScheduleCreate, db: Session = Depends(get_db)):
    schedule = WorkingSchedule(**sched_in.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/working-schedules/{schedule_id}", response_model=WorkingScheduleResponse, tags=["Schedules"])
def get_working_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(WorkingSchedule).filter(WorkingSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    return schedule


@router.put("/working-schedules/{schedule_id}", response_model=WorkingScheduleResponse, tags=["Schedules"])
def update_working_schedule(schedule_id: int, sched_in: WorkingScheduleUpdate, db: Session = Depends(get_db)):
    schedule = db.query(WorkingSchedule).filter(WorkingSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    for field, val in sched_in.model_dump(exclude_unset=True).items():
        setattr(schedule, field, val)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/working-schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Schedules"])
def delete_working_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(WorkingSchedule).filter(WorkingSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    db.delete(schedule)
    db.commit()


# ==============================================================================
# 2. DEPARTMENTS
# ==============================================================================

@router.get("/departments", response_model=List[DepartmentResponse], tags=["Departments"])
def list_departments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Department).offset(skip).limit(limit).all()


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED, tags=["Departments"])
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db)):
    if dept_in.code:
        existing = db.query(Department).filter(Department.code == dept_in.code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Department code '{dept_in.code}' already in use.")
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/departments/{dept_id}", response_model=DepartmentResponse, tags=["Departments"])
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.put("/departments/{dept_id}", response_model=DepartmentResponse, tags=["Departments"])
def update_department(dept_id: int, dept_in: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    update_dict = dept_in.model_dump(exclude_unset=True)
    if "code" in update_dict and update_dict["code"]:
        existing = db.query(Department).filter(Department.code == update_dict["code"], Department.id != dept_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Department code '{update_dict['code']}' already in use.")
    for field, val in update_dict.items():
        setattr(dept, field, val)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Departments"])
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()


# ==============================================================================
# 3. EMPLOYEES & DETAIL WITH SMART STATS
# ==============================================================================

@router.get("/employees", response_model=List[EmployeeResponse], tags=["Employees"])
def list_employees(
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List employees with optional text search and department/status filtering."""
    query = db.query(Employee)
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if status:
        query = query.filter(Employee.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Employee.first_name.ilike(s),
                Employee.last_name.ilike(s),
                Employee.email.ilike(s),
                Employee.job_title.ilike(s),
            )
        )
    return query.offset(skip).limit(limit).all()


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, tags=["Employees"])
def create_employee(emp_in: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.email == emp_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Employee with email '{emp_in.email}' already exists.")
    emp = Employee(**emp_in.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.get("/employees/{employee_id}/smart-stats", response_model=EmployeeSmartStats, tags=["Employees"])
def get_employee_smart_stats_endpoint(employee_id: int, db: Session = Depends(get_db)):
    """Returns top smart-stat counts: contracts_count, time_off_count, allocations_count."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return get_employee_smart_stats(db, employee_id)


@router.get("/employees/{employee_id}/detail", response_model=EmployeeDetailResponse, tags=["Employees"])
def get_employee_detail(employee_id: int, db: Session = Depends(get_db)):
    """
    Returns full employee details including related contracts, leave requests,
    allocations, and aggregate smart-stat counts.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    stats = get_employee_smart_stats(db, employee_id)

    return EmployeeDetailResponse(
        id=emp.id,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        department_id=emp.department_id,
        working_schedule_id=emp.working_schedule_id,
        job_title=emp.job_title,
        hire_date=emp.hire_date,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
        department=emp.department,
        working_schedule=emp.working_schedule,
        contracts_count=stats["contracts_count"],
        time_off_count=stats["time_off_count"],
        allocations_count=stats["allocations_count"],
        contracts=emp.contracts or [],
        leave_requests=emp.leave_requests or [],
        leave_allocations=emp.leave_allocations or [],
    )


@router.put("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
def update_employee(employee_id: int, emp_in: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    update_dict = emp_in.model_dump(exclude_unset=True)
    if "email" in update_dict and update_dict["email"]:
        existing = db.query(Employee).filter(Employee.email == update_dict["email"], Employee.id != employee_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Email '{update_dict['email']}' already in use.")
    for field, val in update_dict.items():
        setattr(emp, field, val)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Employees"])
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()


# ==============================================================================
# 4. CONTRACTS
# ==============================================================================

@router.get("/contracts", response_model=List[ContractResponse], tags=["Contracts"])
def list_contracts(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Contract)
    if employee_id:
        query = query.filter(Contract.employee_id == employee_id)
    if status:
        query = query.filter(Contract.status == status)
    return query.order_by(Contract.start_date.desc()).offset(skip).limit(limit).all()


@router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED, tags=["Contracts"])
def create_contract(contract_in: ContractCreate, db: Session = Depends(get_db)):
    """Creates contract with date validation and overlapping active contract rejection."""
    return create_employee_contract(db, contract_in)


@router.get("/contracts/{contract_id}", response_model=ContractResponse, tags=["Contracts"])
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.put("/contracts/{contract_id}", response_model=ContractResponse, tags=["Contracts"])
def update_contract(contract_id: int, contract_in: ContractUpdate, db: Session = Depends(get_db)):
    """Updates contract with validation on dates and active overlap rules."""
    return update_employee_contract(db, contract_id, contract_in)


@router.patch("/contracts/{contract_id}/status", response_model=ContractResponse, tags=["Contracts"])
def update_contract_status(contract_id: int, new_status: str = Query(..., pattern="^(draft|active|running|expired|cancelled)$"), db: Session = Depends(get_db)):
    """Updates contract status with overlap validation for active/running state."""
    return update_employee_contract(db, contract_id, ContractUpdate(status=new_status))


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Contracts"])
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()


# ==============================================================================
# 5. LEAVE ALLOCATIONS
# ==============================================================================

@router.get("/leave-allocations", response_model=List[LeaveAllocationResponse], tags=["Leave Allocations"])
def list_leave_allocations(
    employee_id: Optional[int] = None,
    holiday_type: Optional[str] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(LeaveAllocation)
    if employee_id:
        query = query.filter(LeaveAllocation.employee_id == employee_id)
    if holiday_type:
        query = query.filter(LeaveAllocation.holiday_type == holiday_type)
    if year:
        query = query.filter(LeaveAllocation.year == year)
    return query.offset(skip).limit(limit).all()


@router.post("/leave-allocations", response_model=LeaveAllocationResponse, status_code=status.HTTP_201_CREATED, tags=["Leave Allocations"])
def create_leave_allocation(alloc_in: LeaveAllocationCreate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == alloc_in.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee #{alloc_in.employee_id} not found")
    alloc = LeaveAllocation(**alloc_in.model_dump())
    db.add(alloc)
    db.commit()
    db.refresh(alloc)
    return alloc


@router.get("/leave-allocations/{alloc_id}", response_model=LeaveAllocationResponse, tags=["Leave Allocations"])
def get_leave_allocation(alloc_id: int, db: Session = Depends(get_db)):
    alloc = db.query(LeaveAllocation).filter(LeaveAllocation.id == alloc_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Leave allocation not found")
    return alloc


@router.put("/leave-allocations/{alloc_id}", response_model=LeaveAllocationResponse, tags=["Leave Allocations"])
def update_leave_allocation(alloc_id: int, alloc_in: LeaveAllocationUpdate, db: Session = Depends(get_db)):
    alloc = db.query(LeaveAllocation).filter(LeaveAllocation.id == alloc_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Leave allocation not found")
    for field, val in alloc_in.model_dump(exclude_unset=True).items():
        setattr(alloc, field, val)
    db.commit()
    db.refresh(alloc)
    return alloc


@router.delete("/leave-allocations/{alloc_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Leave Allocations"])
def delete_leave_allocation(alloc_id: int, db: Session = Depends(get_db)):
    alloc = db.query(LeaveAllocation).filter(LeaveAllocation.id == alloc_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Leave allocation not found")
    db.delete(alloc)
    db.commit()


@router.get("/leave-allocations/balance/{employee_id}", tags=["Leave Allocations"])
def get_employee_leave_balances(employee_id: int, year: Optional[int] = None, db: Session = Depends(get_db)):
    """Returns allocations, used days, and remaining balances per holiday type."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    target_year = year or date.today().year
    types = ["paid_time_off", "sick_leave", "unpaid", "parental"]
    balances = []
    for h_type in types:
        allocated, used, remaining = get_leave_balance(db, employee_id, h_type, target_year)
        balances.append({
            "holiday_type": h_type,
            "year": target_year,
            "allocated_days": float(allocated),
            "used_days": float(used),
            "remaining_days": float(remaining),
        })
    return {"employee_id": employee_id, "year": target_year, "balances": balances}


# ==============================================================================
# 6. LEAVE REQUESTS & APPROVAL WORKFLOW
# ==============================================================================

@router.get("/leave-requests", response_model=List[LeaveRequestResponse], tags=["Leave Requests"])
def list_leave_requests(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    holiday_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(LeaveRequest)
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    if status:
        query = query.filter(LeaveRequest.status == status)
    if holiday_type:
        query = query.filter(LeaveRequest.holiday_type == holiday_type)
    return query.order_by(LeaveRequest.date_from.desc()).offset(skip).limit(limit).all()


@router.post("/leave-requests", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED, tags=["Leave Requests"])
def create_leave_request_endpoint(req_in: LeaveRequestCreate, db: Session = Depends(get_db)):
    """Submits leave request and verifies allocation availability."""
    return submit_leave_request(db, req_in)


@router.get("/leave-requests/{request_id}", response_model=LeaveRequestResponse, tags=["Leave Requests"])
def get_leave_request(request_id: int, db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return req


@router.put("/leave-requests/{request_id}", response_model=LeaveRequestResponse, tags=["Leave Requests"])
def update_leave_request(request_id: int, req_in: LeaveRequestUpdate, db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot edit an already approved leave request directly. Reset to draft first.")
    for field, val in req_in.model_dump(exclude_unset=True).items():
        setattr(req, field, val)
    db.commit()
    db.refresh(req)
    return req


@router.post("/leave-requests/{request_id}/approve", response_model=LeaveActionResponse, tags=["Leave Requests"])
def approve_leave_request_endpoint(request_id: int, db: Session = Depends(get_db)):
    """Approves leave request with atomic allocation deduction."""
    req, remaining = approve_leave_request(db, request_id)
    return LeaveActionResponse(
        message=f"Leave request #{request_id} successfully approved. Remaining allocation: {remaining} days.",
        leave_request=req,
        remaining_allocation_days=float(remaining),
    )


@router.post("/leave-requests/{request_id}/refuse", response_model=LeaveActionResponse, tags=["Leave Requests"])
def refuse_leave_request_endpoint(request_id: int, db: Session = Depends(get_db)):
    """Refuses/rejects a leave request."""
    req = refuse_leave_request(db, request_id)
    return LeaveActionResponse(
        message=f"Leave request #{request_id} was refused.",
        leave_request=req,
    )


@router.post("/leave-requests/{request_id}/reset-to-draft", response_model=LeaveRequestResponse, tags=["Leave Requests"])
def reset_leave_request_to_draft(request_id: int, db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    req.status = "draft"
    db.commit()
    db.refresh(req)
    return req


@router.delete("/leave-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Leave Requests"])
def delete_leave_request(request_id: int, db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    db.delete(req)
    db.commit()
