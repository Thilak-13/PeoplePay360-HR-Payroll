# Clean Enterprise Classic UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the PeoplePay360 frontend into a clean, robust, highly legible interface with minimal, restrained color, crisp typography, and structured data tables following the Stripe / GitHub enterprise aesthetic.

**Architecture:** Refactor the UI shell (`Sidebar`, `TopBar`, `AppShell`), introduce standardized discrete status badges, eliminate loud gradients, and modernize key views (`PayrollDashboard`, `EmployeeList`, `EmployeeDetail`, `LeaveManager`, `AttendanceTracker`, `DailyPunches`) with high-contrast typography, generous spacing, and unified hairline borders.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React icons, Vite.

## Global Constraints
- Preserve all 5 canonical role boundaries (Employee, HR Manager, HR Payroll User, HR Payroll Manager, Admin).
- Do not alter API schemas, endpoints, or backend logic.
- Colors: Off-white canvas (`#f8fafc`), crisp white surfaces (`#ffffff`), deep navy sidebar (`#0f172a`), single dark blue-slate accent (`#2563eb`), high-contrast slate text (`#0f172a` / `#475569`), zero rainbow gradients.

---

### Task 1: Global Theme & Base Typography Setup

**Files:**
- Modify: `index.html:1-33`

**Interfaces:**
- Consumes: Tailwind CDN configuration
- Produces: Inter font stack, clean background canvas, subdued color tokens

- [ ] **Step 1: Update index.html with crisp typography and base styles**
  - Add Inter font stylesheet link.
  - Configure Tailwind palette with slate/zinc neutral defaults and clean off-white background `bg-[#f8fafc] text-slate-900 antialiased`.
- [ ] **Step 2: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 3: Commit**
  - `git commit -m "style: configure Inter typography and enterprise canvas in index.html"`

---

### Task 2: Core Shell Redesign (Sidebar, TopBar, AppShell)

**Files:**
- Modify: `client/src/components/shared/Sidebar.tsx`
- Modify: `client/src/components/shared/TopBar.tsx`
- Modify: `client/src/components/shared/AppShell.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useRole`, navigation callbacks
- Produces: Polished dark navy sidebar with monochrome icons, crisp white topbar with breadcrumbs, clean off-white shell canvas

