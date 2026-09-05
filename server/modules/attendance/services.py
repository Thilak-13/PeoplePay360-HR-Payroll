from datetime import datetime, date, time as dt_time, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from server.modules.attendance.models import AttendanceRecord, Shift, ShiftAssignment
from server.modules.master_data.models import Employee, LeaveRequest


class AttendanceService:
    @staticmethod
    def record_punch(
        db: Session,
        employee_id: int,
        punch_type: str,
        punch_time: Optional[datetime] = None,
        notes: Optional[str] = None
    ) -> AttendanceRecord:
        """Record clock-in or clock-out and compute worked/overtime hours."""
        ts = punch_time or datetime.now(timezone.utc)
        today = ts.date()

        # Find employee
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise ValueError(f"Employee with ID {employee_id} not found")

        # Get existing record for today
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today
        ).first()

        # Find active shift to check grace period
        assignment = db.query(ShiftAssignment).filter(
            ShiftAssignment.employee_id == employee_id,
            ShiftAssignment.start_date <= today,
            or_(ShiftAssignment.end_date == None, ShiftAssignment.end_date >= today)
        ).first()
        shift = assignment.shift if assignment else None

        if punch_type == "in":
            if not record:
                # Determine if late
                status = "present"
                if shift:
                    try:
                        sh_hour, sh_min = map(int, shift.start_time.split(":"))
                        shift_start_dt = datetime.combine(today, dt_time(sh_hour, sh_min))
                        grace_cutoff = shift_start_dt + timedelta(minutes=shift.grace_period_mins)
                        if ts > grace_cutoff:
                            status = "late"
                    except Exception:
                        pass

                record = AttendanceRecord(
                    employee_id=employee_id,
                    date=today,
                    clock_in=ts,
                    status=status,
                    notes=notes
                )
                db.add(record)
            else:
                record.clock_in = ts
                if notes:
                    record.notes = (record.notes or "") + f" | In: {notes}"
        elif punch_type == "out":
            if not record:
                # If no clock in recorded, create entry starting at timestamp
                record = AttendanceRecord(
                    employee_id=employee_id,
                    date=today,
                    clock_out=ts,
                    status="present",
                    notes=notes or "Clock-out without clock-in"
                )
                db.add(record)
            else:
                record.clock_out = ts
                if notes:
                    record.notes = (record.notes or "") + f" | Out: {notes}"

            # Calculate worked hours if clock_in exists
            if record.clock_in and record.clock_out:
                duration_secs = max(0, (record.clock_out - record.clock_in).total_seconds())
                raw_hours = Decimal(str(round(duration_secs / 3600.0, 2)))
                
                # Deduct break if worked more than 5 hours
                break_hrs = shift.break_hours if shift else Decimal("1.00")
                worked = raw_hours - break_hrs if raw_hours > 5.0 else raw_hours
                worked = max(Decimal("0.00"), worked)
                record.worked_hours = round(worked, 2)

                # Overtime is anything over 8.0 standard hours
                if record.worked_hours > Decimal("8.00"):
                    record.overtime_hours = round(record.worked_hours - Decimal("8.00"), 2)
                else:
                    record.overtime_hours = Decimal("0.00")

                # Update half-day status if worked between 3 and 5 hours
                if Decimal("3.00") <= record.worked_hours < Decimal("6.00") and record.status != "late":
                    record.status = "half_day"

        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_daily_summary(db: Session, target_date: date) -> Dict[str, Any]:
        """Aggregate all employee punches for a target date."""
        records = db.query(AttendanceRecord).filter(AttendanceRecord.date == target_date).all()
        total_employees = db.query(Employee).filter(Employee.status == "active").count()

        present_cnt = sum(1 for r in records if r.status in ["present", "late"])
        absent_cnt = sum(1 for r in records if r.status == "absent")
        late_cnt = sum(1 for r in records if r.status == "late")
        half_day_cnt = sum(1 for r in records if r.status == "half_day")
        total_hrs = sum(float(r.worked_hours) for r in records)

        return {
            "date": target_date,
            "total_records": len(records),
            "present_count": present_cnt,
            "absent_count": absent_cnt,
            "late_count": late_cnt,
            "half_day_count": half_day_cnt,
            "total_hours_worked": round(total_hrs, 2),
            "records": records,
        }

    @staticmethod
    def get_employee_monthly(db: Session, employee_id: int, year: int, month: int) -> Dict[str, Any]:
        """Monthly attendance calendar & summary for an employee."""
        from calendar import monthrange
        _, last_day = monthrange(year, month)
        start_d = date(year, month, 1)
        end_d = date(year, month, last_day)

        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date >= start_d,
            AttendanceRecord.date <= end_d
        ).order_by(AttendanceRecord.date.asc()).all()

        total_worked = sum(float(r.worked_hours) for r in records)
        total_ot = sum(float(r.overtime_hours) for r in records)
        present = sum(1 for r in records if r.status in ["present", "late"])
        absent = sum(1 for r in records if r.status == "absent")
        late = sum(1 for r in records if r.status == "late")
        half = sum(1 for r in records if r.status == "half_day")

        return {
            "employee_id": employee_id,
            "year": year,
            "month": month,
            "total_worked_hours": round(total_worked, 2),
            "total_overtime_hours": round(total_ot, 2),
            "present_days": present,
            "absent_days": absent,
            "late_days": late,
            "half_days": half,
            "records": records,
        }

    @staticmethod
    def get_unpaid_absences(db: Session, employee_id: int, start_date: date, end_date: date) -> Dict[str, Any]:
        """Calculate unpaid absent days (LOP) within a date range for payroll integration."""
        # Query attendance records in date range
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date
        ).all()
        
        record_map = {r.date: r for r in records}

        # Query approved leaves in date range
        leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == "approved",
            LeaveRequest.date_from <= end_date,
            LeaveRequest.date_to >= start_date
        ).all()

        approved_dates = set()
        for lv in leaves:
            cur = max(lv.date_from, start_date)
            limit = min(lv.date_to, end_date)
            while cur <= limit:
                approved_dates.add(cur)
                cur += timedelta(days=1)

        unpaid_dates: List[date] = []
        cur_d = start_date
        while cur_d <= end_date:
            # Skip Saturday (5) and Sunday (6) as standard weekend
            if cur_d.weekday() < 5 and cur_d not in approved_dates:
                rec = record_map.get(cur_d)
                if rec:
                    if rec.status == "absent":
                        unpaid_dates.append(cur_d)
                else:
                    # If date is past today and no record exists, count as absent
                    if cur_d <= date.today():
                        unpaid_dates.append(cur_d)
            cur_d += timedelta(days=1)

        absent_days = float(len(unpaid_dates))
        lop_hours = round(absent_days * 8.0, 2)

        return {
            "employee_id": employee_id,
            "start_date": start_date,
            "end_date": end_date,
            "absent_days": absent_days,
            "lop_hours": lop_hours,
            "unpaid_dates": unpaid_dates,
        }
