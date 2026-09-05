import axios from 'axios';
import { NotificationLog, SendEmailPayload, BatchPayslipResponse } from './types';

const API_BASE = '/api/v1/notifications';

export async function fetchNotificationLogs(notificationType?: string, status?: string): Promise<NotificationLog[]> {
  const params: Record<string, string> = {};
  if (notificationType && notificationType !== 'all') params.notification_type = notificationType;
  if (status && status !== 'all') params.status = status;
  const res = await axios.get<NotificationLog[]>(`${API_BASE}/logs`, { params });
  return res.data;
}

export async function sendSingleNotification(payload: SendEmailPayload): Promise<NotificationLog> {
  const res = await axios.post<NotificationLog>(`${API_BASE}/send`, payload);
  return res.data;
}

export async function triggerBatchPayslipEmails(payrunId: number): Promise<BatchPayslipResponse> {
  const res = await axios.post<BatchPayslipResponse>(`${API_BASE}/send-payslip-batch/${payrunId}`);
  return res.data;
}

export function getPayslipPdfUrl(payslipId: number): string {
  return `${API_BASE}/payslip-pdf/${payslipId}`;
}
