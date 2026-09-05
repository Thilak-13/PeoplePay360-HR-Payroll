# PeoplePay360 Multi-Branch Integration & End-to-End Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the three completed module branches (`feat/dev1-masterdata`, `feat/dev2-payroll-engine`, `feat/dev3-analytics-dashboard`) into a unified, tested, and fully functional PeoplePay360 application with end-to-end multi-role workflows.

**Architecture:** A modular FastAPI backend uniting `master_data`, `payroll`, and `analytics` routers over PostgreSQL, coupled with a unified React + TypeScript frontend shell supporting role-based access control (`Admin`, `HR Manager`, `HR Payroll User`, `HR Payroll Manager`, `Employee`) and live KPI telemetry.

**Tech Stack:** Python 3.12/3.14, FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Pydantic v2, Pytest, React 18, TypeScript, Tailwind CSS, Recharts.

## Global Constraints
- Backend domain boundaries preserved: `server/modules/master_data/`, `server/modules/payroll/`, `server/modules/analytics/`.
- Root entrypoint `server/main.py` mounts all 3 routers cleanly with prefixes `/api/v1/master-data`, `/api/v1/payroll`, `/api/v1/analytics`.
- Database schema and seed: `init-db.sql` and `database/seed.sql` execute cleanly in Postgres.
- Test coverage: Zero regressions across all module unit tests.

---

### Task 1: Unified Router Mounting & Master Schema Alignment

**Files:**
- Create: `database/seed.sql` (if missing from branch)
- Modify: `server/main.py`
- Test: `tests/test_unified_health.py`

**Interfaces:**
- Consumes: `master_data_router`, `payroll_router`, `analytics_router`
- Produces: Unified FastAPI application with `/health` and all `/api/v1/*` routes mounted

- [ ] **Step 1: Write the failing test for unified router mounting**

```python
# tests/test_unified_health.py
from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)

def test_unified_ping_endpoints():
    r1 = client.get("/api/v1/master-data/ping")
    assert r1.status_code == 200
    assert r1.json() == {"module": "master_data_ready"}

    r2 = client.get("/api/v1/payroll/ping")
    assert r2.status_code == 200
    assert r2.json() == {"module": "payroll_ready"}

    r3 = client.get("/api/v1/analytics/ping")
    assert r3.status_code == 200
    assert r3.json() == {"module": "analytics_ready"}
```

- [ ] **Step 2: Run test to verify it fails if other routers aren't mounted**

Run: `pytest tests/test_unified_health.py -v`
Expected: FAIL if payroll or analytics routers are not mounted in main.py.

- [ ] **Step 3: Update `server/main.py` to mount all three routers**

```python
# server/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.modules.master_data.router import router as master_data_router
from server.modules.payroll.router import router as payroll_router
from server.modules.analytics.router import router as analytics_router

app = FastAPI(title="PeoplePay360 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(master_data_router, prefix="/api/v1/master-data", tags=["Master Data"])
app.include_router(payroll_router, prefix="/api/v1/payroll", tags=["Payroll"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "PeoplePay360 API"}

@app.get("/")
def root():
    return {"message": "PeoplePay360 API running"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_unified_health.py -v`
Expected: PASS with 200 OK across all ping endpoints.

- [ ] **Step 5: Commit**

```bash
git add server/main.py tests/test_unified_health.py
git commit -m "feat(core): mount all three domain routers in unified FastAPI application"
```

---

### Task 2: Cross-Module End-to-End Test Suite

**Files:**
- Create: `tests/test_e2e_payroll_flow.py`
- Modify: `server/modules/master_data/services.py` (if adjustments needed)
- Modify: `server/modules/payroll/engine.py` (if adjustments needed)

**Interfaces:**
- Consumes: Employee creation API, Contract creation API with date validation, Payrun generation wizard API, Payslip computation engine, Bank CSV export API
- Produces: Complete automated lifecycle verification from employee onboarding to payrun payment and bank file download

- [ ] **Step 1: Write the end-to-end integration test**

