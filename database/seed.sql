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

ALTER TABLE payslip_lines ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 10;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);

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
INSERT INTO employees (id, first_name, last_name, email, phone, department_id, working_schedule_id, job_title, bank_account_number, bank_ifsc, hire_date, status) VALUES
(1, 'Eleanor', 'Vance', 'eleanor.vance@peoplepay360.local', '+1-555-0101', 1, 2, 'Chief Executive Officer', '987654321001', 'HDFC0001234', '2022-01-10', 'active'),
(2, 'Liam', 'Patel', 'liam.patel@peoplepay360.local', '+1-555-0102', 2, 1, 'Lead Systems Architect', '987654321002', 'HDFC0001234', '2022-03-15', 'active'),
(3, 'Sophia', 'Chen', 'sophia.chen@peoplepay360.local', '+1-555-0103', 2, 1, 'Senior Software Engineer', '987654321003', 'SBIN0004567', '2022-06-01', 'active'),
(4, 'Marcus', 'Brody', 'marcus.brody@peoplepay360.local', '+1-555-0104', 2, 1, 'Backend Platform Engineer', '987654321004', 'ICIC0007890', '2023-01-15', 'active'),
(5, 'Emily', 'Watson', 'emily.watson@peoplepay360.local', '+1-555-0105', 2, 1, 'Frontend UI/UX Engineer', '987654321005', 'HDFC0001234', '2023-04-10', 'active'),
(6, 'Sarah', 'Jenkins', 'sarah.jenkins@peoplepay360.local', '+1-555-0106', 3, 1, 'Director of People & Culture', '987654321006', 'KKBK0002345', '2022-02-01', 'active'),
(7, 'David', 'Miller', 'david.miller@peoplepay360.local', '+1-555-0107', 3, 1, 'Talent Acquisition Lead', '987654321007', 'SBIN0004567', '2023-05-15', 'active'),
(8, 'Hannah', 'Abbott', 'hannah.abbott@peoplepay360.local', '+1-555-0108', 3, 1, 'People Operations Specialist', '987654321008', 'ICIC0007890', '2023-09-01', 'active'),
(9, 'Michael', 'Chang', 'michael.chang@peoplepay360.local', '+1-555-0109', 4, 2, 'Chief Financial Officer', '987654321009', 'HDFC0001234', '2022-01-15', 'active'),
(10, 'Olivia', 'Taylor', 'olivia.taylor@peoplepay360.local', '+1-555-0110', 4, 1, 'Senior Controller & Accountant', '987654321010', 'SBIN0004567', '2022-11-01', 'active'),
(11, 'Daniel', 'Kim', 'daniel.kim@peoplepay360.local', '+1-555-0111', 4, 1, 'Payroll & Compliance Analyst', '987654321011', 'KKBK0002345', '2023-08-15', 'active'),
(12, 'Rachel', 'Green', 'rachel.green@peoplepay360.local', '+1-555-0112', 5, 2, 'VP of Sales & Growth', '987654321012', 'ICIC0007890', '2022-04-01', 'active'),
(13, 'Alexander', 'Ross', 'alexander.ross@peoplepay360.local', '+1-555-0113', 5, 1, 'Enterprise Account Executive', '987654321013', 'HDFC0001234', '2023-07-01', 'active'),
-- Two employees intentionally leaving bank_account_number and bank_ifsc NULL to test compliance alerts in demos
(14, 'Nathan', 'Drake', 'nathan.drake@peoplepay360.local', '+1-555-0114', 2, 1, 'DevOps & Reliability Engineer', NULL, NULL, '2023-10-01', 'active'),
(15, 'Chloe', 'Frazer', 'chloe.frazer@peoplepay360.local', '+1-555-0115', 5, 1, 'Growth Marketing Strategist', NULL, NULL, '2023-11-15', 'active')
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    department_id = EXCLUDED.department_id,
    working_schedule_id = EXCLUDED.working_schedule_id,
    job_title = EXCLUDED.job_title,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc = EXCLUDED.bank_ifsc,
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
-- 6. Salary Structures ('Regular Salary Structure', 'Executive Salary')
-- ==========================================================
INSERT INTO salary_structures (id, name, code, parent_id) VALUES
(1, 'Regular Salary Structure', 'REG_SAL', NULL),
(2, 'Executive Salary', 'EXEC_SAL', NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;

SELECT setval('salary_structures_id_seq', (SELECT MAX(id) FROM salary_structures));

-- ==========================================================
-- 6.5 Statutory Rules Master (Date-Effective Compliance Engine)
-- ==========================================================
CREATE TABLE IF NOT EXISTS statutory_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(50) NOT NULL,
    state VARCHAR(50),
    threshold NUMERIC(12, 2),
    rate NUMERIC(6, 4),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DELETE FROM statutory_rules;
INSERT INTO statutory_rules (id, rule_type, state, threshold, rate, effective_from, effective_to) VALUES
(1, 'PF_CEILING', NULL, 15000.00, 0.1200, '2014-09-01', NULL),
(2, 'ESI_CEILING', NULL, 21000.00, 0.0075, '2019-07-01', NULL),
(3, 'ESI_ER_RATE', NULL, 21000.00, 0.0325, '2019-07-01', NULL),
(4, 'PT_SLAB', 'KA', 25000.00, 0.0000, '2025-04-01', NULL);

SELECT setval('statutory_rules_id_seq', (SELECT MAX(id) FROM statutory_rules));

-- ==========================================================
-- 7. Sequenced Rules (Wage Code 2025 Compliant: BASIC, HRA, CONV, GROSS, PF, ESI, PTAX, TDS, NET)
-- ==========================================================
DELETE FROM salary_rules WHERE id > 9;

INSERT INTO salary_rules (id, structure_id, name, code, category, sequence, amount_type, amount, percentage_base) VALUES
(1, 1, 'Basic Pay (Wage Code Floor: 50%)', 'BASIC', 'BASIC', 10, 'percentage', 50.00, 'wage'),
(2, 1, 'House Rent Allowance', 'HRA', 'ALLOWANCE', 20, 'percentage', 40.00, 'BASIC'),
(3, 1, 'Conveyance Allowance', 'CONV', 'ALLOWANCE', 30, 'fixed', 1600.00, 'BASIC'),
(4, 1, 'Gross Earnings', 'GROSS', 'GROSS', 100, 'percentage', 100.00, 'GROSS'),
(5, 1, 'Employee PF (12% of Basic)', 'PF', 'DEDUCTION', 110, 'percentage', 12.00, 'BASIC'),
(6, 1, 'Employee ESI (0.75% of Gross)', 'ESI', 'DEDUCTION', 115, 'percentage', 0.75, 'GROSS'),
(7, 1, 'Professional Tax (Karnataka)', 'PTAX', 'DEDUCTION', 120, 'fixed', 0.00, 'GROSS'),
(8, 1, 'Tax Deducted at Source (TDS)', 'TDS', 'DEDUCTION', 130, 'fixed', 0.00, 'GROSS'),
(9, 1, 'Net Salary Payout', 'NET', 'NET', 200, 'percentage', 100.00, 'NET')
ON CONFLICT (id) DO UPDATE SET
    structure_id = EXCLUDED.structure_id,
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
(1, 'August 2026 Monthly Payroll', '2026-08-01', '2026-08-31', 'paid', 1, 67250.00, 137750.00, 127152.00, 13, 0)
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
(1, 1, 1, 1, 1, '2026-08-01', '2026-08-31', 11000.00, 17000.00, 1448.00, 15552.00, 'paid', FALSE, 'ACCT00010101', 'PPAY0001234', TRUE),
(2, 1, 2, 2, 1, '2026-08-01', '2026-08-31', 6250.00, 12250.00, 842.00, 11408.00, 'paid', FALSE, 'ACCT00020102', 'PPAY0001234', TRUE),
(3, 1, 3, 3, 1, '2026-08-01', '2026-08-31', 5000.00, 10500.00, 679.00, 9821.00, 'paid', FALSE, 'ACCT00030103', 'PPAY0001234', TRUE),
(4, 1, 4, 4, 1, '2026-08-01', '2026-08-31', 3750.00, 8750.00, 516.00, 8234.00, 'paid', FALSE, 'ACCT00040104', 'PPAY0001234', TRUE),
(5, 1, 5, 5, 1, '2026-08-01', '2026-08-31', 3500.00, 8400.00, 483.00, 7917.00, 'paid', FALSE, 'ACCT00050105', 'PPAY0001234', TRUE),
(6, 1, 6, 6, 1, '2026-08-01', '2026-08-31', 5750.00, 11550.00, 777.00, 10773.00, 'paid', FALSE, 'ACCT00060106', 'PPAY0001234', TRUE),
(7, 1, 7, 7, 1, '2026-08-01', '2026-08-31', 3000.00, 7700.00, 418.00, 7282.00, 'paid', FALSE, 'ACCT00070107', 'PPAY0001234', TRUE),
(8, 1, 8, 8, 1, '2026-08-01', '2026-08-31', 3250.00, 8050.00, 451.00, 7599.00, 'paid', FALSE, 'ACCT00080108', 'PPAY0001234', TRUE),
(9, 1, 9, 9, 1, '2026-08-01', '2026-08-31', 8250.00, 15050.00, 1103.00, 13947.00, 'paid', FALSE, 'ACCT00090109', 'PPAY0001234', TRUE),
(10, 1, 10, 10, 1, '2026-08-01', '2026-08-31', 4000.00, 9100.00, 549.00, 8551.00, 'paid', FALSE, 'ACCT00100110', 'PPAY0001234', TRUE),
(11, 1, 11, 11, 1, '2026-08-01', '2026-08-31', 3100.00, 7840.00, 431.00, 7409.00, 'paid', FALSE, 'ACCT00110111', 'PPAY0001234', TRUE),
(12, 1, 12, 12, 1, '2026-08-01', '2026-08-31', 7000.00, 13300.00, 940.00, 12360.00, 'paid', FALSE, 'ACCT00120112', 'PPAY0001234', TRUE),
(13, 1, 13, 13, 1, '2026-08-01', '2026-08-31', 3400.00, 8260.00, 470.00, 7790.00, 'paid', FALSE, 'ACCT00130113', 'PPAY0001234', TRUE)
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
-- 10. Payslip Lines (Snapshot Itemized Lines for Compliant Rules)
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
        WHEN r.code = 'CONV' THEN 1600.00
        WHEN r.code = 'GROSS' THEN p.gross_wage
        WHEN r.code = 'PF' THEN round(LEAST(p.basic_wage, 15000.00) * 0.12, 2)
        WHEN r.code = 'ESI' THEN ceil(p.gross_wage * 0.0075)
        WHEN r.code = 'PTAX' THEN CASE WHEN p.gross_wage >= 25000.00 THEN 200.00 ELSE 0.00 END
        WHEN r.code = 'TDS' THEN 0.00
        WHEN r.code = 'NET' THEN p.net_wage
        ELSE 0.00
    END AS total
FROM payslips p
CROSS JOIN salary_rules r
WHERE p.payrun_id = 1 AND r.structure_id = 1;

SELECT setval('payslip_lines_id_seq', (SELECT COALESCE(MAX(id), 1) FROM payslip_lines));

-- ==========================================================
-- 11. Authentication & System Users
-- ==========================================================
INSERT INTO users (id, email, hashed_password, role, employee_id, is_active, created_at, updated_at) VALUES
(1, 'superadmin@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'super_admin', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'hr.manager@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'hr_manager', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'payroll.officer@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'payroll_officer', 9, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'dept.manager@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'dept_manager', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'alex.johnson@peoplepay360.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'employee', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    employee_id = EXCLUDED.employee_id,
    is_active = EXCLUDED.is_active;

-- ==========================================================
-- 12. Shifts & Shift Assignments
-- ==========================================================
INSERT INTO shifts (id, name, start_time, end_time, grace_period_mins, created_at) VALUES
(1, 'General Day Shift (9 AM - 5 PM)', '09:00:00', '17:00:00', 15, CURRENT_TIMESTAMP),
(2, 'Morning Production Shift (6 AM - 2 PM)', '06:00:00', '14:00:00', 15, CURRENT_TIMESTAMP),
(3, 'Evening Support Shift (2 PM - 10 PM)', '14:00:00', '22:00:00', 15, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time;

INSERT INTO shift_assignments (id, employee_id, shift_id, start_date, is_active) VALUES
(1, 1, 1, '2026-01-01', TRUE),
(2, 2, 1, '2026-01-01', TRUE),
(3, 3, 1, '2026-01-01', TRUE),
(4, 4, 1, '2026-01-01', TRUE),
(5, 5, 2, '2026-01-01', TRUE)
ON CONFLICT (id) DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    shift_id = EXCLUDED.shift_id;

-- ==========================================================
-- 13. Attendance Records
-- ==========================================================
INSERT INTO attendance_records (id, employee_id, date, clock_in, clock_out, worked_hours, overtime_hours, status) VALUES
(1, 1, '2026-08-01', '2026-08-01 09:02:00', '2026-08-01 17:35:00', 8.55, 0.55, 'present'),
(2, 2, '2026-08-01', '2026-08-01 08:58:00', '2026-08-01 17:05:00', 8.12, 0.12, 'present'),
(3, 3, '2026-08-01', '2026-08-01 09:20:00', '2026-08-01 17:00:00', 7.67, 0.00, 'late'),
(4, 4, '2026-08-01', NULL, NULL, 0.00, 0.00, 'on_leave'),
(5, 5, '2026-08-01', '2026-08-01 06:01:00', '2026-08-01 15:30:00', 9.48, 1.48, 'present')
ON CONFLICT (id) DO UPDATE SET
    worked_hours = EXCLUDED.worked_hours,
    status = EXCLUDED.status;

-- ==========================================================
-- 14. Employee Loans & Salary Advances
-- ==========================================================
INSERT INTO employee_loans (id, employee_id, loan_type, principal_amount, interest_rate, tenure_months, monthly_emi, remaining_balance, status, created_at) VALUES
(1, 3, 'personal_loan', 120000.00, 8.5, 12, 10467.58, 83740.64, 'active', CURRENT_TIMESTAMP),
(2, 5, 'salary_advance', 25000.00, 0.0, 3, 8333.33, 16666.67, 'active', CURRENT_TIMESTAMP),
(3, 7, 'emergency_loan', 50000.00, 5.0, 6, 8455.20, 50000.00, 'approved', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    remaining_balance = EXCLUDED.remaining_balance,
    status = EXCLUDED.status;

-- ==========================================================
-- 15. Expense Claims & Reimbursements
-- ==========================================================
INSERT INTO expense_claims (id, employee_id, category, amount, currency, expense_date, description, receipt_url, status, approved_by, created_at, updated_at) VALUES
(1, 3, 'travel', 4500.00, 'INR', '2026-08-10', 'Client site visit cab fares and regional train passes', 'https://example.com/receipts/cab_101.pdf', 'approved', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 5, 'food', 1250.00, 'INR', '2026-08-12', 'Team quarterly retrospective dinner', 'https://example.com/receipts/dinner_202.pdf', 'approved', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 2, 'office_supplies', 8900.00, 'INR', '2026-08-15', 'Ergonomic dual-monitor arms and desk accessories', 'https://example.com/receipts/monitor_arm.pdf', 'submitted', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status;

-- ==========================================================
-- 16. Statutory Tax Declarations
-- ==========================================================
INSERT INTO tax_declarations (id, employee_id, financial_year, regime, section_80c_amount, section_80d_amount, hra_rent_paid, home_loan_interest, status, remarks, created_at, updated_at) VALUES
(1, 1, '2024-2025', 'new', 150000.00, 25000.00, 180000.00, 0.00, 'verified', 'Executive annual declaration approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 3, '2024-2025', 'old', 150000.00, 25000.00, 144000.00, 120000.00, 'verified', 'Home loan certificate verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 5, '2024-2025', 'new', 80000.00, 15000.00, 96000.00, 0.00, 'submitted', 'ELSS proof attached', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    regime = EXCLUDED.regime,
    status = EXCLUDED.status;

-- ==========================================================
-- 17. Notification Logs
-- ==========================================================
INSERT INTO notification_logs (id, recipient_email, recipient_name, notification_type, subject, body, attachment_name, status, sent_at, created_at) VALUES
(1, 'john.doe@example.com', 'John Doe', 'payslip_email', 'PeoplePay360 Payslip for August 2026 - John Doe', 'Dear John, Please find attached your payslip.', 'Payslip_August_2026_John_Doe.pdf', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'jane.smith@example.com', 'Jane Smith', 'payslip_email', 'PeoplePay360 Payslip for August 2026 - Jane Smith', 'Dear Jane, Please find attached your payslip.', 'Payslip_August_2026_Jane_Smith.pdf', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'alex.johnson@peoplepay360.com', 'Alex Johnson', 'loan_update', 'Loan Application #1 Approved', 'Your loan application has been approved by HR.', NULL, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status;
