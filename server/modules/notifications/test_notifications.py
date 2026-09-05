import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from server.modules.master_data.database import Base, get_db
import server.modules.notifications.models
from server.modules.notifications.models import NotificationLog
from server.modules.notifications.router import router as notifications_router
from server.modules.notifications.pdf_generator import generate_payslip_pdf

app = FastAPI()
app.include_router(notifications_router, prefix='/api/v1/notifications', tags=['Notifications'])

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

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_notifications_ping():
    res = client.get('/api/v1/notifications/ping')
    assert res.status_code == 200
    assert res.json() == {'module': 'notifications_ready'}

def test_generate_payslip_pdf():
    pdf_data = {
        'employee_id': 'EMP-0099',
        'employee_name': 'Sarah Connor',
        'pay_period': 'August 2026',
        'basic_salary': 80000.0,
        'hra': 32000.0,
        'special_allowance': 18000.0,
        'provident_fund': 9600.0,
        'professional_tax': 200.0,
        'tax_tds': 12000.0,
        'loan_emi': 5000.0
    }
    pdf_bytes = generate_payslip_pdf(pdf_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b'%PDF')

def test_send_email_endpoint():
    payload = {
        'recipient_email': 'sarah@example.com',
        'recipient_name': 'Sarah Connor',
        'notification_type': 'system_alert',
        'subject': 'Maintenance Alert',
        'body': 'System will undergo planned maintenance tonight at 11 PM.'
    }
    res = client.post('/api/v1/notifications/send', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data['recipient_email'] == 'sarah@example.com'
    assert data['status'] == 'sent'
    assert data['id'] is not None

def test_batch_payslips_dispatch():
    res = client.post('/api/v1/notifications/send-payslip-batch/55')
    assert res.status_code == 200
    data = res.json()
    assert data['payrun_id'] == 55
    assert data['status'] == 'completed'
    assert data['total_dispatched'] > 0

def test_list_notification_logs():
    res = client.get('/api/v1/notifications/logs?notification_type=payslip_email')
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1

def test_download_payslip_pdf_endpoint():
    res = client.get('/api/v1/notifications/payslip-pdf/101')
    assert res.status_code == 200
    assert res.headers['content-type'] == 'application/pdf'
    assert res.content.startswith(b'%PDF')