```python
# tests/test_e2e_payroll_flow.py
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from server.main import app
from server.modules.master_data.database import Base, get_db
import server.modules.master_data.models
import server.modules.payroll.models

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_full_onboarding_to_payout_flow():
    # 1. Create Department & Schedule
    d_res = client.post("/api/v1/master-data/departments", json={"name": "Finance", "code": "FIN"})
    assert d_res.status_code == 201
    dept_id = d_res.json()["id"]

    s_res = client.post("/api/v1/master-data/working-schedules", json={"name": "40h Full Time", "hours_per_week": 40.0})
    assert s_res.status_code == 201
    sched_id = s_res.json()["id"]

    # 2. Create Employee
    e_res = client.post("/api/v1/master-data/employees", json={
        "first_name": "Bob",
        "last_name": "Marley",
        "email": "bob.marley@peoplepay360.com",
        "phone": "+15551234567",
        "department_id": dept_id,
        "working_schedule_id": sched_id,
        "job_title": "Accountant",
        "status": "active"
    })
    assert e_res.status_code == 201
    emp_id = e_res.json()["id"]

    # 3. Create Active Contract
    c_res = client.post("/api/v1/master-data/contracts", json={
        "employee_id": emp_id,
        "wage": 8000.00,
        "contract_type": "full_time",
        "start_date": "2026-08-01",
        "end_date": "2026-12-31",
        "status": "active"
    })
    assert c_res.status_code == 201

    # 4. Verify Smart Stats on Employee Detail
    detail_res = client.get(f"/api/v1/master-data/employees/{emp_id}/detail")
    assert detail_res.status_code == 200
    assert detail_res.json()["contracts_count"] == 1

    # 5. Create Payrun Batch via Wizard
    w_res = client.post("/api/v1/payroll/payruns/wizard/step2-confirm", json={
        "name": "September 2026 Batch",
        "date_start": "2026-09-01",
        "date_end": "2026-09-30",
        "employee_ids": [emp_id]
    })
    assert w_res.status_code in [200, 201]
    payrun_id = w_res.json()["id"]

    # 6. Compute Payrun Batch
    comp_res = client.post(f"/api/v1/payroll/payruns/{payrun_id}/compute")
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "computed"
    assert float(comp_res.json()["total_gross"]) > 0

    # 7. Transition Lifecycle: computed -> validated -> paid
    t1 = client.post(f"/api/v1/payroll/payruns/{payrun_id}/transition?target_status=validated")
    assert t1.status_code == 200

    t2 = client.post(f"/api/v1/payroll/payruns/{payrun_id}/transition?target_status=paid")
    assert t2.status_code == 200
    assert t2.json()["status"] == "paid"

    # 8. Export Bank CSV File
    bank_res = client.get(f"/api/v1/analytics/payruns/{payrun_id}/export-bank-file")
    assert bank_res.status_code == 200
    assert "text/csv" in bank_res.headers.get("content-type", "")
```

- [ ] **Step 2: Run test to verify execution**

Run: `pytest tests/test_e2e_payroll_flow.py -v`
Expected: Runs complete lifecycle and validates cross-module compatibility.

- [ ] **Step 3: Fix any discrepancies in cross-module queries**

Verify that `resolve_active_contract` in payroll matches date types from `contracts` table and handles timezone fields cleanly.

- [ ] **Step 4: Re-run full test suite**

Run: `pytest tests/ -v`
Expected: 100% tests PASS across all domains.

- [ ] **Step 5: Commit**

```bash
git add tests/test_e2e_payroll_flow.py
git commit -m "test(e2e): add complete cross-module integration test suite"
```

---

### Task 3: Unified AppShell & Role-Based Navigation Routing

**Files:**
- Create: `client/src/App.tsx`
- Modify: `client/src/components/shared/AppShell.tsx`
- Modify: `client/src/components/shared/TopNavBar.tsx`

**Interfaces:**
- Consumes: `RoleContext`, `EmployeeList`, `EmployeeDetail`, `PayrunList`, `PayrunDetail`, `PayrollDashboard`, `PrintablePayslip`
- Produces: Single-page application router switching seamlessly between all views and filtering navigation based on role permissions

