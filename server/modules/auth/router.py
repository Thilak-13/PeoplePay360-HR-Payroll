import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.modules.master_data.database import get_db, Base, engine
from server.modules.auth.models import User, AuditLog, RegistrationRequest
from server.modules.auth.schemas import (
    LoginRequest,
    UserCreate,
    UserCreate as RegisterRequest,
    UserResponse,
    UserDetailResponse,
    RoleUpdateRequest,
    StatusUpdateRequest,
    TokenResponse,
    ChangePasswordRequest,
    AuditLogResponse,
    SignupRequest,
    RegistrationRequestResponse,
    RejectRequest,
    ApproveRegistrationResponse,
)

from server.modules.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
    require_admin,
    ADMIN_ROLES,
    ROLE_ADMIN,
    ROLE_SUPER_ADMIN,
    ROLE_HR_PAYROLL_MANAGER,
    ROLE_HR_PAYROLL_USER,
    ROLE_HR_MANAGER,
    ROLE_EMPLOYEE,
)

# Ensure auth tables exist
Base.metadata.create_all(bind=engine)

router = APIRouter()


def log_audit(
    db: Session,
    action: str,
    resource: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None
):
    """Helper to record audit trail."""
    try:
        audit = AuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            ip_address=ip_address,
            details_json=json.dumps(details) if details else None,
        )
        db.add(audit)
        db.commit()
    except Exception:
        db.rollback()


@router.get("/ping", tags=["Auth"])
def ping():
    """Health ping for Auth domain."""
    return {"module": "auth_ready"}


@router.post("/login", response_model=TokenResponse, tags=["Auth"])
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user with email and password, returning JWT access token."""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    client_ip = request.client.host if request.client else "unknown"

    if not user or not verify_password(req.password, user.hashed_password):
        log_audit(
            db=db,
            action="LOGIN_FAILED",
            resource="auth",
            user_id=user.id if user else None,
            ip_address=client_ip,
            details={"email": req.email, "reason": "invalid_credentials"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        log_audit(
            db=db,
            action="LOGIN_BLOCKED",
            resource="auth",
            user_id=user.id,
            ip_address=client_ip,
            details={"email": req.email, "reason": "inactive_account"}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact Administrator.",
        )

    # Generate token
    token = create_access_token({
        "sub": str(user.id),
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "employee_id": user.employee_id,
    })

    log_audit(
        db=db,
        action="LOGIN_SUCCESS",
        resource="auth",
        user_id=user.id,
        ip_address=client_ip,
        details={"email": user.email, "role": user.role}
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register(
    req: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new user account."""
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        role=req.role,
        employee_id=req.employee_id,
        is_active=req.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else "unknown"
    log_audit(
        db=db,
        action="USER_REGISTERED",
        resource="auth",
        user_id=user.id,
        ip_address=client_ip,
        details={"email": user.email, "role": user.role}
    )

    return UserResponse.model_validate(user)


ALLOWED_SIGNUP_ROLES = [
    ROLE_EMPLOYEE,
    ROLE_HR_MANAGER,
    ROLE_HR_PAYROLL_USER,
    ROLE_HR_PAYROLL_MANAGER,
    "dept_manager",
    "payroll_officer",
]


