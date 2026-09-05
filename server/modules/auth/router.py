import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from server.modules.master_data.database import get_db, Base, engine
from server.modules.auth.models import User, AuditLog
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


@router.post("/seed-default-users", tags=["Auth"])
def seed_default_users(db: Session = Depends(get_db)):
    """Seed baseline demo accounts for the 5 system roles with verified credentials."""
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
