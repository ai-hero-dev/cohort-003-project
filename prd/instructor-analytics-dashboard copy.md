# PRD: Instructor Analytics Dashboard (Revenue, v1)

## Context

Instructors on Cadence have no way to see how their courses are performing financially. The platform already records every transaction in the `purchases` table (`pricePaid`, `country`, `createdAt`, plus `userId`/`courseId` joins) but exposes none of it back to the people creating courses. Instructors are flying blind on which courses earn, when sales happen, and how their portfolio is trending month over month.

This PRD scopes a focused v1: total revenue, revenue over time, per-course breakdown, paying-student count. The dashboard is reachable by instructors (their own data only) and by admins (scoped to one instructor at a time via a query param). Country-level breakdowns, refunds, platform-wide admin analytics, and per-course drill-down pages are explicitly deferred.

## Problem Statement

As an instructor, I have no visibility into how my courses are earning. I can't tell which course is my best earner, whether my recent launch is gaining traction, or how this month compares to last — so I can't make informed decisions about which courses to invest in, when to launch new ones, or when to update existing material.

## Solution

A single analytics dashboard at `/instructor/analytics` showing:

- Headline KPI cards: total revenue (lifetime), revenue in the selected period (with prior-period delta), and number of paying students.
- A revenue-over-time chart with preset date ranges (7d / 30d / 90d / 12mo / all).
- A sortable per-course table with title, revenue in period, sales count, and last sale date.
- A CSV export of that table.
- Loading skeletons during initial fetch.

Instructors see only their own courses. Admins reach the same dashboard scoped to a specific instructor via `/instructor/analytics?instructorId=<id>`, linked from existing admin pages.

## User Stories

1. As an instructor, I want a single page that shows my total lifetime revenue across all my courses, so I can see my overall earning at a glance.
2. As an instructor, I want to switch between the last 7d / 30d / 90d / 12mo / all-time, so I can see trends without digging through transactions.
3. As an instructor, I want the "revenue in period" KPI to compare against the equivalent prior period, so I can tell whether I'm growing or declining.
4. As an instructor, I want to see how many distinct paying students bought my courses, so I have a sense of audience size beyond raw revenue.
5. As an instructor, I want a chart of revenue over time within my selected period, so I can visually spot spikes (e.g. after a launch) and flat stretches.
6. As an instructor, I want chart granularity to adapt to the date range (daily for short ranges, weekly or monthly for long ones), so the chart stays readable.
7. As an instructor, I want a sortable table of my courses with revenue, sales count, and last-sale date, so I can compare which course is performing best and which has gone cold.
8. As an instructor, I want to click a course title in that table to jump to the course editor, so I can act on what I see without breaking flow.
9. As an instructor, I want the date-range selector to apply to BOTH the chart and the per-course table, so the page tells one consistent story.
10. As an instructor, I want the "lifetime total" KPI to stay lifetime regardless of the selector, so I always see my big number.
11. As an instructor, I want to download the per-course table as a CSV, so I can share it with collaborators or do my own analysis in a spreadsheet.
12. As an instructor, I want loading skeletons while the dashboard is fetching, so the page doesn't feel broken on first render.
13. As an instructor whose course was sold via a team/coupon bulk purchase, I want that bulk amount counted as revenue, so my totals reflect what I actually earned.
14. As an instructor, I want only myself and admins to be able to view my dashboard, so my financial data isn't exposed to other instructors or students.
15. As an admin, I want to visit `/instructor/analytics?instructorId=<id>` to view a specific instructor's dashboard, so I can support them or audit revenue.
16. As an admin, I want a "View analytics" link from existing admin instructor surfaces, so I don't have to construct URLs by hand.
17. As an instructor, I want my date-range and admin scoping to live in URL params, so I can bookmark and share specific dashboard views.
18. As an instructor with no courses or no sales yet, I want the page to render gracefully instead of crashing or showing nonsense numbers, so the dashboard is trustworthy.

## Implementation Decisions

### New modules

- **`analyticsService.ts`** — deep service module. Thin interface, encapsulates all aggregation SQL. All functions take `instructorId` and an optional date range, and join through `courses.instructorId` to scope queries to one instructor. Exposed functions:
  - `getTotalLifetimeRevenue({ instructorId })` → cents
  - `getRevenueInRange({ instructorId, startDate, endDate })` → cents
  - `getPayingStudentCount({ instructorId, startDate?, endDate? })` → number (count of distinct `purchases.userId`)
  - `getRevenueTimeSeries({ instructorId, startDate, endDate, granularity })` → array of `{ date, revenueCents, salesCount }`
  - `getPerCourseRevenue({ instructorId, startDate, endDate })` → array of `{ courseId, title, revenueCents, salesCount, lastSaleAt }`

- **`dateRangePreset` helper** (in `app/lib/`) — pure function mapping a preset key to `{ startDate, endDate, granularity }`. Granularity rules: `7d`/`30d` → daily, `90d` → weekly, `12mo` → monthly, `all` → monthly.

