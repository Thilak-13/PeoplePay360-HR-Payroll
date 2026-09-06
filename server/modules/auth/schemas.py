from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    role: str = Field(default="employee", description="Role: super_admin, hr_manager, payroll_officer, dept_manager, employee")
    employee_id: Optional[int] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6, description="Plaintext password")


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class UserDetailResponse(UserResponse):
    employee_name: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str = Field(description="Role: admin, super_admin, hr_manager, hr_payroll_user, hr_payroll_manager, employee")


class StatusUpdateRequest(BaseModel):
    is_active: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    action: str
    resource: str
    ip_address: Optional[str]
    details_json: Optional[str]
    timestamp: datetime


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, description="Plaintext password")
    requested_role: str = Field(default="employee", description="Role: employee, hr_manager, hr_payroll_user, hr_payroll_manager")


class RegistrationRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    requested_role: str
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None


class RejectRequest(BaseModel):
    rejection_reason: Optional[str] = None


class ApproveRegistrationResponse(BaseModel):
    message: str
    registration_request: RegistrationRequestResponse
    user: UserResponse