- [ ] **Step 1: Write integration render test for AppShell**

```tsx
// client/src/App.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders navigation bar with PeoplePay360 brand and role switcher', () => {
  render(<App />);
  expect(screen.getByText(/PeoplePay360/i)).toBeInTheDocument();
  expect(screen.getByText(/Role:/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Connect all frontend views in `App.tsx`**

```tsx
// client/src/App.tsx
import React, { useState } from 'react';
import { RoleProvider, useRole } from './components/shared/RoleContext';
import { TopNavBar } from './components/shared/TopNavBar';
import { PayrollDashboard } from './pages/dashboard/PayrollDashboard';
import { EmployeeList, EmployeeDetail } from './pages/master-data';
import { PayrunList, PayrunDetail, PayslipDetail } from './pages/payroll';
import { PrintablePayslip } from './components/shared/PrintablePayslip';

const MainContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'employees' | 'payroll' | 'payslip_print'>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedPayrunId, setSelectedPayrunId] = useState<number | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<number | null>(null);
  const { role } = useRole();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <TopNavBar
        activeView={currentView}
        onNavigate={(view) => {
          setCurrentView(view as any);
          setSelectedEmployeeId(null);
          setSelectedPayrunId(null);
          setSelectedPayslipId(null);
        }}
      />
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <PayrollDashboard
            onSelectPayrun={(id) => {
              setSelectedPayrunId(id);
              setCurrentView('payroll');
            }}
          />
        )}
        {currentView === 'employees' && (
          selectedEmployeeId ? (
            <EmployeeDetail
              employeeId={selectedEmployeeId}
              onBack={() => setSelectedEmployeeId(null)}
            />
          ) : (
            <EmployeeList onSelectEmployee={(id) => setSelectedEmployeeId(id)} />
          )
        )}
        {currentView === 'payroll' && (
          selectedPayslipId ? (
            <PayslipDetail
              payslipId={selectedPayslipId}
              onBack={() => setSelectedPayslipId(null)}
              onPrint={(id) => {
                setSelectedPayslipId(id);
                setCurrentView('payslip_print');
              }}
            />
          ) : selectedPayrunId ? (
            <PayrunDetail
              payrunId={selectedPayrunId}
              onBack={() => setSelectedPayrunId(null)}
              onSelectPayslip={(id) => setSelectedPayslipId(id)}
            />
          ) : (
            <PayrunList onSelectPayrun={(id) => setSelectedPayrunId(id)} />
          )
        )}
        {currentView === 'payslip_print' && selectedPayslipId && (
          <PrintablePayslip
            payslipId={selectedPayslipId}
            onBack={() => setCurrentView('payroll')}
          />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <RoleProvider>
      <MainContent />
    </RoleProvider>
  );
}
```

- [ ] **Step 3: Verify build and component loading**

Run: `npm run build` or verify TypeScript compilation.
Expected: Zero compilation errors across JSX/TSX components.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(ui): integrate unified App router supporting multi-domain navigation and role context"
```

---

### Task 4: Final Integration Audit & Release Tagging

**Files:**
- Modify: `AUDIT_HANDOVER.md`
- Test: `pytest`

**Interfaces:**
- Consumes: Completed audit entries from Sections 1 through 5
- Produces: Final verified release audit report and clean tag `v1.0.0-sprint1-ready`

- [ ] **Step 1: Run full system test suite**

Run: `pytest -v`
Expected: 100% tests passing across all test modules.

- [ ] **Step 2: Append final release audit entry to `AUDIT_HANDOVER.md`**

Document full system verification, cross-domain test summary, role permission matrix, and container deployment instructions.

- [ ] **Step 3: Commit and tag release**

```bash
git add AUDIT_HANDOVER.md
git commit -m "docs(audit): finalize Sprint 1 multi-domain integration handover"
git tag -a v1.0.0-sprint1-ready -m "PeoplePay360 Sprint 1 Complete Release"
```