- **`/instructor/analytics` route** — read-only loader, no `action()`. Loader behavior:
  - `getCurrentUserId(request)` → 401 if missing.
  - Look up user role.
  - If role is `Instructor`: target instructor = self (any `?instructorId` param is ignored — tampering protection).
  - Else if role is `Admin`: require `?instructorId=` (400 if missing) → use it.
  - Else: 403.
  - Parse `?period=` (default `30d`), call `dateRangePreset()`.
  - Call all five analyticsService functions plus a second `getRevenueInRange` for the prior period.
  - Return bundle.

- **Presentational components**, composed in the route:
  - `KpiCard` — title, big number, optional delta pill.
  - `RevenueChart` — Recharts line chart; takes time-series data and granularity.
  - `CoursesTable` — sortable table built on existing UI primitives.
  - `PeriodSelector` — chip switcher; updates `?period=` in the URL.

- **CSV export** — client-side: serialize current table state to a CSV blob and trigger a download. No server endpoint.

### Modified files

- `app/routes/instructor.tsx` — add an "Analytics" button at the top of the page.
- Existing admin instructor surface — add a "View analytics" link to `/instructor/analytics?instructorId=<id>`.
- `app/lib/utils.ts` — add `formatCents(cents)` helper (`4999` → `"$49.99"`).

### Auth & access rules

- Unauthenticated → 401.
- Role `Student` → 403.
- Role `Instructor` → only their own data; any `?instructorId` query param is ignored.
- Role `Admin` → must provide `?instructorId=`; 400 if absent.

### Data semantics

- Revenue is computed from `purchases.pricePaid` (cents). Currency is assumed USD; the schema has no currency column.
- A team purchase = one `purchases` row with multiple `coupons` rows. Revenue counts that single row at its `pricePaid`. Coupon redemptions do not contribute additional revenue.
- "Paying students" = distinct `purchases.userId` across the instructor's courses (within range if specified).
- Date filter applies uniformly to the chart, per-course table, and "revenue in period" KPI. The "total revenue (lifetime)" KPI is intentionally NOT filtered.
- Prior-period delta: two `getRevenueInRange` calls (current period and the immediately preceding equal-length period); UI shows percent change.

### Schema changes

None. `purchases` already has every column required.

### Dependencies

Add `recharts` (line chart only).

### Tests

Unit tests for `analyticsService` — every aggregation function. Mirrors existing service test pattern: in-memory DB via `createTestDb()`, seed via `seedBaseData()`, insert purchases manually, assert aggregates. Cover:

- Empty data (no purchases → 0 revenue, 0 students, empty arrays).
- Single instructor with multiple courses across multiple purchases.
- Multiple instructors in the DB — confirm scoping prevents cross-instructor data leakage.
- Date-range boundary conditions (purchases on `startDate` and `endDate`).
- Team/bulk purchases counted once at full `pricePaid`.
- Time-series bucketing produces correct per-bucket sums for each granularity.

Out of scope for tests in v1: route loader integration tests, UI component tests, helper unit tests beyond what's incidentally covered.

## Out of Scope

- Refunds — no refunds table exists; revenue is gross. Add when product needs it.
- Country / PPP breakdown — data is in `purchases.country` but no UI in v1.
- Platform-wide admin analytics (totals across all instructors, top-instructor leaderboards, etc.) — admin v1 is "view as one instructor" only.
- First-class empty-state designs and illustrations — basic inline "no data" labels only.
- Per-course drill-down page (e.g. `/instructor/$courseId/analytics`).
- Custom date range picker — preset chips only.
- Revenue forecasting / trend prediction.
- Raw transaction list export (only the per-course aggregate table is exportable as CSV).
- Realtime updates / websockets — loader-driven, refresh on navigation.
- Caching / materialized aggregates — direct queries each load. Fine at current scale; revisit if slow.

## Further Notes

- During exploration I noticed `instructor.$courseId.tsx` may not enforce a `course.instructorId === currentUserId` ownership check in its loader. This is unrelated to analytics but worth filing as its own bug — the analytics dashboard's auth checks should not be the only line of defense.
- All UI state (selected period, admin-mode `instructorId`) lives in URL query params for shareability and back-button correctness.

## Verification

End-to-end before shipping:

1. **Auth gating** — hit `/instructor/analytics` while unauthenticated (401), as a Student (403), as an Instructor (own dashboard), as an Admin without `?instructorId` (400), as an Admin with `?instructorId=<id>` (that instructor's dashboard).
2. **Tampering protection** — log in as Instructor A, visit `/instructor/analytics?instructorId=<B>`. Expect A's dashboard (param ignored).
3. **Data correctness** — seed via `pnpm db:seed`, confirm:
   - Lifetime revenue equals `SELECT SUM(pricePaid) FROM purchases JOIN courses WHERE instructorId = ?`.
   - Period revenue matches a manual `SUM(pricePaid) WHERE createdAt BETWEEN ?`.
   - Paying-student count equals `COUNT(DISTINCT userId)` over the same scope.
   - Per-course rows reconcile to the period total when summed.
   - A team purchase at $999 with 10 seats contributes $999 once, not multiplied.
4. **UI** — period chips update chart and table together. Each table column sorts. CSV export downloads a file matching the visible table.
5. **Quality gates** — `pnpm test app/services/analyticsService.test.ts` passes; `pnpm typecheck` clean; `pnpm test` overall green.
