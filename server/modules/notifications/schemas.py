from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class NotificationLogResponse(BaseModel):
    id: int
    recipient_email: str
    recipient_name: Optional[str] = None
    notification_type: str
    subject: str
    body: Optional[str] = None
    attachment_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SendEmailRequest(BaseModel):
    recipient_email: str
    recipient_name: Optional[str] = None
    notification_type: str = 'system_alert'
    subject: str
    body: str

class BatchPayslipEmailRequest(BaseModel):
    payrun_id: int
    send_pdf: bool = True
    custom_message: Optional[str] = None

class BatchPayslipResponse(BaseModel):
    payrun_id: int
    total_queued: int
    total_dispatched: int
    status: str
