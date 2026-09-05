import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.statutory_tax.models
from server.modules.master_data.models import Employee
from server.modules.statutory_tax.models import TaxDeclaration
from server.modules.statutory_tax.router import router as tax_router
from server.modules.statutory_tax.tax_engine import (
    calculate_new_regime_tax,
    calculate_old_regime_tax,
    compare_regimes
)

test_app = FastAPI()
test_app.include_router(tax_router, prefix='/api/v1/tax', tags=['Statutory Tax'])

TEST_DB_URL = 'sqlite:///:memory:'
engine = create_engine(
    TEST_DB_URL,
    connect_args={'check_same_thread': False},
    poolclass=StaticPool
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

@pytest.fixture(autouse=True)
def seed_test_employees():
    db = TestingSessionLocal()
    if not db.query(Employee).filter(Employee.id == 501).first():
        emp = Employee(
            id=501,
            first_name='Clark',
            last_name='Kent',
            email='clark.kent@peoplepay360.com',
            phone='7777777777',
            status='active'
        )
        db.add(emp)
        db.commit()
    db.close()

def test_tax_ping():
    res = client.get('/api/v1/tax/ping')
    assert res.status_code == 200
    assert res.json() == {'module': 'statutory_tax_ready'}

def test_new_regime_calculation():
    res_low = calculate_new_regime_tax(700000)
    assert res_low['total_annual_tax'] == 0.0
    assert res_low['monthly_tds'] == 0.0

    res_high = calculate_new_regime_tax(1200000)
    assert res_high['taxable_income'] == 1125000.0
    assert res_high['total_annual_tax'] == 71500.0
    assert res_high['monthly_tds'] == round(71500.0 / 12, 2)

def test_old_regime_calculation():
    res = calculate_old_regime_tax(1200000, sec_80c=150000, sec_80d=25000)
    assert res['taxable_income'] == 975000.0
    assert res['total_annual_tax'] == 111800.0
    assert res['chapter_6a_deductions'] == 175000.0

def test_compare_regimes():
    comparison = compare_regimes(1200000, sec_80c=150000, sec_80d=25000)
    assert comparison['recommended_regime'] == 'new'
    assert comparison['annual_savings'] == 111800.0 - 71500.0

def test_declaration_lifecycle():
    payload = {
        'employee_id': 501,
        'financial_year': '2024-2025',
        'regime': 'new',
        'section_80c_amount': 150000,
        'section_80d_amount': 25000,
        'hra_rent_paid': 120000,
        'home_loan_interest': 0,
        'remarks': 'Annual investment declaration'
    }
    res = client.post('/api/v1/tax/declaration/submit', json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data['employee_id'] == 501
    assert data['status'] == 'submitted'
    decl_id = data['id']

    res_get = client.get('/api/v1/tax/declaration/501?financial_year=2024-2025')
    assert res_get.status_code == 200
    assert res_get.json()['id'] == decl_id

    res_list = client.get('/api/v1/tax/declarations?status=submitted')
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    verify_payload = {
        'status': 'verified',
        'verified_by': 1,
        'remarks': 'All 80C proofs checked and approved.'
    }
    res_verify = client.post(f'/api/v1/tax/declaration/{decl_id}/verify', json=verify_payload)
    assert res_verify.status_code == 200
    assert res_verify.json()['status'] == 'verified'
    assert res_verify.json()['verified_by'] == 1

def test_calculate_tds_endpoint():
    req_data = {
        'annual_gross': 1500000,
        'section_80c_amount': 150000,
        'section_80d_amount': 25000,
        'hra_rent_paid': 100000,
        'home_loan_interest': 50000
    }
    res = client.post('/api/v1/tax/calculate-tds', json=req_data)
    assert res.status_code == 200
    data = res.json()
    assert 'recommended_regime' in data
    assert 'new_regime' in data
    assert 'old_regime' in data
