import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.auth.models
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
        "role": "super_admin",
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

