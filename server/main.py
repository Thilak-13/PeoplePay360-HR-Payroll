from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.modules.master_data.router import router as master_data_router
from server.modules.payroll.router import router as payroll_router
from server.modules.analytics.router import router as analytics_router

app = FastAPI(
    title="PeoplePay360 API",
    version="1.0.0",
    description="PeoplePay360 HR & Payroll Core API Engine",
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
app.include_router(
    master_data_router, prefix="/api/v1/master-data", tags=["Master Data"]
)
app.include_router(payroll_router, prefix="/api/v1/payroll", tags=["Payroll"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(analytics_router, include_in_schema=False)
