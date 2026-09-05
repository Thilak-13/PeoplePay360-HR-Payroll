from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.modules.master_data.database import Base, engine
import server.modules.master_data.models
import server.modules.payroll.models
import server.modules.auth.models
import server.modules.attendance.models
import server.modules.loans.models
import server.modules.expenses.models
import server.modules.statutory_tax.models
import server.modules.notifications.models

from server.modules.master_data.router import router as master_data_router
from server.modules.payroll.router import router as payroll_router
from server.modules.analytics.router import router as analytics_router
from server.modules.auth.router import router as auth_router
from server.modules.attendance.router import router as attendance_router
from server.modules.loans.router import router as loans_router
from server.modules.expenses.router import router as expenses_router
from server.modules.statutory_tax.router import router as tax_router
from server.modules.notifications.router import router as notifications_router

# Auto-create all relational database tables
Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure essential demo users and backing employee records exist on server startup."""
    from server.modules.master_data.database import SessionLocal
    from server.modules.auth.router import ensure_baseline_entities, seed_default_users
    db = SessionLocal()
    try:
        ensure_baseline_entities(db)
        seed_default_users(db)
    except Exception as exc:
        print(f"[Startup Notice] Baseline entities: {exc}")
    finally:
        db.close()
    yield

app = FastAPI(
    title="PeoplePay360 API",
    version="1.0.0",
    description="PeoplePay360 Enterprise HR, Payroll, RBAC & Workforce Automation API Engine",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.get("/", tags=["Root"])
def root():
    return {"message": "PeoplePay360 API running"}


# Mount domain module routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication & RBAC"])
app.include_router(master_data_router, prefix="/api/v1/master-data", tags=["Master Data"])
app.include_router(attendance_router, prefix="/api/v1/attendance", tags=["Attendance & Shifts"])
app.include_router(payroll_router, prefix="/api/v1/payroll", tags=["Payroll"])
app.include_router(loans_router, prefix="/api/v1/loans", tags=["Loans & Advances"])
app.include_router(expenses_router, prefix="/api/v1/expenses", tags=["Expenses & Reimbursements"])
app.include_router(tax_router, prefix="/api/v1/tax", tags=["Statutory Tax & TDS"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications & PDF Dispatcher"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(analytics_router, include_in_schema=False)