- [ ] **Step 1: Refactor Sidebar.tsx**
  - Background: Deep slate navy (`bg-[#0f172a] border-r border-slate-800/80`).
  - Active links: `bg-slate-800/90 text-white font-medium border-l-2 border-indigo-400 pl-3`.
  - Inactive links: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/40`.
  - Section titles: `text-[10px] font-semibold uppercase tracking-wider text-slate-400`.
  - Strip colorful gradient pills and glow effects.
- [ ] **Step 2: Refactor TopBar.tsx**
  - Background: Crisp solid white (`bg-white border-b border-slate-200`).
  - Clean text breadcrumbs with subtle chevron dividers.
  - Minimal persona badge and clean outlined actions.
- [ ] **Step 3: Refactor AppShell.tsx**
  - Canvas: `bg-[#f8fafc] min-h-screen text-slate-900`.
  - Refined modal styling for user profile.
- [ ] **Step 4: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "style(shell): modernize Sidebar, TopBar, and AppShell with enterprise classic styling"`

---

### Task 3: Shared Discrete Status Badge Component

**Files:**
- Create: `client/src/components/shared/StatusBadge.tsx`

**Interfaces:**
- Consumes: `status: string`, `label?: string`, `size?: 'sm' | 'md'`
- Produces: Reusable pill component with a 6px semantic status dot (`emerald-500` for active/approved, `amber-500` for pending/draft, `rose-500` for refused/absent, `slate-400` for inactive)

- [ ] **Step 1: Implement StatusBadge.tsx**
  - Clean muted gray pill (`bg-slate-100/90 text-slate-700 border border-slate-200/80`).
  - Discrete colored dot for semantic status.
- [ ] **Step 2: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 3: Commit**
  - `git commit -m "feat(ui): add discrete StatusBadge component with semantic dot indicators"`

---

### Task 4: Analytics Dashboard Refactoring

**Files:**
- Modify: `client/src/pages/dashboard/PayrollDashboard.tsx`

**Interfaces:**
- Consumes: analytics API summaries, navigation props
- Produces: Clean, legible KPI metric cards, monochrome charts, clear typography

- [ ] **Step 1: Redesign KPI stat cards**
  - Replace rainbow/gradient background cards with clean solid white cards (`bg-white border border-slate-200 rounded-xl p-5 shadow-xs`).
  - Clear typography hierarchy: label (`text-xs font-semibold uppercase tracking-wider text-slate-500`), value (`text-2xl font-bold font-mono text-slate-900`).
  - Subtle neutral icon container (`bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-lg`).
- [ ] **Step 2: Restrain chart & table color styling**
  - Use unified dark navy/blue-slate accent for chart bars and trend lines.
  - Style recent payroll table with clean hairline dividers and right-aligned monospace currency figures.
- [ ] **Step 3: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 4: Commit**
  - `git commit -m "style(dashboard): refactor PayrollDashboard with clean KPI cards and minimal palette"`

---

### Task 5: Master Data Modules (Directory, Detail, Leaves)

**Files:**
- Modify: `client/src/pages/master-data/EmployeeList.tsx`
- Modify: `client/src/pages/master-data/EmployeeDetail.tsx`
- Modify: `client/src/pages/master-data/LeaveManager.tsx`

**Interfaces:**
- Consumes: master data endpoints, StatusBadge component
- Produces: High-legibility tables, clean underline navigation tabs, structured leave balance cards

- [ ] **Step 1: Refactor EmployeeList.tsx**
  - High-legibility table: uppercase tracking headers (`text-xs font-semibold text-slate-600 bg-slate-50/70 border-b border-slate-200`), comfortable padding (`py-3.5 px-4`), subtle hover.
  - Replace loud status tags with `StatusBadge`.
  - Clean search & filter input toolbar with clear focus rings.
- [ ] **Step 2: Refactor EmployeeDetail.tsx**
  - Replace pill buttons with clean underline tabs (`border-b-2 border-slate-900 text-slate-900 font-semibold`).
  - Clean 2-column info grid with clear labels (`text-xs font-medium text-slate-500`) and values (`text-sm font-semibold text-slate-900`).
- [ ] **Step 3: Refactor LeaveManager.tsx**
  - Clean 4-card balance overview with clean horizontal progress bar in dark slate.
  - Replace colorful status tags in Leave Requests table with `StatusBadge`.
  - Clean modal dialog with crisp inputs and primary dark button.
- [ ] **Step 4: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "style(master-data): redesign EmployeeList, EmployeeDetail, and LeaveManager for high legibility"`

---

### Task 6: Attendance & Shift Tracking Refactoring

**Files:**
- Modify: `client/src/pages/attendance/AttendanceTracker.tsx`
- Modify: `client/src/pages/attendance/DailyPunches.tsx`

**Interfaces:**
- Consumes: attendance punch and summary APIs, StatusBadge component
- Produces: Clean clock-in card widget, structured daily punch ledger

- [ ] **Step 1: Refactor AttendanceTracker.tsx**
  - Clock-in card: clean white card with large crisp digital clock (`text-4xl font-bold font-mono text-slate-900`), minimal Clock In (emerald border/accent) / Clock Out (rose border/accent) buttons.
  - Recent punches list with clean vertical timeline.
- [ ] **Step 2: Refactor DailyPunches.tsx**
  - Clean summary counter metrics: Present, Absent, Late, Half-Day in subtle neutral cards with small color dot indicators.
  - Structured data table with monospace timestamps and `StatusBadge`.
- [ ] **Step 3: Build verification**
  - Run: `npm run build` in `client`
  - Expected: PASS
- [ ] **Step 4: Commit**
  - `git commit -m "style(attendance): modernize AttendanceTracker and DailyPunches with minimal styling"`

---

### Task 7: Full System Verification & Regression Suite

**Files:**
- All modified frontend & backend files

- [ ] **Step 1: Frontend production build verification**
  - Run: `npm run build` in `client`
  - Expected: 0 errors
- [ ] **Step 2: Backend test suite verification**
  - Run: `$env:PYTHONPATH="."; .venv\Scripts\pytest`
  - Expected: 51 passed
- [ ] **Step 3: Live end-to-end role verification**
  - Test Employee login (`employee@peoplepay360.com`) -> My Details, My Time Off, Attendance.
  - Test HR Manager login (`hr@peoplepay360.com`) -> Employee directory, Leave approval.
  - Test Admin login (`admin@peoplepay360.com`) -> User Management.
- [ ] **Step 4: Final commit & push**
  - Push branch to remote: `git push origin feat/dev3-analytics-dashboard`
