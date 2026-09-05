from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from server.modules.master_data.database import get_db, Base, engine
from server.modules.master_data.models import Employee
from server.modules.attendance.models import AttendanceRecord, Shift, ShiftAssignment
from server.modules.attendance.schemas import (
    PunchRequest,
    AttendanceRecordResponse,
    DailySummaryResponse,
    MonthlyAttendanceSummary,
    UnpaidAbsenceResponse,
    ShiftCreate,
    ShiftResponse,
    ShiftAssignmentCreate,
    ShiftAssignmentResponse,
)
from server.modules.attendance.services import AttendanceService

# Ensure attendance tables exist
Base.metadata.create_all(bind=engine)

router = APIRouter()


@router.get("/ping", tags=["Attendance"])
def ping():
    """Health ping for Attendance domain."""
    return {"module": "attendance_ready"}


@router.post("/punch", response_model=AttendanceRecordResponse, tags=["Attendance"])
def record_punch(req: PunchRequest, db: Session = Depends(get_db)):
    """Record clock-in or clock-out punch for an employee."""
    try:
        record = AttendanceService.record_punch(
            db=db,
            employee_id=req.employee_id,
            punch_type=req.punch_type,
            punch_time=req.timestamp,
            notes=req.notes
        )
        return AttendanceRecordResponse.model_validate(record)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/daily-summary", response_model=DailySummaryResponse, tags=["Attendance"])
def get_daily_summary(
    target_date: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db)
):
    """Get aggregate attendance punches and metrics for a specific date."""
    d = target_date or date.today()
    summary = AttendanceService.get_daily_summary(db, d)
    return DailySummaryResponse(
        date=summary["date"],
        total_records=summary["total_records"],
        present_count=summary["present_count"],
        absent_count=summary["absent_count"],
        late_count=summary["late_count"],
        half_day_count=summary["half_day_count"],
        total_hours_worked=summary["total_hours_worked"],
        records=[AttendanceRecordResponse.model_validate(r) for r in summary["records"]]
    )


@router.get("/employee/{employee_id}/monthly", response_model=MonthlyAttendanceSummary, tags=["Attendance"])
def get_employee_monthly_attendance(
    employee_id: int,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Get full monthly punch details and aggregate hours for an employee."""
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month
    data = AttendanceService.get_employee_monthly(db, employee_id, y, m)
    return MonthlyAttendanceSummary(
        employee_id=data["employee_id"],
        year=data["year"],
        month=data["month"],
        total_worked_hours=data["total_worked_hours"],
        total_overtime_hours=data["total_overtime_hours"],
        present_days=data["present_days"],
        absent_days=data["absent_days"],
        late_days=data["late_days"],
        half_days=data["half_days"],
        records=[AttendanceRecordResponse.model_validate(r) for r in data["records"]]
    )


@router.get("/unpaid-absences/{employee_id}", response_model=UnpaidAbsenceResponse, tags=["Attendance"])
def get_unpaid_absences(
    employee_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Query LOP (unpaid absenteeism) within a period for payroll deductions."""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before or equal to end_date")
    result = AttendanceService.get_unpaid_absences(db, employee_id, start_date, end_date)
    return UnpaidAbsenceResponse(**result)


@router.get("/shifts", response_model=List[ShiftResponse], tags=["Attendance"])
def list_shifts(db: Session = Depends(get_db)):
    """List all company working shifts."""
    shifts = db.query(Shift).all()
    return [ShiftResponse.model_validate(s) for s in shifts]


@router.post("/shifts", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED, tags=["Attendance"])
def create_shift(req: ShiftCreate, db: Session = Depends(get_db)):
    """Create a new working shift."""
    shift = Shift(
        name=req.name,
        start_time=req.start_time,
        end_time=req.end_time,
        break_hours=req.break_hours,
        grace_period_mins=req.grace_period_mins
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return ShiftResponse.model_validate(shift)


@router.get("/shift-assignments", response_model=List[ShiftAssignmentResponse], tags=["Attendance"])
def list_shift_assignments(
    employee_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db)
):
    """List employee shift assignments."""
    q = db.query(ShiftAssignment)
    if employee_id:
        q = q.filter(ShiftAssignment.employee_id == employee_id)
    assignments = q.all()
    return [ShiftAssignmentResponse.model_validate(a) for a in assignments]


@router.post("/shift-assignments", response_model=ShiftAssignmentResponse, status_code=status.HTTP_201_CREATED, tags=["Attendance"])
def assign_shift(req: ShiftAssignmentCreate, db: Session = Depends(get_db)):
    """Assign an employee to a shift."""
    emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    shift = db.query(Shift).filter(Shift.id == req.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    assignment = ShiftAssignment(
        employee_id=req.employee_id,
        shift_id=req.shift_id,
        start_date=req.start_date,
        end_date=req.end_date
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return ShiftAssignmentResponse.model_validate(assignment)


@router.post("/seed-sample-records", tags=["Attendance"])
def seed_sample_records(db: Session = Depends(get_db)):
    """Seed sample shifts and daily attendance records."""
    # 1. Create Default General Shift
    default_shift = db.query(Shift).filter(Shift.name == "General Day Shift (9-6)").first()
    if not default_shift:
        default_shift = Shift(
            name="General Day Shift (9-6)",
            start_time="09:00",
            end_time="18:00",
            break_hours=1.00,
            grace_period_mins=15
        )
        db.add(default_shift)
        db.commit()
        db.refresh(default_shift)

    # 2. Seed punch records for top 5 employees for today
    employees = db.query(Employee).limit(5).all()
    today = date.today()
    created = 0
    for i, emp in enumerate(employees):
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today
        ).first()
        if not rec:
            in_hour = 9 if i % 2 == 0 else 9
            in_min = 10 if i == 1 else 0
            cin = datetime.combine(today, dt_time(in_hour, in_min))
            cout = datetime.combine(today, dt_time(18, 30))
            worked = Decimal("8.50")
            ot = Decimal("0.50")
            status_val = "late" if in_min > 15 else "present"

            r = AttendanceRecord(
                employee_id=emp.id,
                date=today,
                clock_in=cin,
                clock_out=cout,
                worked_hours=worked,
                overtime_hours=ot,
                status=status_val,
                notes="Biometric punch synced"
            )
            db.add(r)
            created += 1

    db.commit()
    return {"status": "seeded", "records_created": created}
