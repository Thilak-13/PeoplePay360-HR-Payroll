import { DashboardAnalyticsResponse, SendPayslipsResponse } from './types';

const BASE_URL = '/api/v1/analytics';

export async function fetchDashboardMetrics(): Promise<DashboardAnalyticsResponse> {
  const res = await fetch(`${BASE_URL}/dashboard`);
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard metrics: ${res.statusText}`);
  }
  return res.json();
}

export async function exportBankPayoutCsv(payrunId: number): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/payruns/${payrunId}/export-bank-file`);
  if (!res.ok) {
    throw new Error(`Failed to export bank payout file: ${res.statusText}`);
  }
  return res.blob();
}

export async function dispatchBulkPayslipEmails(payrunId: number): Promise<SendPayslipsResponse> {
  const res = await fetch(`${BASE_URL}/payruns/${payrunId}/send-payslips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to dispatch bulk payslip emails: ${res.statusText}`);
  }
  return res.json();
}
