from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from server.modules.master_data.database import get_db
from server.modules.notifications.models import NotificationLog
from server.modules.notifications.schemas import (
    NotificationLogResponse,
    SendEmailRequest,
    BatchPayslipEmailRequest,
    BatchPayslipResponse
)
from server.modules.notifications.pdf_generator import generate_payslip_pdf
from server.modules.notifications.email_service import send_notification_email, dispatch_batch_payslips_service

router = APIRouter()

@router.get('/ping', tags=['Notifications'])
def ping():
    return {'module': 'notifications_ready'}

@router.get('/logs', response_model=List[NotificationLogResponse])
def list_logs(
    notification_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(NotificationLog)
    if notification_type and notification_type != 'all':
        query = query.filter(NotificationLog.notification_type == notification_type)
    if status and status != 'all':
        query = query.filter(NotificationLog.status == status)
    return query.order_by(NotificationLog.id.desc()).all()

@router.post('/send', response_model=NotificationLogResponse)
def send_email(payload: SendEmailRequest, db: Session = Depends(get_db)):
    log = send_notification_email(
        db=db,
        recipient_email=payload.recipient_email,
        recipient_name=payload.recipient_name,
        notification_type=payload.notification_type,
        subject=payload.subject,
        body=payload.body
    )
    return log

@router.post('/send-payslip-batch/{payrun_id}', response_model=BatchPayslipResponse)
def send_payslip_batch(payrun_id: int, db: Session = Depends(get_db)):
    res = dispatch_batch_payslips_service(db, payrun_id)
    return res

@router.get('/payslip-pdf/{payslip_id}')
def download_payslip_pdf(payslip_id: int):
    # Sample generator with payslip ID
    pdf_bytes = generate_payslip_pdf({
        'employee_id': f'EMP-{payslip_id:04d}',
        'employee_name': 'Employee Sample',
        'pay_period': 'August 2026',
        'basic_salary': 65000.0,
        'hra': 26000.0,
        'special_allowance': 14000.0,
        'provident_fund': 7800.0,
        'professional_tax': 200.0,
        'tax_tds': 8500.0,
        'loan_emi': 0.0
    })
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=payslip_{payslip_id}.pdf'}
    )
