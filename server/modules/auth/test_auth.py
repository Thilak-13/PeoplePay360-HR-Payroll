import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.payroll.models
import server.modules.auth.models
import server.modules.attendance.models
from server.modules.auth.security import hash_password, verify_password, create_access_token, decode_access_token
from fastapi import FastAPI
from server.modules.auth.router import router as auth_router

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_password_hashing():
    pwd = "SecurePassword123!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_generation_and_decoding():
    payload = {"user_id": 42, "role": "hr_manager", "email": "test@peoplepay360.com"}
    token = create_access_token(payload)
    assert token is not None

    decoded = decode_access_token(token)
    assert decoded["user_id"] == 42
    assert decoded["role"] == "hr_manager"
    assert decoded["email"] == "test@peoplepay360.com"


def test_auth_ping():
    res = client.get("/api/v1/auth/ping")
    assert res.status_code == 200
    assert res.json() == {"module": "auth_ready"}


def test_auth_registration_and_login_flow():
    # 1. Register new user
    reg_payload = {
        "email": "janedoe@peoplepay360.com",
        "password": "Password123!",
        "role": "hr_manager",
        "is_active": True
    }
    res_reg = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201
    user_data = res_reg.json()
    assert user_data["email"] == "janedoe@peoplepay360.com"
    assert user_data["role"] == "hr_manager"

    # 2. Login with valid credentials
    login_payload = {
        "email": "janedoe@peoplepay360.com",
        "password": "Password123!"
    }
    res_login = client.post("/api/v1/auth/login", json=login_payload)
    assert res_login.status_code == 200
    token_data = res_login.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 3. Access protected /me endpoint with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/v1/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "janedoe@peoplepay360.com"

    # 4. Attempt login with invalid password -> 401
    bad_login = {
        "email": "janedoe@peoplepay360.com",
        "password": "WrongPassword!"
    }
    res_bad = client.post("/api/v1/auth/login", json=bad_login)
    assert res_bad.status_code == 401


