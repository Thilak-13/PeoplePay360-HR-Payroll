export interface TaxDeclaration {
  id: number;
  employee_id: number;
  financial_year: string;
  regime: 'new' | 'old';
  section_80c_amount: number;
  section_80d_amount: number;
  hra_rent_paid: number;
  home_loan_interest: number;
  proof_documents_json?: string | null;
  verified_by?: number | null;
  status: 'draft' | 'submitted' | 'verified' | 'rejected';
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TaxDeclarationSubmitPayload {
  employee_id: number;
  financial_year?: string;
  regime: 'new' | 'old';
  section_80c_amount: number;
  section_80d_amount: number;
  hra_rent_paid: number;
  home_loan_interest: number;
  proof_documents_json?: string | null;
  remarks?: string | null;
}

export interface TaxDeclarationVerifyPayload {
  status: 'verified' | 'rejected';
  verified_by?: number;
  remarks?: string;
}

export interface RegimeTaxBreakdown {
  regime: 'new' | 'old';
  gross_income: number;
  standard_deduction: number;
  chapter_6a_deductions: number;
  taxable_income: number;
  tax_before_cess: number;
  rebate_87a: number;
  cess: number;
  total_annual_tax: number;
  monthly_tds: number;
  deductions_breakdown?: {
    section_80c: number;
    section_80d: number;
    hra: number;
    home_loan_interest: number;
  };
}

export interface RegimeComparisonResult {
  recommended_regime: 'new' | 'old';
  annual_savings: number;
  monthly_savings: number;
  new_regime: RegimeTaxBreakdown;
  old_regime: RegimeTaxBreakdown;
}