@router.post("/signup", response_model=RegistrationRequestResponse, status_code=status.HTTP_201_CREATED, tags=["Auth"])
def signup(
    req: SignupRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public registration request submission.
    Creates a PENDING request stored for Super Admin approval without activating the account.
    """
    clean_email = req.email.lower().strip()
    clean_role = req.requested_role.lower().strip()

    # Reject administrative roles from self-assignment
    if clean_role in ["admin", "super_admin", "superadmin", ROLE_ADMIN, ROLE_SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super Admin and Admin roles cannot be requested through public registration.",
        )

    if clean_role not in ALLOWED_SIGNUP_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid requested role '{req.requested_role}'. Allowed roles: {ALLOWED_SIGNUP_ROLES}",
        )

    # Check if active account already exists
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Check if a pending registration request is already active for this email
    existing_pending = db.query(RegistrationRequest).filter(
        RegistrationRequest.email == clean_email,
        RegistrationRequest.status == "pending"
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A registration request is already pending approval for this email. Please await Super Admin review.",
        )

    # Check for previously rejected requests - if present, create fresh request
    reg = RegistrationRequest(
        full_name=req.full_name.strip(),
        email=clean_email,
        password_hash=hash_password(req.password),
        requested_role=clean_role,
        status="pending",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    client_ip = request.client.host if request.client else "unknown"
    log_audit(
        db=db,
        action="SIGNUP_REQUESTED",
        resource="auth",
        ip_address=client_ip,
        details={"email": clean_email, "full_name": reg.full_name, "requested_role": clean_role}
    )

    return RegistrationRequestResponse.model_validate(reg)



@router.get("/me", response_model=UserResponse, tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/change-password", tags=["Auth"])
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change current user's password."""
    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(req.new_password)
    db.commit()

    log_audit(
        db=db,
        action="PASSWORD_CHANGED",
        resource="auth",
        user_id=current_user.id,
        details={"email": current_user.email}
    )

    return {"status": "success", "message": "Password updated successfully"}


# ==========================================================
# Admin System Administration & User Management
# ==========================================================

@router.get("/users", response_model=List[UserDetailResponse], tags=["User Management"])
def list_users(
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """List all system users with role assignments and linked employee metadata (Admin only)."""
    users = db.query(User).order_by(User.id.asc()).all()
    results = []
    for u in users:
        emp_name = None
        if u.employee:
            emp_name = f"{u.employee.first_name} {u.employee.last_name}"
        data = UserDetailResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            employee_id=u.employee_id,
            is_active=u.is_active,
            created_at=u.created_at,
            updated_at=u.updated_at,
            employee_name=emp_name,
        )
        results.append(data)
    return results


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["User Management"])
def create_user_admin(
    req: UserCreate,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Create a new user with assigned role and linked employee (Admin only)."""
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        role=req.role,
        employee_id=req.employee_id,
        is_active=req.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit(
        db=db,
        action="USER_CREATED_BY_ADMIN",
        resource="user_management",
        user_id=current_user.id,
        details={"created_user_id": user.id, "email": user.email, "role": user.role}
    )
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/role", response_model=UserResponse, tags=["User Management"])
def update_user_role(
    user_id: int,
    req: RoleUpdateRequest,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Update role assignment for a system user (Admin only)."""
    valid_roles = [
        ROLE_ADMIN,
        ROLE_SUPER_ADMIN,
        ROLE_HR_PAYROLL_MANAGER,
        ROLE_HR_PAYROLL_USER,
        ROLE_HR_MANAGER,
        ROLE_EMPLOYEE,
        "payroll_officer",
        "dept_manager",
    ]
    if req.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Valid roles: {valid_roles}",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User #{user_id} not found")

    old_role = target_user.role
    target_user.role = req.role
    db.commit()
    db.refresh(target_user)

    log_audit(
        db=db,
        action="USER_ROLE_UPDATED",
        resource="user_management",
        user_id=current_user.id,
        details={"target_user_id": user_id, "old_role": old_role, "new_role": req.role}
    )
    return UserResponse.model_validate(target_user)


