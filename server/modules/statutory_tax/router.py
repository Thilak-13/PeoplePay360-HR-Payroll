from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from server.modules.master_data.database import get_db
import server.modules.master_data.models
from server.modules.statutory_tax.models import TaxDeclaration
from server.modules.statutory_tax.schemas import (
    TaxDeclarationCreate,
    TaxDeclarationVerify,
    TaxDeclarationResponse,
    TDSCalculationRequest
)
from server.modules.statutory_tax.tax_engine import calculate_new_regime_tax, calculate_old_regime_tax, compare_regimes

router = APIRouter()

@router.get('/ping', tags=['Statutory Tax'])
def ping():
    return {'module': 'statutory_tax_ready'}

@router.post('/declaration/submit', response_model=TaxDeclarationResponse, status_code=201)
def submit_tax_declaration(payload: TaxDeclarationCreate, db: Session = Depends(get_db)):
    existing = db.query(TaxDeclaration).filter(
        TaxDeclaration.employee_id == payload.employee_id,
        TaxDeclaration.financial_year == payload.financial_year
    ).first()

    if existing:
        existing.regime = payload.regime
        existing.section_80c_amount = payload.section_80c_amount
        existing.section_80d_amount = payload.section_80d_amount
        existing.hra_rent_paid = payload.hra_rent_paid
        existing.home_loan_interest = payload.home_loan_interest
        existing.proof_documents_json = payload.proof_documents_json
        existing.status = 'submitted'
        existing.remarks = payload.remarks
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    new_decl = TaxDeclaration(
        employee_id=payload.employee_id,
        financial_year=payload.financial_year,
        regime=payload.regime,
        section_80c_amount=payload.section_80c_amount,
        section_80d_amount=payload.section_80d_amount,
        hra_rent_paid=payload.hra_rent_paid,
        home_loan_interest=payload.home_loan_interest,
        proof_documents_json=payload.proof_documents_json,
        status='submitted',
        remarks=payload.remarks
    )
    db.add(new_decl)
    db.commit()
    db.refresh(new_decl)
    return new_decl

@router.get('/declaration/{employee_id}', response_model=Optional[TaxDeclarationResponse])
def get_tax_declaration(
    employee_id: int,
    financial_year: str = Query('2024-2025'),
    db: Session = Depends(get_db)
):
    decl = db.query(TaxDeclaration).filter(
        TaxDeclaration.employee_id == employee_id,
        TaxDeclaration.financial_year == financial_year
    ).first()
    if not decl:
        raise HTTPException(status_code=404, detail='Tax declaration not found')
    return decl

@router.get('/declarations', response_model=List[TaxDeclarationResponse])
def list_tax_declarations(
    status: Optional[str] = None,
    financial_year: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TaxDeclaration)
    if status:
        query = query.filter(TaxDeclaration.status == status)
    if financial_year:
        query = query.filter(TaxDeclaration.financial_year == financial_year)
    return query.order_by(TaxDeclaration.id.desc()).all()

@router.post('/declaration/{id}/verify', response_model=TaxDeclarationResponse)
def verify_tax_declaration(id: int, payload: TaxDeclarationVerify, db: Session = Depends(get_db)):
    decl = db.query(TaxDeclaration).filter(TaxDeclaration.id == id).first()
    if not decl:
        raise HTTPException(status_code=404, detail='Tax declaration not found')

    if payload.status not in ['verified', 'rejected']:
        raise HTTPException(status_code=400, detail='Invalid status for verification')

    decl.status = payload.status
    decl.verified_by = payload.verified_by
    if payload.remarks:
        decl.remarks = payload.remarks
    decl.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(decl)
    return decl

@router.post('/calculate-tds')
def calculate_tds(payload: TDSCalculationRequest):
    return compare_regimes(
        annual_gross=payload.annual_gross,
        sec_80c=payload.section_80c_amount,
        sec_80d=payload.section_80d_amount,
        hra_rent=payload.hra_rent_paid,
        home_loan_int=payload.home_loan_interest
    )
