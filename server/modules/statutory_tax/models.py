from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from server.modules.master_data.database import Base
import server.modules.master_data.models

class TaxDeclaration(Base):
    __tablename__ = 'tax_declarations'

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey('employees.id', ondelete='CASCADE'), nullable=False, index=True)
    financial_year = Column(String(20), nullable=False, default='2024-2025')
    regime = Column(String(20), nullable=False, default='new')  # 'new' | 'old'
    section_80c_amount = Column(Float, default=0.0)
    section_80d_amount = Column(Float, default=0.0)
    hra_rent_paid = Column(Float, default=0.0)
    home_loan_interest = Column(Float, default=0.0)
    proof_documents_json = Column(Text, nullable=True)
    verified_by = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default='draft')  # 'draft', 'submitted', 'verified', 'rejected'
    remarks = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship('Employee', foreign_keys=[employee_id], lazy='joined')
