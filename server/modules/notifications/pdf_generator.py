import io
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_payslip_pdf(data: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e1b4b'),
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#312e81')
    )
    cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b')
    )
    cell_bold_style = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # Header
    story.append(Paragraph("<b>PeoplePay360 Technologies Private Limited</b>", title_style))
    story.append(Paragraph("Confidential Employee Monthly Salary Slip", subtitle_style))
    pay_period = data.get('pay_period', datetime.now(timezone.utc).strftime('%B %Y'))
    story.append(Paragraph(f"Pay Period: <b>{pay_period}</b>", subtitle_style))
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=15))

    # Employee Summary Grid
    emp_info = [
        [
            Paragraph("<b>Employee ID:</b>", cell_style),
            Paragraph(str(data.get('employee_id', 'EMP-1001')), cell_bold_style),
            Paragraph("<b>Employee Name:</b>", cell_style),
            Paragraph(str(data.get('employee_name', 'Alex Johnson')), cell_bold_style),
        ],
        [
            Paragraph("<b>Designation:</b>", cell_style),
            Paragraph(str(data.get('designation', 'Senior Software Engineer')), cell_style),
            Paragraph("<b>Department:</b>", cell_style),
            Paragraph(str(data.get('department', 'Engineering')), cell_style),
        ],
        [
            Paragraph("<b>Bank Account:</b>", cell_style),
            Paragraph(str(data.get('bank_account', 'XXXX-XXXX-4892')), cell_style),
            Paragraph("<b>PAN Number:</b>", cell_style),
            Paragraph(str(data.get('pan_number', 'ABCDE1234F')), cell_style),
        ],
    ]
    emp_table = Table(emp_info, colWidths=[110, 160, 110, 160])
    emp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(emp_table)
    story.append(Spacer(1, 15))

    # Earnings & Deductions Tables
    basic = float(data.get('basic_salary', 65000.0))
    hra = float(data.get('hra', 26000.0))
    allowances = float(data.get('special_allowance', 14000.0))
    gross_earnings = basic + hra + allowances

    pf = float(data.get('provident_fund', 7800.0))
    pt = float(data.get('professional_tax', 200.0))
    tds = float(data.get('tax_tds', 8500.0))
    loan_emi = float(data.get('loan_emi', 0.0))
    gross_deductions = pf + pt + tds + loan_emi
    net_pay = gross_earnings - gross_deductions

    breakdown_data = [
        [
            Paragraph("<b>Earnings</b>", cell_bold_style),
            Paragraph("<b>Amount (INR)</b>", cell_bold_style),
            Paragraph("<b>Deductions</b>", cell_bold_style),
            Paragraph("<b>Amount (INR)</b>", cell_bold_style)
        ],
        [
            Paragraph("Basic Salary", cell_style),
            Paragraph(f"₹{basic:,.2f}", cell_style),
            Paragraph("Provident Fund (EPF)", cell_style),
            Paragraph(f"₹{pf:,.2f}", cell_style)
        ],
        [
            Paragraph("House Rent Allowance (HRA)", cell_style),
            Paragraph(f"₹{hra:,.2f}", cell_style),
            Paragraph("Professional Tax", cell_style),
            Paragraph(f"₹{pt:,.2f}", cell_style)
        ],
        [
            Paragraph("Special Allowances", cell_style),
            Paragraph(f"₹{allowances:,.2f}", cell_style),
            Paragraph("Income Tax (TDS)", cell_style),
            Paragraph(f"₹{tds:,.2f}", cell_style)
        ],
        [
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("Loan / Advance EMI", cell_style),
            Paragraph(f"₹{loan_emi:,.2f}", cell_style)
        ],
        [
            Paragraph("<b>Gross Earnings</b>", cell_bold_style),
            Paragraph(f"<b>₹{gross_earnings:,.2f}</b>", cell_bold_style),
            Paragraph("<b>Total Deductions</b>", cell_bold_style),
            Paragraph(f"<b>₹{gross_deductions:,.2f}</b>", cell_bold_style)
        ]
    ]

    breakdown_table = Table(breakdown_data, colWidths=[160, 110, 160, 110])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e7ff')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 15))

    # Net Pay Callout
    net_data = [
        [
            Paragraph(f"<b>Net Transfer Amount:</b> ₹{net_pay:,.2f}", ParagraphStyle('Net', parent=title_style, fontSize=13, leading=16, textColor=colors.HexColor('#15803d')))
        ]
    ]
    net_table = Table(net_data, colWidths=[540])
    net_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#dcfce7')),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#86efac')),
    ]))
    story.append(net_table)
    story.append(Spacer(1, 20))

    # Footer
    story.append(Paragraph("<i>This is a computer-generated salary slip and requires no physical signature.</i>", subtitle_style))
    story.append(Paragraph(f"Generated via PeoplePay360 on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", subtitle_style))

    doc.build(story)
    return buffer.getvalue()
