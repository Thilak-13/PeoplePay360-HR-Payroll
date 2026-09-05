# PeoplePay360 Design Specification: Clean Enterprise Classic UI

**Date**: 2026-09-06  
**Aesthetic Direction**: Clean Enterprise Classic (Stripe / GitHub style)  
**Goal**: Transform the frontend into a clean, robust, highly legible interface with minimal, restrained color and clear information hierarchy.

---

## 1. Visual Architecture & Design Principles

1. **Restrained Color Palette**:
   - **Canvas / Background**: Clean, calm off-white (`#f8fafc` / `bg-slate-50`).
   - **Cards & Surfaces**: Crisp solid white (`#ffffff`) with hairline 1px border (`border-slate-200`).
   - **Navigation Anchor**: Deep slate/navy sidebar (`#0f172a` / `bg-slate-900`) providing grounding and clear spatial separation.
   - **Primary Accent**: Single restrained dark blue-slate (`#2563eb` / `#1d4ed8` or `#0f172a`) strictly reserved for primary CTA buttons, active tab indicators, and critical focus states.
   - **No Rainbow/Gradients**: Remove all multi-color gradient cards (pink, purple, cyan, yellow gradients).

2. **Typography & Legibility**:
   - High-contrast typography:
     - Primary text: `text-slate-900` (deep charcoal/black)
     - Secondary/body text: `text-slate-600`
     - Muted/captions/micro-labels: `text-slate-400`
   - Data & Metrics: Monospace font for numerical amounts, hours, and IDs (`font-mono text-slate-900 font-semibold`).
   - Sizing: Standardized type scale (11px micro, 13px table cells & inputs, 14px body, 18-20px headings).

3. **Discrete Status Indicators**:
   - Instead of large saturated background blocks, use soft muted neutral badges with a small 6px semantic status dot:
     - **Active / Approved / Present**: Soft neutral badge (`bg-slate-100 text-slate-700 border-slate-200`) with emerald dot (`bg-emerald-500`).
     - **Pending / In Review / Draft**: Soft neutral badge with amber dot (`bg-amber-500`).
     - **Refused / Inactive / Absent**: Soft neutral badge with red dot (`bg-rose-500`).

---

## 2. Core Shell Components

### A. Sidebar (`Sidebar.tsx`)
- **Theme**: Deep slate navy (`bg-slate-900`), borderless or subtle divider (`border-r border-slate-800`).
- **Brand Header**: Minimal monochrome emblem + clean typography `PeoplePay360`.
- **Navigation Links**:
  - Inactive: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/60`
  - Active: `bg-slate-800 text-white font-medium shadow-xs border-l-2 border-indigo-500`
  - Icons: Uniform 18px size, neutral slate color, no rainbow colored background circles.
- **Section Headers**: Subdued uppercase micro-labels (`text-[10px] font-semibold tracking-wider text-slate-400`).
- **Footer**: Clean persona pill & compact user account row.

### B. TopBar (`TopBar.tsx`)
- **Theme**: Crisp white (`bg-white border-b border-slate-200`).
- **Breadcrumbs**: Clean path (`Home / Workforce / Leave Management`) with subtle separator icons.
- **Actions**: Clean outlined buttons (`border border-slate-200 text-slate-700 hover:bg-slate-50`), single primary action if needed.

---

## 3. Tables & Data Display Standard

- **Container**: White surface with `border border-slate-200 rounded-lg overflow-hidden shadow-xs`.
- **Header**: Subtle gray background (`bg-slate-50/80 border-b border-slate-200`), uppercase tracked labels (`text-xs font-semibold text-slate-600 tracking-wider`).
- **Row Styling**:
  - Generous comfortable padding (`py-3 px-4`).
  - Hairline row dividers (`divide-y divide-slate-100`).
  - Subtle hover transition (`hover:bg-slate-50/60`).
- **Numerical Alignments**: Right-aligned amounts, wage, and balance figures formatted with `font-mono`.

---

## 4. Key Module Refactoring

### A. Payroll Dashboard (`PayrollDashboard.tsx`)
- Replace 4 differently colored gradient metric cards with unified, clean white stat cards with subtle top border or neutral icon box.
- Clean high-contrast typography: label (`text-xs font-medium text-slate-500`), value (`text-2xl font-bold text-slate-900`), change indicator in subdued gray or subtle green.
- Replace multicolored chart palettes with a single coordinated dark slate/blue-slate tone.

### B. Master Data (`EmployeeList.tsx`, `EmployeeDetail.tsx`)
- **Employee Directory**: Default to clean, dense tabular view with search & department filter; clean Kanban card view with minimal borders.
- **Employee Detail**: Clean underline tabs (`border-b-2 border-slate-900 text-slate-900` for active tab) instead of bulky pill buttons. Clean 2-column info grid.

### C. Leave Management (`LeaveManager.tsx`)
- Clean balance metric cards: 4 neat cards displaying Allocated, Used, and Available days with clean progress bars in dark slate.
- Clean Leave Requests table with discrete status dots.

### D. Attendance (`AttendanceTracker.tsx`, `DailyPunches.tsx`)
- Clock-in widget: clean card with clear digital time, crisp primary Clock In / Clock Out button, clean punch timeline.
- Daily Punches: Clean data table with search, date selector, and discrete attendance status tags.

---

## 5. Scope & Compatibility
- Strictly preserves all 5 role-based access control behaviors and permissions.
- Maintains all existing data models, API endpoints, and business logic.
- Zero breaking changes to backend or auth flows.
