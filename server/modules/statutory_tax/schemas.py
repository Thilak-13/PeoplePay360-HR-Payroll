from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class TaxDeclarationCreate(BaseModel):
    employee_id: int
    financial_year: str = '2024-2025'
    regime: str = 'new'
    section_80c_amount: float = 0.0
    section_80d_amount: float = 0.0
    hra_rent_paid: float = 0.0
    home_loan_interest: float = 0.0
    proof_documents_json: Optional[str] = None
    remarks: Optional[str] = None

class TaxDeclarationVerify(BaseModel):
    status: str  # 'verified' or 'rejected'
    verified_by: Optional[int] = None
    remarks: Optional[str] = None

class TaxDeclarationResponse(BaseModel):
    id: int
    employee_id: int
    financial_year: str
    regime: str
    section_80c_amount: float
    section_80d_amount: float
    hra_rent_paid: float
    home_loan_interest: float
    proof_documents_json: Optional[str] = None
    verified_by: Optional[int] = None
    status: str
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class TDSCalculationRequest(BaseModel):
    annual_gross: float
    regime: Optional[str] = 'new'
    section_80c_amount: float = 0.0
    section_80d_amount: float = 0.0
    hra_rent_paid: float = 0.0
    home_loan_interest: float = 0.0
