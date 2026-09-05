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
    # Optional guard: only super_admin/hr_manager can register, unless it is first system user
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


@router.get("/audit-logs", response_model=List[AuditLogResponse], tags=["Auth"])
def get_audit_logs(
    limit: int = 50,
    current_user: User = Depends(require_role(["super_admin", "hr_manager", "payroll_officer"])),
    db: Session = Depends(get_db),
):
    """Fetch system audit trail logs (Admin/HR/Payroll only)."""
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.post("/seed-default-users", tags=["Auth"])
def seed_default_users(db: Session = Depends(get_db)):
    """Seed baseline demo accounts for testing each system role."""
    demo_users = [
        ("admin@peoplepay360.com", "Admin@123", "super_admin", 1),
        ("hr@peoplepay360.com", "Hr@12345", "hr_manager", 2),
        ("payroll@peoplepay360.com", "Payroll@123", "payroll_officer", 3),
        ("manager@peoplepay360.com", "Manager@123", "dept_manager", 4),
        ("employee@peoplepay360.com", "Employee@123", "employee", 5),
    ]
    created = []
    for email, pwd, role, emp_id in demo_users:
        if not db.query(User).filter(User.email == email).first():
            u = User(
                email=email,
                hashed_password=hash_password(pwd),
                role=role,
                employee_id=emp_id,
                is_active=True
            )
            db.add(u)
            created.append(email)
    db.commit()
    return {"status": "seeded", "created_users": created}
