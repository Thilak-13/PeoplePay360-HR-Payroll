# Design Specification: Weekly Working Hours Calculation & Salary Categorization

**Date:** 2026-09-06  
**Status:** Approved  
**Topic:** Weekly Working Hours Calculation from Check-in/Check-out, Three Salary Categories, Overtime Bonuses, and Leave Type Deductions  

---

## 1. Executive Summary
This feature computes the weekly working hours for each employee across any calendar month using raw attendance check-in and check-out timestamps (`attendance_records`). Based on their average weekly hours, employees are dynamically classified into one of three salary categories:
1. **Executive Schedule (>= 45 hrs/week)**: Full salary + overtime bonus for hours > 40 hrs/wk (1.5x base hourly rate).
2. **Standard Full-Time (40 - 44.9 hrs/week)**: Full contract base wage (100%) + standard overtime on excess hours (1.25x).
3. **Part-Time Schedule (20 - 39.9 hrs/week)**: Prorated wage based on worked hours ratio (Worked Hours / Standard Monthly Hours 160h). (Under 20 hrs/wk incurs additional Loss of Pay / LOP status).

Salary adjustments also dynamically incorporate leave deductions determined by the leave type (paid, casual, sick -> zero deduction; unpaid, lop -> daily wage deduction).

---

## 2. Architecture & Computational Engine

### 2.1 Weekly Partitioning
For a given month M and year Y:
- Week 1: Days 1 to 7
- Week 2: Days 8 to 14
- Week 3: Days 15 to 21
- Week 4: Days 22 to 28
- Week 5: Day 29 through the last day of the month

### 2.2 Attendance Aggregation
For each employee in the period:
- `worked_hours` is summed per week from `attendance_records` where `date` falls in the respective week range.
- Overtime hours are calculated per week for hours exceeding 40.0 hrs.
- Hourly base rate is derived from the employee active contract wage:
- Overtime bonus:
  - For Executive category (>= 45 hrs/wk): Total OT Hours * Hourly Rate * 1.5
  - For Standard category (40 - 44.9 hrs/wk): Total OT Hours * Hourly Rate * 1.25
  - For Part-Time category (< 40 hrs/wk): 0 OT bonus.

### 2.3 Leave Deductions by Type
From leave_requests within the month:
- paid, casual, sick: 0 deduction.
- unpaid, lop: Deducted per day: Monthly Contract Wage / Working Days in Month


---

## 3. Backend Implementation Details

### 3.1 New Service Method
server/modules/attendance/services.py:
- AttendanceService.get_weekly_working_hours(db: Session, employee_id: Optional[int], year: int, month: int)

### 3.2 REST API Endpoints
server/modules/attendance/router.py:
- GET /api/v1/attendance/weekly-hours

### 3.3 Payroll Engine Integration
server/modules/payroll/engine.py:
- In compute_single_payslip, injects OVERTIME_BONUS and LOP_LEAVE_DEDUCTION lines.

---

## 4. Frontend User Interface
client/src/pages/attendance/WeeklyHoursSummary.tsx

---

## 5. Verification Plan
1. Unit tests in server/modules/attendance/test_weekly_hours.py
2. npm run build & pytest server/modules