# Original User Request

## Initial Request — 2026-09-05T22:00:47Z

Audit the existing PeoplePay360 HR & Payroll application against the complete hackathon specification. Identify every missing, partial, vague, mocked, hardcoded, or incorrectly implemented requirement, then implement the required functionality without rebuilding or unnecessarily changing working parts of the application.

Working directory: C:\Users\munch\Downloads\odoo project
Integrity mode: development

Prioritize real business logic and end-to-end functionality: employee management, contracts, period-specific contract selection, working schedules, attendance, time off allocations and balance consumption, salary structures, sequenced salary rules, payrun wizard, payroll computation, validation and warnings, duplicate payslip detection, payslip PDFs, bulk email delivery, RBAC, historical payroll, and live dashboard analytics.

All configuration must drive actual application behavior. No static dashboards, fake calculations, placeholder buttons, mocked workflows, or hardcoded payroll logic.

## Requirements

### R1. Contracts, Schedules, & Working Hours
- Inspect and implement period-based contract selection (ensuring payroll computation resolves the specific active contract governing the pay period dates).
- Enforce strict overlapping contract validation to prevent concurrent overlapping active contracts for the same employee.
- Provide automated working schedule hour calculations based on working schedule shifts and calendar days.

### R2. Time-Off Allocations & Balance Consumption
- Support multi-type leave allocations (paid time off, sick leave, etc.) with explicit approval workflows.
- Ensure time-off request approval dynamically deducts from approved leave balances and blocks requests when balances are insufficient or dates overlap.

### R3. Dynamic Salary Structures & Rule Sequencing Engine
- Ensure salary structures support fully configurable, sequenced salary rules (categories: BASIC, ALLOWANCE, GROSS, DEDUCTION, NET).
- Execute calculation rules strictly by sequence order supporting fixed amounts, percentage bases (e.g. % of BASIC or % of GROSS), and dynamic adjustments.
- Enforce statutory Code on Wages (50% basic floor), EPF ceiling, ESI ceiling, and Tamil Nadu / Chennai Professional Tax without hardcoded shortcuts.

### R4. Two-Step Payrun Wizard, Validations, & Duplicate Prevention
- Two-step payrun generation workflow: Step 1 (Period selection & batch parameters) -> Step 2 (Employee selection grid with inline compliance & bank status checks) -> Confirm.
- Enforce validation barrier blocking 'draft' -> 'validated' transitions if critical compliance warnings (e.g. missing verified bank accounts) exist.
- Prevent duplicate payslip generation for the same employee within overlapping pay periods.

### R5. Document Generation, Notifications, RBAC, & Live Analytics
- Generate downloadable/printable payslip PDFs matching the enterprise layout with earnings, statutory deductions, employer contributions, and net pay.
- Provide bulk email delivery with delivery status tracking.
- Enforce server-side role-based access control across all API endpoints (Admin, HR Manager, HR Payroll User, HR Payroll Manager, Employee).
- Ensure historical payroll records remain immutable once marked 'paid'.
- Drive dashboard analytics and metric cards from live database queries (headcount, active contracts, total payroll payout, pending leaves) with time-range filtering.

## Acceptance Criteria

### Execution & Architecture Guardrails
- [ ] Inspect first, modify second: Existing working endpoints, UI flows, and test suites are preserved without whole-project rewrites.
- [ ] Zero mocked workflows: No placeholder buttons, mocked API responses, or static stub dashboards in production routes.

### End-to-End Workflow Verification
- [ ] Employee-to-Payslip flow functions end-to-end: Contract creation -> Payrun generation via wizard -> Computation with sequenced rules -> Validation barrier check -> Payslip PDF rendering.
- [ ] Allocation-to-Leave flow functions end-to-end: Allocation grant -> Leave request submission -> Manager approval -> Leave balance decrement and attendance reflection.
- [ ] Period-based contract resolution correctly picks the active contract spanning the pay period dates.
- [ ] Validation barrier strictly blocks finalizing payruns containing unaddressed critical warnings.

### Regression & Compliance Reporting
- [ ] All existing automated test suites pass cleanly without regressions.
- [ ] A comprehensive requirement-by-requirement compliance report is generated with explicit status tags: PASS, PARTIAL, FAIL, or RISK.