def test_role_guard_and_audit_logs():
    # 1. Register employee user
    client.post("/api/v1/auth/register", json={
        "email": "emp@peoplepay360.com",
        "password": "Password123!",
        "role": "employee",
        "is_active": True
    })
    res_login_emp = client.post("/api/v1/auth/login", json={
        "email": "emp@peoplepay360.com",
        "password": "Password123!"
    })
    emp_token = res_login_emp.json()["access_token"]

    # Employee tries to access /audit-logs -> 403 Forbidden
    res_emp_audit = client.get("/api/v1/auth/audit-logs", headers={"Authorization": f"Bearer {emp_token}"})
    assert res_emp_audit.status_code == 403

    # 2. Register admin user
    client.post("/api/v1/auth/register", json={
        "email": "admin_audit@peoplepay360.com",
        "password": "Password123!",
        "role": "admin",
        "is_active": True
    })
    res_login_admin = client.post("/api/v1/auth/login", json={
        "email": "admin_audit@peoplepay360.com",
        "password": "Password123!"
    })
    admin_token = res_login_admin.json()["access_token"]

    # Admin accesses /audit-logs -> 200 OK with logged actions
    res_admin_audit = client.get("/api/v1/auth/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin_audit.status_code == 200
    logs = res_admin_audit.json()
    assert len(logs) > 0


def test_public_signup_pending_flow():
    signup_payload = {
        "full_name": "Alice Wonderland",
        "email": "alice@peoplepay360.com",
        "password": "SecretPassword123!",
        "requested_role": "employee"
    }
    res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "alice@peoplepay360.com"
    assert data["full_name"] == "Alice Wonderland"
    assert data["requested_role"] == "employee"
    assert data["status"] == "pending"
    assert "password" not in data
    assert "password_hash" not in data

    # Alice cannot log in yet
    login_res = client.post("/api/v1/auth/login", json={
        "email": "alice@peoplepay360.com",
        "password": "SecretPassword123!"
    })
    assert login_res.status_code == 401


def test_public_signup_role_restriction():
    bad_payload = {
        "full_name": "Hacker Admin",
        "email": "hacker@peoplepay360.com",
        "password": "SecretPassword123!",
        "requested_role": "admin"
    }
    res = client.post("/api/v1/auth/signup", json=bad_payload)
    assert res.status_code == 400
    assert "Super Admin and Admin roles cannot be requested" in res.json()["detail"]


def test_duplicate_signup_and_existing_user_handling():
    payload = {
        "full_name": "Bob Builder",
        "email": "bob@peoplepay360.com",
        "password": "SecretPassword123!",
        "requested_role": "hr_payroll_user"
    }
    res1 = client.post("/api/v1/auth/signup", json=payload)
    assert res1.status_code == 201

    # Duplicate submission with pending status -> 400
    res2 = client.post("/api/v1/auth/signup", json=payload)
    assert res2.status_code == 400
    assert "already pending approval" in res2.json()["detail"]


def test_admin_approval_and_login_lifecycle():
    # 1. Ensure admin exists
    client.post("/api/v1/auth/register", json={
        "email": "superadmin@peoplepay360.com",
        "password": "AdminPassword123!",
        "role": "admin",
        "is_active": True
    })
    admin_login = client.post("/api/v1/auth/login", json={
        "email": "superadmin@peoplepay360.com",
        "password": "AdminPassword123!"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Charlie signs up
    signup_payload = {
        "full_name": "Charlie Chaplin",
        "email": "charlie@peoplepay360.com",
        "password": "CharliePassword123!",
        "requested_role": "hr_manager"
    }
    signup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201
    req_id = signup_res.json()["id"]

    # 3. Employee cannot view registration requests (403)
    emp_login = client.post("/api/v1/auth/login", json={
        "email": "emp@peoplepay360.com",
        "password": "Password123!"
    })
    emp_token = emp_login.json()["access_token"]
    emp_res = client.get("/api/v1/auth/registration-requests", headers={"Authorization": f"Bearer {emp_token}"})
    assert emp_res.status_code == 403

    # 4. Admin lists requests and sees Charlie
    list_res = client.get("/api/v1/auth/registration-requests?status_filter=pending", headers=admin_headers)
    assert list_res.status_code == 200
    pending_list = list_res.json()
    assert any(r["id"] == req_id for r in pending_list)

    # 5. Admin approves Charlie's request
    approve_res = client.post(f"/api/v1/auth/registration-requests/{req_id}/approve", headers=admin_headers)
    assert approve_res.status_code == 200
    approve_data = approve_res.json()
    assert approve_data["registration_request"]["status"] == "approved"
    assert approve_data["user"]["email"] == "charlie@peoplepay360.com"
    assert approve_data["user"]["role"] == "hr_manager"

    # 6. Charlie can now log in successfully!
    charlie_login = client.post("/api/v1/auth/login", json={
        "email": "charlie@peoplepay360.com",
        "password": "CharliePassword123!"
    })
    assert charlie_login.status_code == 200
    assert "access_token" in charlie_login.json()
    assert charlie_login.json()["user"]["role"] == "hr_manager"

    # 7. Approving again is blocked (400)
    re_approve = client.post(f"/api/v1/auth/registration-requests/{req_id}/approve", headers=admin_headers)
    assert re_approve.status_code == 400


def test_admin_rejection_flow():
    admin_login = client.post("/api/v1/auth/login", json={
        "email": "superadmin@peoplepay360.com",
        "password": "AdminPassword123!"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Dan signs up
    signup_payload = {
        "full_name": "Dan Defoe",
        "email": "dan@peoplepay360.com",
        "password": "DanPassword123!",
        "requested_role": "employee"
    }
    signup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    req_id = signup_res.json()["id"]

    # Admin rejects
    reject_res = client.post(
        f"/api/v1/auth/registration-requests/{req_id}/reject",
        json={"rejection_reason": "Company domain required"},
        headers=admin_headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert reject_res.json()["rejection_reason"] == "Company domain required"

    # Dan cannot log in
    dan_login = client.post("/api/v1/auth/login", json={
        "email": "dan@peoplepay360.com",
        "password": "DanPassword123!"
    })
    assert dan_login.status_code == 401


# ==========================================================
# SUPER ADMIN SECURITY VERIFICATION SUITE
# ==========================================================
from server.modules.auth.router import ensure_super_admin_integrity, seed_default_users
from server.modules.auth.models import User, RegistrationRequest
from server.modules.auth.security import SUPER_ADMIN_EMAIL, ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_EMPLOYEE


def test_super_admin_vishaal_login_and_privileges():
    """1 & 2: vishaal.m12@gmail.com can log in and access Super Admin endpoints."""
    db = TestingSessionLocal()
    seed_default_users(db)
    db.close()

    # 1. Login with vishaal.m12@gmail.com
    res = client.post("/api/v1/auth/login", json={
        "email": "vishaal.m12@gmail.com",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == "vishaal.m12@gmail.com"
    assert data["user"]["role"] == "super_admin"
    sa_token = data["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # Case-insensitive login verification
    res_case = client.post("/api/v1/auth/login", json={
        "email": "  ViShaal.M12@Gmail.Com  ",
        "password": "Admin@123"
    })
    assert res_case.status_code == 200

    # 2. Access Super Admin verification endpoint
    res_verify = client.get("/api/v1/auth/super-admin-verify", headers=sa_headers)
    assert res_verify.status_code == 200
    assert res_verify.json()["is_super_admin"] is True

    # Access administrative endpoints
    res_users = client.get("/api/v1/auth/users", headers=sa_headers)
    assert res_users.status_code == 200
    res_audit = client.get("/api/v1/auth/audit-logs", headers=sa_headers)
    assert res_audit.status_code == 200


def test_normal_user_receives_403_for_super_admin_endpoints():
    """5 & 6: Normal users receive 403 Forbidden when attempting Super Admin operations."""
    db = TestingSessionLocal()
    seed_default_users(db)
    db.close()

    emp_login = client.post("/api/v1/auth/login", json={
        "email": "employee@peoplepay360.com",
        "password": "Employee@123"
    })
    assert emp_login.status_code == 200
    emp_token = emp_login.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Access Super Admin endpoint -> 403
    res_verify = client.get("/api/v1/auth/super-admin-verify", headers=emp_headers)
    assert res_verify.status_code == 403

    # Access Users endpoint -> 403
    res_users = client.get("/api/v1/auth/users", headers=emp_headers)
    assert res_users.status_code == 403


def test_normal_admin_cannot_access_super_admin_exclusive_endpoints():
    """Normal admin can access admin endpoints but is forbidden from Super Admin-only endpoints."""
    db = TestingSessionLocal()
    seed_default_users(db)
    db.close()

    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Admin@123"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Normal admin CAN access regular admin endpoints
    res_users = client.get("/api/v1/auth/users", headers=admin_headers)
    assert res_users.status_code == 200

    # Normal admin CANNOT access Super Admin exclusive endpoint
    res_verify = client.get("/api/v1/auth/super-admin-verify", headers=admin_headers)
    assert res_verify.status_code == 403


def test_token_with_super_admin_role_but_different_email_is_forbidden():
    """Non-authorized email with forged/database super_admin role is rejected with 403."""
    db = TestingSessionLocal()
    # Create user with super_admin role but not vishaal's email
    fake_sa = db.query(User).filter(User.email == "impostor@example.com").first()
    if not fake_sa:
        fake_sa = User(
            email="impostor@example.com",
            hashed_password=hash_password("Pass@123"),
            role=ROLE_SUPER_ADMIN,
            is_active=True
        )
        db.add(fake_sa)
        db.commit()
    db.close()

    login_res = client.post("/api/v1/auth/login", json={
        "email": "impostor@example.com",
        "password": "Pass@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Server-side verification strictly rejects impostor
    res = client.get("/api/v1/auth/super-admin-verify", headers=headers)
    assert res.status_code == 403


def test_public_signup_rejects_all_super_admin_variations():
    """7 & 8: Signup cannot select SUPER_ADMIN and API rejects malicious payloads."""
    variations = ["super_admin", "SUPER_ADMIN", "Super_Admin", "superadmin", "SUPERADMIN", "admin", "ADMIN"]
    for role_variant in variations:
        payload = {
            "full_name": "Attacker",
            "email": f"attacker_{role_variant.lower()}@example.com",
            "password": "Password123!",
            "requested_role": role_variant
        }
        res = client.post("/api/v1/auth/signup", json=payload)
        assert res.status_code == 400
        assert "Super Admin and Admin roles cannot be requested" in res.json()["detail"]


def test_user_creation_and_registration_rejects_super_admin_for_other_accounts():
    """Any other account cannot obtain SUPER_ADMIN via register or user creation."""
    # 1. Direct register endpoint
    res_reg = client.post("/api/v1/auth/register", json={
        "email": "attacker@example.com",
        "password": "Password123!",
        "role": "SUPER_ADMIN",
        "is_active": True
    })
    assert res_reg.status_code == 400
    assert "Super Admin role cannot be assigned" in res_reg.json()["detail"]

    # 2. Admin user creation endpoint
    db = TestingSessionLocal()
    seed_default_users(db)
    db.close()

    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_create = client.post("/api/v1/auth/users", json={
        "email": "attacker2@example.com",
        "password": "Password123!",
        "role": "super_admin",
        "is_active": True
    }, headers=admin_headers)
    assert res_create.status_code == 400
    assert "Super Admin role cannot be assigned to another email" in res_create.json()["detail"]


def test_role_update_prevents_super_admin_assignment():
    """9 & 10: Normal user cannot self-promote and admin cannot promote another user to SUPER_ADMIN."""
    db = TestingSessionLocal()
    seed_default_users(db)
    emp = db.query(User).filter(User.email == "employee@peoplepay360.com").first()
    emp_id = emp.id
    db.close()

    # 1. Normal user attempts to update own role -> 403
    emp_login = client.post("/api/v1/auth/login", json={
        "email": "employee@peoplepay360.com",
        "password": "Employee@123"
    })
    emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}"}

    res_self = client.put(f"/api/v1/auth/users/{emp_id}/role", json={"role": "super_admin"}, headers=emp_headers)
    assert res_self.status_code == 403

    # 2. Admin attempts to promote employee to super_admin -> 400 rejected
    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Admin@123"
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    res_promote = client.put(f"/api/v1/auth/users/{emp_id}/role", json={"role": "super_admin"}, headers=admin_headers)
    assert res_promote.status_code == 400
    assert "Super Admin role cannot be assigned to another email" in res_promote.json()["detail"]


def test_registration_approval_rejects_super_admin_role():
    """Registration approval must only approve valid non-SUPER_ADMIN roles."""
    db = TestingSessionLocal()
    seed_default_users(db)
    # Manually insert a forged pending registration with requested_role='super_admin'
    forged_req = RegistrationRequest(
        full_name="Malicious Applicant",
        email="forged@example.com",
        password_hash=hash_password("Pass@123"),
        requested_role="super_admin",
        status="pending"
    )
    db.add(forged_req)
    db.commit()
    db.refresh(forged_req)
    req_id = forged_req.id
    db.close()

    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Admin@123"
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    res_approve = client.post(f"/api/v1/auth/registration-requests/{req_id}/approve", headers=admin_headers)
    assert res_approve.status_code == 400
    assert "Cannot approve registration request with role" in res_approve.json()["detail"]


def test_safely_downgrades_existing_unauthorized_super_admin():
    """11: Any existing non-authorized SUPER_ADMIN accounts are safely downgraded to admin."""
    db = TestingSessionLocal()
    # Create an unauthorized super_admin
    unauth = db.query(User).filter(User.email == "legacy_superadmin@peoplepay360.com").first()
    if not unauth:
        unauth = User(
            email="legacy_superadmin@peoplepay360.com",
            hashed_password=hash_password("Admin@123"),
            role="super_admin",
            is_active=True
        )
        db.add(unauth)
        db.commit()
    else:
        unauth.role = "super_admin"
        db.commit()

    # Run integrity check
    ensure_super_admin_integrity(db)

    # Check that legacy user was safely downgraded to admin
    refreshed_unauth = db.query(User).filter(User.email == "legacy_superadmin@peoplepay360.com").first()
    assert refreshed_unauth.role == "admin"

    # Check that vishaal.m12@gmail.com is super_admin
    sa = db.query(User).filter(User.email == "vishaal.m12@gmail.com").first()
    assert sa is not None
    assert sa.role == "super_admin"
    db.close()


def test_demo_accounts_retain_roles_and_can_log_in():
    """3, 4, 12, 13, 14: Existing demo accounts continue working and retain expected roles."""
    db = TestingSessionLocal()
    seed_default_users(db)
    db.close()

    demo_checks = [
        ("admin@peoplepay360.com", "Admin@123", "admin"),
        ("hr@peoplepay360.com", "Hr@12345", "hr_manager"),
        ("payrolluser@peoplepay360.com", "PayrollUser@123", "hr_payroll_user"),
        ("payrollmanager@peoplepay360.com", "PayrollMgr@123", "hr_payroll_manager"),
        ("employee@peoplepay360.com", "Employee@123", "employee"),
        ("superadmin@peoplepay360.com", "Admin@123", "admin"),  # safely downgraded to admin
        ("vishaal.m12@gmail.com", "Admin@123", "super_admin"),  # sole super admin
    ]

    for email, pwd, expected_role in demo_checks:
        res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        assert res.status_code == 200, f"Login failed for {email}"
        data = res.json()
        assert data["user"]["role"] == expected_role, f"Role mismatch for {email}: expected {expected_role}, got {data['user']['role']}"
        assert data["user"]["is_active"] is True


def test_super_admin_cannot_be_deleted_or_deactivated():
    """Super Admin account is protected from accidental deletion or deactivation."""
    db = TestingSessionLocal()
    seed_default_users(db)
    sa = db.query(User).filter(User.email == "vishaal.m12@gmail.com").first()
    sa_id = sa.id
    db.close()

    admin_login = client.post("/api/v1/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Admin@123"
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Attempt delete
    res_del = client.delete(f"/api/v1/auth/users/{sa_id}", headers=admin_headers)
    assert res_del.status_code == 400
    assert "Super Admin account cannot be deleted" in res_del.json()["detail"]

    # Attempt deactivate
    res_deact = client.put(f"/api/v1/auth/users/{sa_id}/status", json={"is_active": False}, headers=admin_headers)
    assert res_deact.status_code == 400
    assert "Super Admin account cannot be deactivated" in res_deact.json()["detail"]


