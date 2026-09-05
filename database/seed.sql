-- ==========================================================
-- PeoplePay360 Master Seed Script
-- Developer 3 (Lead Integrator) Core Database Seed
-- ==========================================================

-- 0. Ensure schema compatibility with SQLAlchemy models
ALTER TABLE salary_rules ADD COLUMN IF NOT EXISTS percentage_base VARCHAR(50) DEFAULT 'BASIC';
ALTER TABLE salary_rules ADD COLUMN IF NOT EXISTS condition_code TEXT;

ALTER TABLE payruns ADD COLUMN IF NOT EXISTS structure_id INTEGER REFERENCES salary_structures(id) ON DELETE SET NULL;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS total_basic NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS total_gross NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS total_net NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS payslip_count INTEGER DEFAULT 0;
ALTER TABLE payruns ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS has_warning BOOLEAN DEFAULT FALSE;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS warning_message TEXT;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- ==========================================================
-- 1. Departments (5 Departments)
-- ==========================================================
INSERT INTO departments (id, name, code, manager_id, parent_id) VALUES
(1, 'Executive Leadership', 'EXEC', 1, NULL),
(2, 'Engineering', 'ENG', 2, 1),
(3, 'Human Resources', 'HR', 6, 1),
(4, 'Finance & Accounting', 'FIN', 9, 1),
(5, 'Sales & Marketing', 'SALES', 12, 1)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    manager_id = EXCLUDED.manager_id,
    parent_id = EXCLUDED.parent_id;

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

-- ==========================================================
-- 2. Working Schedules
-- ==========================================================
INSERT INTO working_schedules (id, name, hours_per_week) VALUES
(1, 'Standard Full-Time (40h)', 40.00),
(2, 'Executive Schedule (45h)', 45.00),
(3, 'Part-Time Schedule (20h)', 20.00)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    hours_per_week = EXCLUDED.hours_per_week;

SELECT setval('working_schedules_id_seq', (SELECT MAX(id) FROM working_schedules));

-- ==========================================================
-- 3. Employees (15 Employees: 2 intentionally missing bank info)
-- ==========================================================
INSERT INTO employees (id, first_name, last_name, email, phone, department_id, working_schedule_id, job_title, hire_date, status) VALUES
(1, 'Eleanor', 'Vance', 'eleanor.vance@peoplepay360.local', '+1-555-0101', 1, 2, 'Chief Executive Officer', '2022-01-10', 'active'),
(2, 'Liam', 'Patel', 'liam.patel@peoplepay360.local', '+1-555-0102', 2, 1, 'Lead Systems Architect', '2022-03-15', 'active'),
(3, 'Sophia', 'Chen', 'sophia.chen@peoplepay360.local', '+1-555-0103', 2, 1, 'Senior Software Engineer', '2022-06-01', 'active'),
(4, 'Marcus', 'Brody', 'marcus.brody@peoplepay360.local', '+1-555-0104', 2, 1, 'Backend Platform Engineer', '2023-01-15', 'active'),
(5, 'Emily', 'Watson', 'emily.watson@peoplepay360.local', '+1-555-0105', 2, 1, 'Frontend UI/UX Engineer', '2023-04-10', 'active'),
(6, 'Sarah', 'Jenkins', 'sarah.jenkins@peoplepay360.local', '+1-555-0106', 3, 1, 'Director of People & Culture', '2022-02-01', 'active'),
(7, 'David', 'Miller', 'david.miller@peoplepay360.local', '+1-555-0107', 3, 1, 'Talent Acquisition Lead', '2023-05-15', 'active'),
(8, 'Hannah', 'Abbott', 'hannah.abbott@peoplepay360.local', '+1-555-0108', 3, 1, 'People Operations Specialist', '2023-09-01', 'active'),
(9, 'Michael', 'Chang', 'michael.chang@peoplepay360.local', '+1-555-0109', 4, 2, 'Chief Financial Officer', '2022-01-15', 'active'),
(10, 'Olivia', 'Taylor', 'olivia.taylor@peoplepay360.local', '+1-555-0110', 4, 1, 'Senior Controller & Accountant', '2022-11-01', 'active'),
(11, 'Daniel', 'Kim', 'daniel.kim@peoplepay360.local', '+1-555-0111', 4, 1, 'Payroll & Compliance Analyst', '2023-08-15', 'active'),
(12, 'Rachel', 'Green', 'rachel.green@peoplepay360.local', '+1-555-0112', 5, 2, 'VP of Sales & Growth', '2022-04-01', 'active'),
(13, 'Alexander', 'Ross', 'alexander.ross@peoplepay360.local', '+1-555-0113', 5, 1, 'Enterprise Account Executive', '2023-07-01', 'active'),
-- Two employees intentionally missing phone/bank information for compliance pre-validation alerts
(14, 'Nathan', 'Drake', 'nathan.drake@peoplepay360.local', NULL, 2, 1, 'DevOps & Reliability Engineer', '2023-10-01', 'active'),
(15, 'Chloe', 'Frazer', 'chloe.frazer@peoplepay360.local', NULL, 5, 1, 'Growth Marketing Strategist', '2023-11-15', 'active')
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    department_id = EXCLUDED.department_id,
    working_schedule_id = EXCLUDED.working_schedule_id,
    job_title = EXCLUDED.job_title,
    hire_date = EXCLUDED.hire_date,
    status = EXCLUDED.status;

SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));

-- ==========================================================
-- 4. Contracts (Historical Wage Progression + Active Contracts)
-- ==========================================================
-- Historical expired contracts showing wage progression
INSERT INTO contracts (id, employee_id, wage, contract_type, start_date, end_date, status) VALUES
(101, 1, 18000.00, 'full_time', '2022-01-10', '2023-12-31', 'expired'),
(102, 2, 9500.00, 'full_time', '2022-03-15', '2023-12-31', 'expired'),
(103, 3, 7800.00, 'full_time', '2022-06-01', '2023-12-31', 'expired'),
(104, 6, 8500.00, 'full_time', '2022-02-01', '2023-12-31', 'expired'),
(105, 9, 13500.00, 'full_time', '2022-01-15', '2023-12-31', 'expired'),
(106, 12, 11000.00, 'full_time', '2022-04-01', '2023-12-31', 'expired')
ON CONFLICT (id) DO UPDATE SET
    wage = EXCLUDED.wage,
    contract_type = EXCLUDED.contract_type,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status;

-- Current active running contracts (with promoted/increased wages)
INSERT INTO contracts (id, employee_id, wage, contract_type, start_date, end_date, status) VALUES
(1, 1, 22000.00, 'full_time', '2024-01-01', NULL, 'active'),
(2, 2, 12500.00, 'full_time', '2024-01-01', NULL, 'active'),
(3, 3, 10000.00, 'full_time', '2024-01-01', NULL, 'active'),
(4, 4, 7500.00, 'full_time', '2023-01-15', NULL, 'active'),
(5, 5, 7000.00, 'full_time', '2023-04-10', NULL, 'active'),
(6, 6, 11500.00, 'full_time', '2024-01-01', NULL, 'active'),
(7, 7, 6000.00, 'full_time', '2023-05-15', NULL, 'active'),
(8, 8, 6500.00, 'full_time', '2023-09-01', NULL, 'active'),
(9, 9, 16500.00, 'full_time', '2024-01-01', NULL, 'active'),
(10, 10, 8000.00, 'full_time', '2022-11-01', NULL, 'active'),
(11, 11, 6200.00, 'full_time', '2023-08-15', NULL, 'active'),
(12, 12, 14000.00, 'full_time', '2024-01-01', NULL, 'active'),
(13, 13, 6800.00, 'full_time', '2023-07-01', NULL, 'active'),
(14, 14, 8000.00, 'full_time', '2023-10-01', NULL, 'active'),
(15, 15, 7200.00, 'full_time', '2023-11-15', NULL, 'active')
ON CONFLICT (id) DO UPDATE SET
    wage = EXCLUDED.wage,
    contract_type = EXCLUDED.contract_type,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status;

SELECT setval('contracts_id_seq', (SELECT MAX(id) FROM contracts));

-- ==========================================================
-- 5. Leave Allocations & Approved Requests
-- ==========================================================
INSERT INTO leave_allocations (id, employee_id, holiday_type, number_of_days, year, status)
SELECT 
    i AS id,
    i AS employee_id,
    'Paid Time Off' AS holiday_type,
    25.00 AS number_of_days,
    2026 AS year,
    'approved' AS status
FROM generate_series(1, 15) AS i
ON CONFLICT (id) DO NOTHING;

SELECT setval('leave_allocations_id_seq', (SELECT MAX(id) FROM leave_allocations));

-- Seed Approved Leave Requests (Total 19.00 days)
INSERT INTO leave_requests (id, employee_id, holiday_type, date_from, date_to, number_of_days, status) VALUES
(1, 2, 'Paid Time Off', '2026-07-10', '2026-07-12', 3.00, 'approved'),
(2, 3, 'Paid Time Off', '2026-08-03', '2026-08-07', 5.00, 'approved'),
(3, 5, 'Paid Time Off', '2026-08-17', '2026-08-18', 2.00, 'approved'),
(4, 7, 'Paid Time Off', '2026-07-20', '2026-07-23', 4.00, 'approved'),
(5, 10, 'Paid Time Off', '2026-08-10', '2026-08-14', 5.00, 'approved')
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    number_of_days = EXCLUDED.number_of_days;

