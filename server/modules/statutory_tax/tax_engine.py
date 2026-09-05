from typing import Dict, Any

def calculate_new_regime_tax(annual_gross: float) -> Dict[str, Any]:
    standard_deduction = 75000.0
    taxable_income = max(0.0, annual_gross - standard_deduction)

    # 2024-25 New Regime Slabs:
    # 0 - 300,000 : 0%
    # 300,000 - 700,000 : 5%
    # 700,000 - 1,000,000 : 10%
    # 1,000,000 - 1,200,000 : 15%
    # 1,200,000 - 1,500,000 : 20%
    # > 1,500,000 : 30%

    tax = 0.0
    if taxable_income <= 300000:
        tax = 0.0
    elif taxable_income <= 700000:
        tax = (taxable_income - 300000) * 0.05
    elif taxable_income <= 1000000:
        tax = 20000.0 + (taxable_income - 700000) * 0.10
    elif taxable_income <= 1200000:
        tax = 50000.0 + (taxable_income - 1000000) * 0.15
    elif taxable_income <= 1500000:
        tax = 80000.0 + (taxable_income - 1200000) * 0.20
    else:
        tax = 140000.0 + (taxable_income - 1500000) * 0.30

    rebate_87a = 0.0
    # Rebate under section 87A for New Regime (Taxable income up to 700,000)
    if taxable_income <= 700000:
        rebate_87a = tax
        tax = 0.0

    cess = round(tax * 0.04, 2)
    total_tax = round(tax + cess, 2)
    monthly_tds = round(total_tax / 12.0, 2)

    return {
        'regime': 'new',
        'gross_income': round(annual_gross, 2),
        'standard_deduction': standard_deduction,
        'chapter_6a_deductions': 0.0,
        'taxable_income': round(taxable_income, 2),
        'tax_before_cess': round(tax, 2),
        'rebate_87a': round(rebate_87a, 2),
        'cess': cess,
        'total_annual_tax': total_tax,
        'monthly_tds': monthly_tds
    }

def calculate_old_regime_tax(
    annual_gross: float,
    sec_80c: float = 0.0,
    sec_80d: float = 0.0,
    hra_rent: float = 0.0,
    home_loan_int: float = 0.0
) -> Dict[str, Any]:
    standard_deduction = 50000.0

    # Capped Deductions
    allowed_80c = min(max(0.0, sec_80c), 150000.0)
    allowed_80d = min(max(0.0, sec_80d), 25000.0)
    allowed_hra = min(max(0.0, hra_rent), 200000.0)
    allowed_home_loan = min(max(0.0, home_loan_int), 200000.0)

    total_exemptions = standard_deduction + allowed_80c + allowed_80d + allowed_hra + allowed_home_loan
    taxable_income = max(0.0, annual_gross - total_exemptions)

    # Old Regime Slabs:
    # 0 - 250,000 : 0%
    # 250,000 - 500,000 : 5%
    # 500,000 - 1,000,000 : 20%
    # > 1,000,000 : 30%

    tax = 0.0
    if taxable_income <= 250000:
        tax = 0.0
    elif taxable_income <= 500000:
        tax = (taxable_income - 250000) * 0.05
    elif taxable_income <= 1000000:
        tax = 12500.0 + (taxable_income - 500000) * 0.20
    else:
        tax = 112500.0 + (taxable_income - 1000000) * 0.30

    rebate_87a = 0.0
    if taxable_income <= 500000:
        rebate_87a = tax
        tax = 0.0

    cess = round(tax * 0.04, 2)
    total_tax = round(tax + cess, 2)
    monthly_tds = round(total_tax / 12.0, 2)

    return {
        'regime': 'old',
        'gross_income': round(annual_gross, 2),
        'standard_deduction': standard_deduction,
        'chapter_6a_deductions': round(allowed_80c + allowed_80d + allowed_hra + allowed_home_loan, 2),
        'deductions_breakdown': {
            'section_80c': allowed_80c,
            'section_80d': allowed_80d,
            'hra': allowed_hra,
            'home_loan_interest': allowed_home_loan
        },
        'taxable_income': round(taxable_income, 2),
        'tax_before_cess': round(tax, 2),
        'rebate_87a': round(rebate_87a, 2),
        'cess': cess,
        'total_annual_tax': total_tax,
        'monthly_tds': monthly_tds
    }

def compare_regimes(
    annual_gross: float,
    sec_80c: float = 0.0,
    sec_80d: float = 0.0,
    hra_rent: float = 0.0,
    home_loan_int: float = 0.0
) -> Dict[str, Any]:
    new_res = calculate_new_regime_tax(annual_gross)
    old_res = calculate_old_regime_tax(annual_gross, sec_80c, sec_80d, hra_rent, home_loan_int)

    recommended = 'new' if new_res['total_annual_tax'] <= old_res['total_annual_tax'] else 'old'
    tax_diff = abs(new_res['total_annual_tax'] - old_res['total_annual_tax'])

    return {
        'recommended_regime': recommended,
        'annual_savings': round(tax_diff, 2),
        'monthly_savings': round(tax_diff / 12.0, 2),
        'new_regime': new_res,
        'old_regime': old_res
    }