@router.put("/users/{user_id}/status", response_model=UserResponse, tags=["User Management"])
def update_user_status(
    user_id: int,
    req: StatusUpdateRequest,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Activate or deactivate a user account (Admin only)."""
    if target_user := db.query(User).filter(User.id == user_id).first():
        if user_id == current_user.id and not req.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot deactivate their own active account.",
            )
        target_user.is_active = req.is_active
        db.commit()
        db.refresh(target_user)

        log_audit(
            db=db,
            action="USER_STATUS_UPDATED",
            resource="user_management",
            user_id=current_user.id,
            details={"target_user_id": user_id, "is_active": req.is_active}
        )
        return UserResponse.model_validate(target_user)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User #{user_id} not found")


@router.delete("/users/{user_id}", tags=["User Management"])
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Permanently delete a user account (Admin only)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete current active administrator account.",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User #{user_id} not found")

    email = target_user.email
    db.delete(target_user)
    db.commit()

    log_audit(
        db=db,
        action="USER_DELETED",
        resource="user_management",
        user_id=current_user.id,
        details={"deleted_user_id": user_id, "email": email}
    )
    return {"status": "success", "message": f"User #{user_id} ({email}) deleted successfully."}


@router.get("/audit-logs", response_model=List[AuditLogResponse], tags=["Auth"])
def get_audit_logs(
    limit: int = 50,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Fetch system audit trail logs (Admin only)."""
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    return [AuditLogResponse.model_validate(log) for log in logs]


# ==========================================================
# Admin Registration Requests Management (Super Admin only)
# ==========================================================

@router.get("/registration-requests", response_model=List[RegistrationRequestResponse], tags=["User Management"])
def list_registration_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """List pending and historical registration requests (Admin / Super Admin only)."""
    query = db.query(RegistrationRequest)
    if status_filter:
        query = query.filter(RegistrationRequest.status == status_filter.lower().strip())
    requests = query.order_by(RegistrationRequest.created_at.desc()).all()
    return [RegistrationRequestResponse.model_validate(r) for r in requests]


@router.post("/registration-requests/{request_id}/approve", response_model=ApproveRegistrationResponse, tags=["User Management"])
def approve_registration_request(
    request_id: int,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """
    Approve a pending registration request.
    Creates and activates the new User account with requested role and marks request APPROVED (Admin only).
    """
    from datetime import datetime, timezone

    reg = db.query(RegistrationRequest).filter(RegistrationRequest.id == request_id).first()
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registration request #{request_id} not found.",
        )

    if reg.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration request #{request_id} is already {reg.status} and cannot be processed again.",
        )

    # Check if a user with this email already exists
    existing_user = db.query(User).filter(User.email == reg.email).first()
    if existing_user:
        reg.status = "approved"
        reg.reviewed_at = datetime.now(timezone.utc)
        reg.reviewed_by = current_user.id
        db.commit()
        db.refresh(reg)
        return ApproveRegistrationResponse(
            message="Registration request approved. Account with this email was already active.",
            registration_request=RegistrationRequestResponse.model_validate(reg),
            user=UserResponse.model_validate(existing_user),
        )

    # Look up matching employee by email if present
    from server.modules.master_data.models import Employee
    matching_emp = db.query(Employee).filter(Employee.email == reg.email).first()
    emp_id = matching_emp.id if matching_emp else None

    # Create new active User account
    new_user = User(
        email=reg.email,
        hashed_password=reg.password_hash,
        role=reg.requested_role,
        employee_id=emp_id,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Update registration request status
    reg.status = "approved"
    reg.reviewed_at = datetime.now(timezone.utc)
    reg.reviewed_by = current_user.id
    db.commit()
    db.refresh(reg)
    db.refresh(new_user)

    log_audit(
        db=db,
        action="REGISTRATION_APPROVED",
        resource="user_management",
        user_id=current_user.id,
        details={
            "registration_id": reg.id,
            "approved_email": reg.email,
            "role": reg.requested_role,
            "created_user_id": new_user.id,
        }
    )

    return ApproveRegistrationResponse(
        message="Registration request approved successfully. User account activated.",
        registration_request=RegistrationRequestResponse.model_validate(reg),
        user=UserResponse.model_validate(new_user),
    )


@router.post("/registration-requests/{request_id}/reject", response_model=RegistrationRequestResponse, tags=["User Management"])
def reject_registration_request(
    request_id: int,
    req_body: Optional[RejectRequest] = None,
    current_user: User = Depends(require_role(ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """
    Reject a pending registration request (Admin only).
    """
    from datetime import datetime, timezone

    reg = db.query(RegistrationRequest).filter(RegistrationRequest.id == request_id).first()
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registration request #{request_id} not found.",
        )

    if reg.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration request #{request_id} is already {reg.status} and cannot be rejected.",
        )

    reason = req_body.rejection_reason if req_body else None
    reg.status = "rejected"
    reg.reviewed_at = datetime.now(timezone.utc)
    reg.reviewed_by = current_user.id
    reg.rejection_reason = reason
    db.commit()
    db.refresh(reg)

    log_audit(
        db=db,
        action="REGISTRATION_REJECTED",
        resource="user_management",
        user_id=current_user.id,
        details={
            "registration_id": reg.id,
            "rejected_email": reg.email,
            "rejection_reason": reason,
        }
    )

    return RegistrationRequestResponse.model_validate(reg)



def ensure_baseline_entities(db: Session):
    """Ensure baseline departments, schedules, employees (1-5), contracts, and leave allocations exist."""
    from datetime import date, datetime, timezone, timedelta
    from server.modules.master_data.models import Department, WorkingSchedule, Employee, Contract, LeaveAllocation
    from server.modules.attendance.models import AttendanceRecord

    # 1. Ensure Engineering & HR departments
    dept_eng = db.query(Department).filter(Department.id == 1).first()
    if not dept_eng:
        dept_eng = Department(id=1, name="Engineering", code="ENG")
        db.add(dept_eng)
        db.commit()

    dept_hr = db.query(Department).filter(Department.id == 3).first()
    if not dept_hr:
        dept_hr = Department(id=3, name="Human Resources", code="HR")
        db.add(dept_hr)
        db.commit()

    # 2. Ensure Working Schedule
    sched = db.query(WorkingSchedule).filter(WorkingSchedule.id == 1).first()
    if not sched:
        sched = WorkingSchedule(id=1, name="Standard 40h", hours_per_week=40.0)
        db.add(sched)
        db.commit()

    # 3. Baseline Employees (1 to 5)
    baseline_employees = [
        (1, "Aditya", "Raman", "aditya.raman@peoplepay360.com", "+91-98401-23456", 1, "Principal Architect & Admin"),
        (2, "Priya", "Sundaram", "priya.sundaram@peoplepay360.com", "+91-98412-34567", 3, "HR Director"),
        (3, "Karthik", "Subramanian", "karthik.subramanian@peoplepay360.com", "+91-94440-12345", 1, "Payroll Specialist"),
        (4, "Thilak", "I", "thilak@peoplepay360.com", "+91-98840-56789", 1, "Payroll Operations Director"),
        (5, "Ananya", "Krishnan", "ananya.krishnan@peoplepay360.com", "+91-97909-12345", 1, "Software Engineer"),
    ]

    for emp_id, fname, lname, email, phone, d_id, title in baseline_employees:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            emp = Employee(
                id=emp_id,
                first_name=fname,
                last_name=lname,
                email=email,
                phone=phone,
                department_id=d_id,
                working_schedule_id=1,
                job_title=title,
                status="active",
                hire_date=date(2025, 1, 1),
            )
            db.add(emp)
        else:
            emp.first_name = fname
            emp.last_name = lname
            emp.email = email
            emp.phone = phone
            emp.job_title = title
    db.commit()

    # 4. Contracts for Employees 1..5
    contracts_map = {1: 200000.00, 2: 220000.00, 3: 75000.00, 4: 220000.00, 5: 85000.00}
    for emp_id, wage in contracts_map.items():
        c = db.query(Contract).filter(Contract.employee_id == emp_id, Contract.status == "active").first()
        if not c:
            new_c = Contract(
                employee_id=emp_id,
                wage=wage,
                contract_type="full_time",
                start_date=date(2025, 1, 1),
                status="active",
            )
            db.add(new_c)

    # 5. Leave Allocations for Employees 1..5
    curr_year = date.today().year
    for emp_id in range(1, 6):
        for h_type, days in [("paid_time_off", 24.0), ("sick_leave", 12.0)]:
            la = db.query(LeaveAllocation).filter(
                LeaveAllocation.employee_id == emp_id,
                LeaveAllocation.holiday_type == h_type,
                LeaveAllocation.year == curr_year,
            ).first()
            if not la:
                new_la = LeaveAllocation(
                    employee_id=emp_id,
                    holiday_type=h_type,
                    number_of_days=days,
                    year=curr_year,
                    status="approved",
                )
                db.add(new_la)

    # 6. Baseline Attendance for Employee 5
    att_exists = db.query(AttendanceRecord).filter(AttendanceRecord.employee_id == 5).first()
    if not att_exists:
        today = date.today()
        yest = today - timedelta(days=1)
        rec1 = AttendanceRecord(
            employee_id=5,
            date=yest,
            clock_in=datetime.combine(yest, datetime.min.time(), tzinfo=timezone.utc).replace(hour=9, minute=0),
            clock_out=datetime.combine(yest, datetime.min.time(), tzinfo=timezone.utc).replace(hour=17, minute=30),
            worked_hours=8.5,
            overtime_hours=0.5,
            status="present",
            notes="Standard workday",
        )
        rec2 = AttendanceRecord(
            employee_id=5,
            date=today,
            clock_in=datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=9, minute=0),
            clock_out=None,
            worked_hours=0.0,
            overtime_hours=0.0,
            status="present",
            notes="Clocked in",
        )
        db.add(rec1)
        db.add(rec2)

    db.commit()


@router.post("/seed-default-users", tags=["Auth"])
def seed_default_users(db: Session = Depends(get_db)):
    """Seed baseline demo accounts for the 5 system roles with verified credentials and backing employee data."""
    # Ensure baseline employee models exist first
    ensure_baseline_entities(db)

    demo_users = [
        ("admin@peoplepay360.com", "Admin@123", ROLE_ADMIN, 1),
        ("superadmin@peoplepay360.com", "Admin@123", ROLE_SUPER_ADMIN, 1),
        ("hr@peoplepay360.com", "Hr@12345", ROLE_HR_MANAGER, 2),
        ("hrmanager@peoplepay360.com", "Hr@12345", ROLE_HR_MANAGER, 2),
        ("payrolluser@peoplepay360.com", "PayrollUser@123", ROLE_HR_PAYROLL_USER, 3),
        ("payroll@peoplepay360.com", "Payroll@123", ROLE_HR_PAYROLL_USER, 3),
        ("payrollmanager@peoplepay360.com", "PayrollMgr@123", ROLE_HR_PAYROLL_MANAGER, 4),
        ("employee@peoplepay360.com", "Employee@123", ROLE_EMPLOYEE, 5),
    ]
    created = []
    for email, pwd, role, emp_id in demo_users:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            u = User(
                email=email,
                hashed_password=hash_password(pwd),
                role=role,
                employee_id=emp_id,
                is_active=True
            )
            db.add(u)
            created.append(f"{email} ({role})")
        else:
            existing.hashed_password = hash_password(pwd)
            existing.role = role
            existing.employee_id = emp_id
            existing.is_active = True
            created.append(f"{email} ({role} - synced)")
    db.commit()
    return {"status": "seeded", "created_users": created}

