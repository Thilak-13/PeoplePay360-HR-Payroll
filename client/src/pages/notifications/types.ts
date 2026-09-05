export interface NotificationLog {
  id: number;
  recipient_email: string;
  recipient_name?: string | null;
  notification_type: 'payslip_email' | 'leave_approval' | 'loan_update' | 'expense_status' | 'tax_update' | 'system_alert';
  subject: string;
  body?: string | null;
  attachment_name?: string | null;
  status: 'queued' | 'sent' | 'failed';
  error_message?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

export interface SendEmailPayload {
  recipient_email: string;
  recipient_name?: string;
  notification_type: 'payslip_email' | 'leave_approval' | 'loan_update' | 'expense_status' | 'tax_update' | 'system_alert';
  subject: string;
  body: string;
}

export interface BatchPayslipResponse {
  payrun_id: number;
  total_queued: number;
  total_dispatched: number;
  status: string;
}
