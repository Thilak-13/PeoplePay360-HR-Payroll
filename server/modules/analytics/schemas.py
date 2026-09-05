from typing import List, Optional
from pydantic import BaseModel, Field


class KPIsSummary(BaseModel):
    total_net_paid: float = Field(..., description="Total net payout across all historical paid payslips")
    payslip_count: int = Field(..., description="Total number of paid payslips generated")
    avg_salary: float = Field(..., description="Average base salary / wage across active employee contracts")
    approved_leave_days: float = Field(..., description="Total cumulative approved leave days recorded")
    total_gross_paid: float = Field(0.0, description="Total gross earnings paid out")
    active_employees_count: int = Field(0, description="Total active headcount in the organization")
    total_payruns_count: int = Field(0, description="Total payrun batches created")


class DepartmentSpendItem(BaseModel):
    department_id: Optional[int] = None
    department_name: str
    department_code: Optional[str] = None
    employee_count: int = 0
    total_net: float = 0.0
    total_gross: float = 0.0
    spend: float = Field(0.0, description="Primary spend value for chart visualization")


class ComplianceAlertItem(BaseModel):
    id: str
    type: str  # 'missing_banking', 'duplicate_batch', 'uncontracted'
    title: str
    message: str
    severity: str  # 'critical', 'warning', 'info'
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    action_url: Optional[str] = None


class DashboardAnalyticsResponse(BaseModel):
    kpis: KPIsSummary
    department_spend: List[DepartmentSpendItem]
    compliance_alerts: List[ComplianceAlertItem]


class DispatchToast(BaseModel):
    type: str = "success"
    title: str
    description: str


class SendPayslipsResponse(BaseModel):
    success: bool = True
    payrun_id: int
    dispatched_count: int
    message: str
    toast: DispatchToast
