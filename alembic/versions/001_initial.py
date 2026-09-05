"""Initial migration: master data models, leave_types enum table, and foreign key constraints

Revision ID: 001_initial
Revises: 
Create Date: 2026-09-05 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create leave_types enum / lookup table
    leave_types_table = op.create_table(
        "leave_types",
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("code"),
    )
    op.create_index(op.f("ix_leave_types_code"), "leave_types", ["code"], unique=False)

    # Seed default leave types for standard HR operations
    op.bulk_insert(
        leave_types_table,
        [
            {
                "code": "paid_time_off",
                "name": "Paid Time Off",
                "description": "Standard annual paid vacation and leave",
                "is_paid": True,
            },
            {
                "code": "sick_leave",
                "name": "Sick Leave",
                "description": "Medical and health-related sick leave",
                "is_paid": True,
            },
            {
                "code": "unpaid_leave",
                "name": "Unpaid Leave",
                "description": "Authorized leave without pay",
                "is_paid": False,
            },
            {
                "code": "casual_leave",
                "name": "Casual Leave",
                "description": "Casual emergency and short-term leave",
                "is_paid": True,
            },
        ],
    )

    # 2. Create working_schedules table
    op.create_table(
        "working_schedules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("hours_per_week", sa.Numeric(precision=5, scale=2), server_default="40.00", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_working_schedules_id"), "working_schedules", ["id"], unique=False)
    op.create_index(op.f("ix_working_schedules_name"), "working_schedules", ["name"], unique=False)

    # 3. Create departments table (manager_id FK added after employees table creation to handle circular ref)
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("manager_id", sa.Integer(), nullable=True),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_departments_code"), "departments", ["code"], unique=True)
    op.create_index(op.f("ix_departments_id"), "departments", ["id"], unique=False)
    op.create_index(op.f("ix_departments_name"), "departments", ["name"], unique=True)

    # 4. Create employees table
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False),
        sa.Column("last_name", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("working_schedule_id", sa.Integer(), nullable=True),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("bank_account_number", sa.String(length=50), nullable=True),
        sa.Column("bank_ifsc", sa.String(length=20), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["working_schedule_id"], ["working_schedules.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employees_email"), "employees", ["email"], unique=True)
    op.create_index(op.f("ix_employees_id"), "employees", ["id"], unique=False)

    # 5. Add FK constraint on Department.manager_id -> employees.id
    op.create_foreign_key(
        "fk_departments_manager_id_employees",
        "departments",
        "employees",
        ["manager_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 6. Create contracts table
    op.create_table(
        "contracts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("wage", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("contract_type", sa.String(length=50), server_default="full_time", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.CheckConstraint("wage > 0", name="check_contract_wage_positive"),
        sa.CheckConstraint("end_date IS NULL OR end_date >= start_date", name="check_contract_dates_valid"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contracts_employee_id"), "contracts", ["employee_id"], unique=False)
    op.create_index(op.f("ix_contracts_id"), "contracts", ["id"], unique=False)

    # 7. Create leave_allocations table with FK holiday_type -> leave_types.code
    op.create_table(
        "leave_allocations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("holiday_type", sa.String(length=50), nullable=False),
        sa.Column("number_of_days", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="approved", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["holiday_type"], ["leave_types.code"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leave_allocations_employee_id"), "leave_allocations", ["employee_id"], unique=False)
    op.create_index(op.f("ix_leave_allocations_holiday_type"), "leave_allocations", ["holiday_type"], unique=False)
    op.create_index(op.f("ix_leave_allocations_id"), "leave_allocations", ["id"], unique=False)

    # 8. Create leave_requests table with FK holiday_type -> leave_types.code
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("holiday_type", sa.String(length=50), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("number_of_days", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.CheckConstraint("date_to >= date_from", name="check_leave_dates_valid"),
        sa.CheckConstraint("number_of_days > 0", name="check_leave_days_positive"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["holiday_type"], ["leave_types.code"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leave_requests_employee_id"), "leave_requests", ["employee_id"], unique=False)
    op.create_index(op.f("ix_leave_requests_holiday_type"), "leave_requests", ["holiday_type"], unique=False)
    op.create_index(op.f("ix_leave_requests_id"), "leave_requests", ["id"], unique=False)


def downgrade() -> None:
    # 1. Drop leave_requests
    op.drop_index(op.f("ix_leave_requests_id"), table_name="leave_requests")
    op.drop_index(op.f("ix_leave_requests_holiday_type"), table_name="leave_requests")
    op.drop_index(op.f("ix_leave_requests_employee_id"), table_name="leave_requests")
    op.drop_table("leave_requests")

    # 2. Drop leave_allocations
    op.drop_index(op.f("ix_leave_allocations_id"), table_name="leave_allocations")
    op.drop_index(op.f("ix_leave_allocations_holiday_type"), table_name="leave_allocations")
    op.drop_index(op.f("ix_leave_allocations_employee_id"), table_name="leave_allocations")
    op.drop_table("leave_allocations")

    # 3. Drop contracts
    op.drop_index(op.f("ix_contracts_id"), table_name="contracts")
    op.drop_index(op.f("ix_contracts_employee_id"), table_name="contracts")
    op.drop_table("contracts")

    # 4. Drop FK on departments.manager_id before dropping employees
    op.drop_constraint("fk_departments_manager_id_employees", "departments", type_="foreignkey")

    # 5. Drop employees
    op.drop_index(op.f("ix_employees_id"), table_name="employees")
    op.drop_index(op.f("ix_employees_email"), table_name="employees")
    op.drop_table("employees")

    # 6. Drop departments
    op.drop_index(op.f("ix_departments_name"), table_name="departments")
    op.drop_index(op.f("ix_departments_id"), table_name="departments")
    op.drop_index(op.f("ix_departments_code"), table_name="departments")
    op.drop_table("departments")

    # 7. Drop working_schedules
    op.drop_index(op.f("ix_working_schedules_name"), table_name="working_schedules")
    op.drop_index(op.f("ix_working_schedules_id"), table_name="working_schedules")
    op.drop_table("working_schedules")

    # 8. Drop leave_types
    op.drop_index(op.f("ix_leave_types_code"), table_name="leave_types")
    op.drop_table("leave_types")
