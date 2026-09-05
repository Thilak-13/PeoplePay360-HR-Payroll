import axios from 'axios';
import {
  TaxDeclaration,
  TaxDeclarationSubmitPayload,
  TaxDeclarationVerifyPayload,
  RegimeComparisonResult,
} from './types';

const API_BASE = '/api/v1/tax';

export async function fetchTaxDeclaration(employeeId: number, financialYear: string = '2024-2025'): Promise<TaxDeclaration | null> {
  try {
    const res = await axios.get<TaxDeclaration>(`${API_BASE}/declaration/${employeeId}`, {
      params: { financial_year: financialYear },
    });
    return res.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function fetchAllTaxDeclarations(status?: string, financialYear?: string): Promise<TaxDeclaration[]> {
  const params: Record<string, string> = {};
  if (status && status !== 'all') params.status = status;
  if (financialYear && financialYear !== 'all') params.financial_year = financialYear;
  const res = await axios.get<TaxDeclaration[]>(`${API_BASE}/declarations`, { params });
  return res.data;
}

export async function submitTaxDeclaration(payload: TaxDeclarationSubmitPayload): Promise<TaxDeclaration> {
  const res = await axios.post<TaxDeclaration>(`${API_BASE}/declaration/submit`, payload);
  return res.data;
}

export async function verifyTaxDeclaration(id: number, payload: TaxDeclarationVerifyPayload): Promise<TaxDeclaration> {
  const res = await axios.post<TaxDeclaration>(`${API_BASE}/declaration/${id}/verify`, payload);
  return res.data;
}

export async function calculateTDS(payload: {
  annual_gross: number;
  regime?: 'new' | 'old';
  section_80c_amount?: number;
  section_80d_amount?: number;
  hra_rent_paid?: number;
  home_loan_interest?: number;
}): Promise<RegimeComparisonResult> {
  const res = await axios.post<RegimeComparisonResult>(`${API_BASE}/calculate-tds`, payload);
  return res.data;
}
