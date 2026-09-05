from typing import List, Optional
from pydantic import BaseModel, Field


class KPIsSummary(BaseModel):
    total_net_paid: float = Field(..., description="Total net payout across all historical paid payslips")
    total_payslips: int = Field(0, description="Total number of paid payslips generated")
    payslip_count: int = Field(0, description="Total number of paid payslips generated")
    avg_salary: float = Field(..., description="Average base salary / wage across active employee contracts")
    approved_leave_days: float = Field(..., description="Total cumulative approved leave days recorded")
    avg_net_salary: Optional[float] = Field(None, description="Average net salary per paid payslip")
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
    gross_wage: float = 0.0
    spend: float = Field(0.0, description="Primary spend value for chart visualization")


class DepartmentCostItem(BaseModel):
    department_name: str
    gross_wage: float = 0.0
    total_gross: float = 0.0
    total_net: float = 0.0
    employee_count: int = 0


class MonthlyTrendItem(BaseModel):
    period_start: str
    net_wage: float = 0.0
    total_net: float = 0.0
    payslip_count: int = 0


class ComplianceAlertItem(BaseModel):
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    issue: str = "Missing Bank Account or IFSC Details"
    severity: str = "warning"  # 'critical', 'warning', 'info'
    id: str = ""
    type: str = "missing_banking"  # 'missing_banking', 'duplicate_batch', 'uncontracted'
    title: str = ""
    message: str = ""
    department_name: Optional[str] = None
    action_url: Optional[str] = None


class DashboardAnalyticsResponse(BaseModel):
    kpis: KPIsSummary
    department_spend: List[DepartmentSpendItem] = []
    department_costs: List[DepartmentCostItem] = []
    monthly_trends: List[MonthlyTrendItem] = []
    monthly_spend_trend: List[MonthlyTrendItem] = []
    compliance_alerts: List[ComplianceAlertItem] = []
    attention_items: List[ComplianceAlertItem] = []
    attention_alerts: List[ComplianceAlertItem] = []
    alerts: List[ComplianceAlertItem] = []
    total_net_paid: Optional[float] = None
    total_payslips: Optional[int] = None
    avg_salary: Optional[float] = None
    approved_leave_days: Optional[float] = None


class DispatchToast(BaseModel):
    type: str = "success"
    title: str
    description: str


class SendPayslipsResponse(BaseModel):
    success: bool = True
    status: str = "success"
    payrun_id: int
    dispatched_count: int
    message: str
    toast: DispatchToast
