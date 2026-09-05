import {
  EmployeeLoan,
  LoanApplyRequest,
  LoanApproveRequest,
  LoanRejectRequest,
  RecordDeductionRequest,
  LoanRepayment,
  ActiveDeductionResponse,
  CalculateEMIResponse,
  LoansListResponse,
  EMIScheduleItem,
} from './types';

const BASE_URL = '/api/v1/loans';

export async function pingLoans(): Promise<{ module: string }> {
  const res = await fetch(`${BASE_URL}/ping`);
  if (!res.ok) {
    throw new Error(`Failed to ping loans service (Status: ${res.status})`);
  }
  return res.json();
}

export async function fetchLoans(
  statusFilter?: string,
  employeeId?: number
): Promise<LoansListResponse> {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') {
    params.append('status_filter', statusFilter);
  }
  if (employeeId) {
    params.append('employee_id', employeeId.toString());
  }

  const url = `${BASE_URL}/list${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch loans (Status: ${res.status})`);
  }
  return res.json();
}

export async function fetchLoan(id: number): Promise<EmployeeLoan> {
  const res = await fetch(`${BASE_URL}/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch loan details (Status: ${res.status})`);
  }
  return res.json();
}

export async function applyLoan(data: LoanApplyRequest): Promise<EmployeeLoan> {
  const res = await fetch(`${BASE_URL}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to submit loan application (Status: ${res.status})`);
  }
  return res.json();
}

export async function approveLoan(
  id: number,
  approverId?: number
): Promise<EmployeeLoan> {
  const reqBody: LoanApproveRequest = approverId ? { approver_id: approverId } : {};
  const res = await fetch(`${BASE_URL}/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to approve loan (Status: ${res.status})`);
  }
  return res.json();
}

export async function rejectLoan(
  id: number,
  remarks?: string
): Promise<EmployeeLoan> {
  const reqBody: LoanRejectRequest = remarks ? { remarks } : {};
  const res = await fetch(`${BASE_URL}/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to reject loan (Status: ${res.status})`);
  }
  return res.json();
}

export async function fetchEmployeeLoans(employeeId: number): Promise<EmployeeLoan[]> {
  const res = await fetch(`${BASE_URL}/employee/${employeeId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch employee loans (Status: ${res.status})`);
  }
  return res.json();
}

export async function fetchActiveDeduction(
  employeeId: number
): Promise<ActiveDeductionResponse> {
  const res = await fetch(`${BASE_URL}/active-deduction/${employeeId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch active deduction (Status: ${res.status})`);
  }
  return res.json();
}

export async function recordDeduction(
  data: RecordDeductionRequest
): Promise<LoanRepayment> {
  const res = await fetch(`${BASE_URL}/record-deduction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to record deduction (Status: ${res.status})`);
  }
  return res.json();
}

export async function calculateEMI(
  principalAmount: number,
  tenureMonths: number,
  interestRate: number = 0.0
): Promise<CalculateEMIResponse> {
  const res = await fetch(`${BASE_URL}/calculate-emi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      principal_amount: principalAmount,
      tenure_months: tenureMonths,
      interest_rate: interestRate,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to calculate EMI (Status: ${res.status})`);
  }
  return res.json();
}

export async function fetchLoanSchedule(id: number): Promise<{
  loan_id: number;
  employee_id: number;
  principal_amount: number;
  interest_rate: number;
  monthly_emi: number;
  remaining_balance: number;
  status: string;
  schedule: EMIScheduleItem[];
}> {
  const res = await fetch(`${BASE_URL}/${id}/schedule`);
  if (!res.ok) {
    throw new Error(`Failed to fetch loan repayment schedule (Status: ${res.status})`);
  }
  return res.json();
}
