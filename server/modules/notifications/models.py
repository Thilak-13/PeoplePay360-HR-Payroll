from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from server.modules.master_data.database import Base

class NotificationLog(Base):
    __tablename__ = 'notification_logs'

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(255), nullable=False, index=True)
    recipient_name = Column(String(255), nullable=True)
    notification_type = Column(String(50), nullable=False, default='payslip_email')
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    attachment_name = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default='queued')  # queued, sent, failed
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
