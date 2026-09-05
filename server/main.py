from fastapi import FastAPI
from server.modules.master_data.router import router as master_data_router
from server.modules.payroll.router import router as payroll_router
from server.modules.analytics.router import router as analytics_router

app = FastAPI(
    title="PeoplePay360 API",
    version="1.0.0",
    description="PeoplePay360 HR & Payroll Core API Engine",
)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.get("/", tags=["Root"])
def root():
    return {"message": "PeoplePay360 API running"}


# Mount domain module routers
app.include_router(
    master_data_router, prefix="/api/v1/master-data", tags=["Master Data"]
)
app.include_router(payroll_router, prefix="/api/v1/payroll", tags=["Payroll"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
