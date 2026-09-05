import os
import hmac
import hashlib
import json
import base64
import time
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from server.modules.master_data.database import get_db

# Security Config
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "peoplepay360_enterprise_super_secret_jwt_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password using PBKDF2 HMAC SHA-256 with salt."""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}${key}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored salt."""
    try:
        if "$" not in hashed_password:
            return False
        salt, key = hashed_password.split("$", 1)
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
    """Generate a standard signed JWT (HS256)."""
    to_encode = data.copy()
    expire_time = int(time.time()) + (expires_delta or (ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    to_encode.update({"exp": expire_time, "iat": int(time.time())})

    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(to_encode).encode('utf-8'))

    signature_raw = hmac.new(
        SECRET_KEY.encode('utf-8'),
        f"{header_b64}.{payload_b64}".encode('utf-8'),
        hashlib.sha256
    ).digest()
    signature_b64 = _base64url_encode(signature_raw)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and verify a signed JWT (HS256)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        header_b64, payload_b64, signature_b64 = parts

        expected_sig = hmac.new(
            SECRET_KEY.encode('utf-8'),
            f"{header_b64}.{payload_b64}".encode('utf-8'),
            hashlib.sha256
        ).digest()
        expected_sig_b64 = _base64url_encode(expected_sig)

        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            raise ValueError("Invalid signature")

        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))

        if "exp" in payload and time.time() > payload["exp"]:
            raise ValueError("Token expired")

        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
):
    """FastAPI dependency to extract and validate the authenticated User."""
    from server.modules.auth.models import User

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return user


def require_role(allowed_roles: List[str]):
    """FastAPI dependency factory enforcing RBAC roles."""
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles and current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {allowed_roles}. Current role: {current_user.role}",
            )
        return current_user
    return role_checker
