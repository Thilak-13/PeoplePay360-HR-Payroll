-- Seed Data for PeoplePay360
-- Lead Integrator (Developer 3) Seed Data for Master Data & Payroll Modules

-- 1. Departments
INSERT INTO departments (id, name, code) VALUES
(1, 'Engineering', 'ENG'),
(2, 'Human Resources', 'HR'),
(3, 'Finance', 'FIN')
ON CONFLICT (id) DO NOTHING;

-- 2. Working Schedules
INSERT INTO working_schedules (id, name, hours_per_week) VALUES
(1, 'Standard Full-Time (40h)', 40.00),
(2, 'Part-Time (20h)', 20.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Employees
INSERT INTO employees (id, first_name, last_name, email, phone, department_id, working_schedule_id, job_title, hire_date, status) VALUES
(1, 'Alice', 'Johnson', 'alice.johnson@peoplepay360.local', '+1-555-0101', 1, 1, 'Senior Software Engineer', '2023-01-15', 'active'),
(2, 'Bob', 'Smith', 'bob.smith@peoplepay360.local', '+1-555-0102', 2, 1, 'HR Specialist', '2023-03-01', 'active'),
(3, 'Charlie', 'Brown', 'charlie.brown@peoplepay360.local', '+1-555-0103', 3, 1, 'Financial Analyst', '2023-06-10', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Contracts
INSERT INTO contracts (id, employee_id, wage, contract_type, start_date, status) VALUES
(1, 1, 8500.00, 'full_time', '2023-01-15', 'running'),
(2, 2, 6000.00, 'full_time', '2023-03-01', 'running'),
(3, 3, 6500.00, 'full_time', '2023-06-10', 'running')
ON CONFLICT (id) DO NOTHING;

-- 5. Leave Allocations
INSERT INTO leave_allocations (id, employee_id, holiday_type, number_of_days, year, status) VALUES
(1, 1, 'Paid Time Off', 25.00, 2026, 'approved'),
(2, 2, 'Paid Time Off', 25.00, 2026, 'approved'),
(3, 3, 'Paid Time Off', 25.00, 2026, 'approved')
ON CONFLICT (id) DO NOTHING;

-- 6. Leave Requests
INSERT INTO leave_requests (id, employee_id, holiday_type, date_from, date_to, number_of_days, status) VALUES
(1, 1, 'Paid Time Off', '2026-07-01', '2026-07-05', 5.00, 'approved')
ON CONFLICT (id) DO NOTHING;

-- 7. Salary Structures
INSERT INTO salary_structures (id, name, code) VALUES
(1, 'Base Salary Structure', 'BASE_STRUCT'),
(2, 'Management Structure', 'MGMT_STRUCT')
ON CONFLICT (id) DO NOTHING;

-- 8. Salary Rules
INSERT INTO salary_rules (id, structure_id, name, code, category, sequence, amount_type, amount) VALUES
(1, 1, 'Basic Salary', 'BASIC', 'BASIC', 10, 'fixed', 0.00),
(2, 1, 'Housing Allowance', 'HRA', 'ALW', 20, 'percentage', 20.00),
(3, 1, 'Gross Salary', 'GROSS', 'GROSS', 50, 'code', 0.00),
(4, 1, 'Income Tax', 'TAX', 'DED', 80, 'percentage', 10.00),
(5, 1, 'Net Salary', 'NET', 'NET', 100, 'code', 0.00)
ON CONFLICT (id) DO NOTHING;

-- 9. Payruns
INSERT INTO payruns (id, name, date_start, date_end, status) VALUES
(1, 'August 2026 Monthly Payroll', '2026-08-01', '2026-08-31', 'close'),
(2, 'September 2026 Monthly Payroll', '2026-09-01', '2026-09-30', 'draft')
ON CONFLICT (id) DO NOTHING;

-- 10. Payslips
INSERT INTO payslips (id, payrun_id, employee_id, contract_id, structure_id, date_from, date_to, basic_wage, gross_wage, net_wage, status) VALUES
(1, 1, 1, 1, 1, '2026-08-01', '2026-08-31', 8500.00, 10200.00, 9180.00, 'done'),
(2, 1, 2, 2, 1, '2026-08-01', '2026-08-31', 6000.00, 7200.00, 6480.00, 'done'),
(3, 1, 3, 3, 1, '2026-08-01', '2026-08-31', 6500.00, 7800.00, 7020.00, 'done')
ON CONFLICT (id) DO NOTHING;

-- 11. Payslip Lines
INSERT INTO payslip_lines (id, payslip_id, salary_rule_id, name, code, category, rate, amount, total) VALUES
(1, 1, 1, 'Basic Salary', 'BASIC', 'BASIC', 100.00, 8500.00, 8500.00),
(2, 1, 2, 'Housing Allowance', 'HRA', 'ALW', 100.00, 1700.00, 1700.00),
(3, 1, 3, 'Gross Salary', 'GROSS', 'GROSS', 100.00, 10200.00, 10200.00),
(4, 1, 4, 'Income Tax', 'TAX', 'DED', 100.00, -1020.00, -1020.00),
(5, 1, 5, 'Net Salary', 'NET', 'NET', 100.00, 9180.00, 9180.00)
ON CONFLICT (id) DO NOTHING;
