from fastapi import FastAPI
from server.modules.master_data.router import router as master_data_router

app = FastAPI(title="PeoplePay360 API", version="1.0.0")

# Mount master data module router
app.include_router(master_data_router, prefix="/api/v1/master-data", tags=["Master Data"])


@app.get("/")
def root():
    return {"message": "PeoplePay360 API running"}
