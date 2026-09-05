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

test_app = FastAPI()
test_app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])

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


test_app.dependency_overrides[get_db] = override_get_db
client = TestClient(test_app)


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
