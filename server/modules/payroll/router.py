from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
def ping():
    return {"module": "payroll_ready"}