SELECT setval('leave_requests_id_seq', (SELECT MAX(id) FROM leave_requests));

-- ==========================================================
-- 6. Salary Structures ('Regular Salary', 'Executive Salary')
-- ==========================================================
INSERT INTO salary_structures (id, name, code, parent_id) VALUES
(1, 'Regular Salary', 'REG_SALARY', NULL),
(2, 'Executive Salary', 'EXEC_SALARY', NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;

SELECT setval('salary_structures_id_seq', (SELECT MAX(id) FROM salary_structures));

-- ==========================================================
-- 7. 7 Sequenced Rules (BASIC, HRA, TRANS, GROSS, PF, PTAX, NET)
-- ==========================================================
-- Rules for Structure 1: Regular Salary
INSERT INTO salary_rules (id, structure_id, name, code, category, sequence, amount_type, amount, percentage_base) VALUES
(1, 1, 'Basic Salary', 'BASIC', 'BASIC', 10, 'percentage', 50.00, 'wage'),
(2, 1, 'House Rent Allowance', 'HRA', 'ALLOWANCE', 20, 'percentage', 40.00, 'BASIC'),
(3, 1, 'Transport Allowance', 'TRANS', 'ALLOWANCE', 30, 'fixed', 1600.00, 'BASIC'),
(4, 1, 'Gross Earnings', 'GROSS', 'GROSS', 50, 'percentage', 100.00, 'GROSS'),
(5, 1, 'Provident Fund', 'PF', 'DEDUCTION', 60, 'percentage', 12.00, 'BASIC'),
(6, 1, 'Professional Tax', 'PTAX', 'DEDUCTION', 70, 'fixed', 200.00, 'GROSS'),
(7, 1, 'Net Salary Payout', 'NET', 'NET', 100, 'percentage', 100.00, 'NET'),

-- Rules for Structure 2: Executive Salary
(8, 2, 'Basic Salary', 'BASIC', 'BASIC', 10, 'percentage', 50.00, 'wage'),
(9, 2, 'House Rent Allowance', 'HRA', 'ALLOWANCE', 20, 'percentage', 50.00, 'BASIC'),
(10, 2, 'Transport Allowance', 'TRANS', 'ALLOWANCE', 30, 'fixed', 3000.00, 'BASIC'),
(11, 2, 'Gross Earnings', 'GROSS', 'GROSS', 50, 'percentage', 100.00, 'GROSS'),
(12, 2, 'Provident Fund', 'PF', 'DEDUCTION', 60, 'percentage', 12.00, 'BASIC'),
(13, 2, 'Professional Tax', 'PTAX', 'DEDUCTION', 70, 'fixed', 200.00, 'GROSS'),
(14, 2, 'Net Salary Payout', 'NET', 'NET', 100, 'percentage', 100.00, 'NET')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    category = EXCLUDED.category,
    sequence = EXCLUDED.sequence,
    amount_type = EXCLUDED.amount_type,
    amount = EXCLUDED.amount,
    percentage_base = EXCLUDED.percentage_base;

SELECT setval('salary_rules_id_seq', (SELECT MAX(id) FROM salary_rules));

-- ==========================================================
-- 8. Payruns (1 Historical Paid Payrun)
-- ==========================================================
INSERT INTO payruns (id, name, date_start, date_end, status, structure_id, total_basic, total_gross, total_net, payslip_count, warning_count) VALUES
(1, 'August 2026 Monthly Payroll', '2026-08-01', '2026-08-31', 'paid', 1, 67250.00, 114950.00, 104280.00, 13, 0)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    date_start = EXCLUDED.date_start,
    date_end = EXCLUDED.date_end,
    status = EXCLUDED.status,
    structure_id = EXCLUDED.structure_id,
    total_basic = EXCLUDED.total_basic,
    total_gross = EXCLUDED.total_gross,
    total_net = EXCLUDED.total_net,
    payslip_count = EXCLUDED.payslip_count,
    warning_count = EXCLUDED.warning_count;

SELECT setval('payruns_id_seq', (SELECT MAX(id) FROM payruns));

-- ==========================================================
-- 9. Payslips (Historical Paid Payslips for Verified Employees 1-13)
-- ==========================================================
INSERT INTO payslips (id, payrun_id, employee_id, contract_id, structure_id, date_from, date_to, basic_wage, gross_wage, total_deductions, net_wage, status, has_warning, bank_account, ifsc_code, email_sent) VALUES
(1, 1, 1, 1, 1, '2026-08-01', '2026-08-31', 11000.00, 17000.00, 1520.00, 15480.00, 'paid', FALSE, 'ACCT00010101', 'PPAY0001234', TRUE),
(2, 1, 2, 2, 1, '2026-08-01', '2026-08-31', 6250.00, 10350.00, 950.00, 9400.00, 'paid', FALSE, 'ACCT00020102', 'PPAY0001234', TRUE),
(3, 1, 3, 3, 1, '2026-08-01', '2026-08-31', 5000.00, 8600.00, 800.00, 7800.00, 'paid', FALSE, 'ACCT00030103', 'PPAY0001234', TRUE),
(4, 1, 4, 4, 1, '2026-08-01', '2026-08-31', 3750.00, 6850.00, 650.00, 6200.00, 'paid', FALSE, 'ACCT00040104', 'PPAY0001234', TRUE),
(5, 1, 5, 5, 1, '2026-08-01', '2026-08-31', 3500.00, 6500.00, 620.00, 5880.00, 'paid', FALSE, 'ACCT00050105', 'PPAY0001234', TRUE),
(6, 1, 6, 6, 1, '2026-08-01', '2026-08-31', 5750.00, 9650.00, 890.00, 8760.00, 'paid', FALSE, 'ACCT00060106', 'PPAY0001234', TRUE),
(7, 1, 7, 7, 1, '2026-08-01', '2026-08-31', 3000.00, 5800.00, 560.00, 5240.00, 'paid', FALSE, 'ACCT00070107', 'PPAY0001234', TRUE),
(8, 1, 8, 8, 1, '2026-08-01', '2026-08-31', 3250.00, 6150.00, 590.00, 5560.00, 'paid', FALSE, 'ACCT00080108', 'PPAY0001234', TRUE),
(9, 1, 9, 9, 1, '2026-08-01', '2026-08-31', 8250.00, 13150.00, 1190.00, 11960.00, 'paid', FALSE, 'ACCT00090109', 'PPAY0001234', TRUE),
(10, 1, 10, 10, 1, '2026-08-01', '2026-08-31', 4000.00, 7200.00, 680.00, 6520.00, 'paid', FALSE, 'ACCT00100110', 'PPAY0001234', TRUE),
(11, 1, 11, 11, 1, '2026-08-01', '2026-08-31', 3100.00, 5940.00, 572.00, 5368.00, 'paid', FALSE, 'ACCT00110111', 'PPAY0001234', TRUE),
(12, 1, 12, 12, 1, '2026-08-01', '2026-08-31', 7000.00, 11400.00, 1040.00, 10360.00, 'paid', FALSE, 'ACCT00120112', 'PPAY0001234', TRUE),
(13, 1, 13, 13, 1, '2026-08-01', '2026-08-31', 3400.00, 6360.00, 608.00, 5752.00, 'paid', FALSE, 'ACCT00130113', 'PPAY0001234', TRUE)
ON CONFLICT (id) DO UPDATE SET
    basic_wage = EXCLUDED.basic_wage,
    gross_wage = EXCLUDED.gross_wage,
    total_deductions = EXCLUDED.total_deductions,
    net_wage = EXCLUDED.net_wage,
    status = EXCLUDED.status,
    has_warning = EXCLUDED.has_warning,
    bank_account = EXCLUDED.bank_account,
    ifsc_code = EXCLUDED.ifsc_code,
    email_sent = EXCLUDED.email_sent;

SELECT setval('payslips_id_seq', (SELECT MAX(id) FROM payslips));

-- ==========================================================
-- 10. Payslip Lines (Snapshot Itemized Lines for 7 Rules)
-- ==========================================================
DELETE FROM payslip_lines WHERE payslip_id BETWEEN 1 AND 13;

INSERT INTO payslip_lines (payslip_id, salary_rule_id, name, code, category, sequence, rate, amount, total)
SELECT 
    p.id AS payslip_id,
    r.id AS salary_rule_id,
    r.name,
    r.code,
    r.category,
    r.sequence,
    r.amount AS rate,
    r.amount,
    CASE 
        WHEN r.code = 'BASIC' THEN p.basic_wage
        WHEN r.code = 'HRA' THEN round(p.basic_wage * 0.40, 2)
        WHEN r.code = 'TRANS' THEN 1600.00
        WHEN r.code = 'GROSS' THEN p.gross_wage
        WHEN r.code = 'PF' THEN round(p.basic_wage * 0.12, 2)
        WHEN r.code = 'PTAX' THEN 200.00
        WHEN r.code = 'NET' THEN p.net_wage
        ELSE 0.00
    END AS total
FROM payslips p
CROSS JOIN salary_rules r
WHERE p.payrun_id = 1 AND r.structure_id = 1;
