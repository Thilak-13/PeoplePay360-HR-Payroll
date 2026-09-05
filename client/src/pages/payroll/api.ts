import {
  EligibleEmployee,
  ConfirmPayrunWizardData,
  Payrun,
  Payslip,
  Step1ValidateRequest,
  Step1ValidateResponse,
  PayrollMetrics,
  SalaryStructure,
  SalaryRule,
} from './types';

const BASE_URL = '/api/v1/payroll';

/**
 * Fetch active employees eligible for a payrun within the specified date interval,
 * including pre-validation compliance audit flags (bank account, duplicate overlap).
 */
export async function fetchEligibleEmployees(
  start: string,
  end: string
): Promise<EligibleEmployee[]> {
  const params = new URLSearchParams({
    period_start: start,
    period_end: end,
    date_start: start,
    date_end: end,
  });

  const res = await fetch(`${BASE_URL}/payruns/wizard/eligible-employees?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to load eligible employees');
  }
  return res.json();
}

/**
 * Step 1 Wizard validation: validates date range, structure, and detects overlapping batches.
 */
export async function validatePayrunWizardStep1(
  req: Step1ValidateRequest
): Promise<Step1ValidateResponse> {
  const res = await fetch(`${BASE_URL}/payruns/wizard/step1-validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Step 1 validation failed');
  }
  return res.json();
}

/**
 * Confirm Step 2 wizard and instantiate draft payrun with draft placeholder payslips.
 */
export async function confirmPayrunWizard(
  data: ConfirmPayrunWizardData
): Promise<Payrun> {
  const payload = {
    name: data.name,
    period_start: data.period_start || data.date_start,
    period_end: data.period_end || data.date_end,
    date_start: data.date_start || data.period_start,
    date_end: data.date_end || data.period_end,
    structure_id: data.structure_id,
    selected_employee_ids: data.selected_employee_ids || data.employee_ids || [],
    employee_ids: data.employee_ids || data.selected_employee_ids || [],
  };

  const res = await fetch(`${BASE_URL}/payruns/wizard/step2-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create payrun batch');
  }
  return res.json();
}

/**
 * Execute batch compute pipeline on all payslips within a payrun.
 */
export async function computePayrunBatch(id: number): Promise<Payrun> {
  const res = await fetch(`${BASE_URL}/payruns/${id}/compute`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to compute payrun #${id}`);
  }
  return res.json();
}

/**
 * Transition payrun state machine with validation barrier and terminal lock enforcement.
 */
export async function transitionPayrunStatus(
  id: number,
  target: string
): Promise<Payrun> {
  const res = await fetch(
    `${BASE_URL}/payruns/${id}/transition?target_status=${encodeURIComponent(target)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: target }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to transition payrun #${id} to ${target}`);
  }
  return res.json();
}

/**
 * Fetch detailed information for a single payrun including all payslips and compliance warning badges.
 */
export async function fetchPayrunDetail(id: number): Promise<Payrun> {
  const res = await fetch(`${BASE_URL}/payruns/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch payrun #${id}`);
  }
  return res.json();
}

/**
 * Fetch detailed breakdown for a single payslip with its itemized snapshot lines.
 */
export async function fetchPayslipDetail(id: number): Promise<Payslip> {
  const res = await fetch(`${BASE_URL}/payslips/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch payslip #${id}`);
  }
  return res.json();
}

/**
 * Recompute individual payslip against active contracts and salary rules.
 */
export async function computeSinglePayslip(id: number): Promise<Payslip> {
  const res = await fetch(`${BASE_URL}/payslips/${id}/compute`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to recompute payslip #${id}`);
  }
  return res.json();
}

/**
 * List all payruns with optional status filter and search query.
 */
export async function fetchPayruns(
  status?: string,
  search?: string
): Promise<Payrun[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  const url = `${BASE_URL}/payruns${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to list payruns');
  }
  return res.json();
}

/**
 * Fetch aggregate payroll KPI metrics.
 */
export async function fetchPayrollMetrics(): Promise<PayrollMetrics> {
  const res = await fetch(`${BASE_URL}/metrics`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch payroll metrics');
  }
  return res.json();
}

/**
 * List all salary structures.
 */
export async function fetchSalaryStructures(): Promise<SalaryStructure[]> {
  const res = await fetch(`${BASE_URL}/structures`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to load salary structures');
  }
  return res.json();
}

/**
 * Get salary structure by ID with its rules.
 */
export async function fetchSalaryStructureDetail(id: number): Promise<SalaryStructure> {
  const res = await fetch(`${BASE_URL}/structures/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to load salary structure #${id}`);
  }
  return res.json();
}
