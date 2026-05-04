# Plan: Instructor Analytics Dashboard

> Source PRD: `prd/instructor-analytics-dashboard.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `/instructor/analytics` — main dashboard. Role-aware loader: instructor → own data; admin → platform-wide by default, or scoped to a specific instructor when `?instructorId=` is set.
  - `/instructor/:courseId/analytics` — per-course drill-down. Loader requires the current user to own the course or be an admin.
  - `/instructor` (existing) — gains an "Analytics" link/tab.
- **URL state**: timeframe lives in the URL as `?range=1w|1m|6m|1y` (default `1m`); admin instructor scoping lives as `?instructorId=`. URLs are linkable and refresh-stable.
- **Schema**: no schema changes. Reads from existing `purchases`, `coupons`, `enrollments`, `courses`, `users` tables.
- **Key models / definitions**:
  - **Revenue** = `SUM(purchases.pricePaid)` over in-scope `courseId`s, filtered by `purchases.createdAt` within the active timeframe. Team purchases attributed to `purchases.createdAt` at full `pricePaid`. PPP purchases contribute their actual `pricePaid` (not separated on the main dashboard).
  - **Students in timeframe** = UNION-distinct user ids across (a) purchasers with `purchases.createdAt` in range and (b) coupon redeemers with `coupons.redeemedAt` in range, scoped to in-scope courses.
  - **Course filter**: only `CourseStatus.Published` courses contribute. Free courses included (show $0 revenue). Drafts and archived excluded.
- **New service**: `analyticsService` — single source of truth for KPI / time-series / per-course aggregations. Takes a scope (instructor id, course id, or platform-wide) and a timeframe; returns the shapes consumed by KPI cards, the chart, and the per-course table. Also computes the previous-period equivalent for % change.
- **Authorisation**: enforced in route loaders, not UI. Unauthenticated → 401. `student` role → 403. Instructor role → every query scoped to courses they own; per-course route additionally verifies ownership. Admin role → unrestricted; `?instructorId=` re-scopes as if admin were that instructor.
- **No new component primitives**, but three internal building blocks emerge and are reused across the main and per-course pages: a KPI card, a timeframe picker, and a revenue bar chart.
- **Currency**: single-currency assumption (no currency column on `purchases.pricePaid`); analyticsService is the single place to update if multi-currency is introduced later.
- **Prior art to follow**: service shape mirrors `purchaseService` / `courseService` / `enrollmentService` / `couponService` (modules of pure functions, no class hierarchy); the role-gated loader pattern already in `/instructor` (current-user fetch + role check via `getCurrentUserId` + `userService.getUserById`) is the template for both new route loaders; admin-side scoping should be consistent with existing `admin.*.tsx` routes.

---

## Phase 1: Backbone tracer bullet (instructor, fixed window)

**User stories**: 1, 4, 5, 6, 8, 12, 13, 14, 15, 16, 20, 21

### What to build

Wire the full stack end-to-end with the simplest possible behaviour: a single instructor sees real KPIs and a real per-course table for a hardcoded last-30-days window.

Introduce `analyticsService` with a function that aggregates revenue, unique students, purchase count, and average order value for a given instructor over a fixed window. Apply the published-only / free-courses-included course filter and the "students = buyers ∪ coupon redeemers" definition. Team-purchase rows count on `createdAt` at full `pricePaid`.

Add the `/instructor/analytics` route. Loader rejects unauthenticated requests (401), rejects students (403), and scopes every query to courses owned by the current instructor. Render four KPI cards (revenue, students, purchases, AOV) with raw numbers — no percentage change yet. Render a per-course table below with one row per published course owned by the instructor, columns Course title / Revenue / Students / Purchases / AOV — no sorting yet, no clickable titles yet.

This phase is intentionally feature-thin so the auth scoping and revenue/student math get validated before any UI complexity is layered on.

### Acceptance criteria

- [ ] `analyticsService` exists and exposes a function returning `{ revenue, students, purchases, aov, perCourse[] }` for a given instructor over the fixed 30-day window.
- [ ] Revenue equals `SUM(purchases.pricePaid)` for purchases of published courses owned by the instructor with `createdAt` in the window.
- [ ] Student count is the UNION-distinct of in-window purchasers and in-window coupon redeemers across the instructor's published courses.
- [ ] AOV = revenue ÷ purchase count (guarded against divide-by-zero).
- [ ] Free (price = 0) published courses appear in the per-course table with $0 revenue and a real student count.
- [ ] Draft and archived courses never appear in KPIs or the table.
- [ ] `/instructor/analytics` returns 401 for unauthenticated requests and 403 for users with the `student` role.
- [ ] An instructor visiting the route sees only data scoped to their own courses; another instructor's data is never returned.
- [ ] Unit tests cover: revenue aggregation, student union-distinct, free-course inclusion, draft/archived exclusion, team-purchase attribution by `createdAt`, and authorisation scoping.

---

## Phase 2: Interactive instructor dashboard + per-course drill-down

**User stories**: 2, 3, 7, 9, 10, 11, 25

### What to build

Turn the static dashboard into a real interactive analytics surface, and add the per-course drill-down.

Add the timeframe picker (1 week / 1 month / 6 months / 1 year, default 1 month). The selected timeframe lives in the URL as `?range=`. `analyticsService` accepts a timeframe and additionally computes the equivalent previous-period totals so each KPI card can render a "% vs previous period" delta. Per-course table refreshes against the active timeframe. Add column-header sorting on the per-course table; default sort is revenue descending.

Add the revenue-over-time bar chart between the KPI cards and the per-course table. Bucket granularity is derived from the active timeframe — daily for 1w/1m, weekly for 6m, monthly for 1y. The chart respects the current scope (instructor-wide on the main dashboard; single course on the drill-down page).

Add the `/instructor/:courseId/analytics` per-course drill-down route. Same KPI cards, same timeframe picker, same chart, all scoped to a single course. This page additionally renders a "Revenue by country" breakdown — the only place PPP impact is surfaced. Loader enforces that the current user owns the course (otherwise 403). Course titles in the per-course table on the main dashboard become links to this route.

Mixed PPP purchases continue to roll into the unified main-dashboard totals; the per-country breakdown lives only on the drill-down.

### Acceptance criteria

- [ ] Timeframe picker is present with options 1w / 1m / 6m / 1y, defaults to 1m.
- [ ] Timeframe selection updates `?range=` and is preserved across refresh / direct linking.
- [ ] Each KPI card displays a percentage change versus the immediately preceding window of the same length; same-length comparison is correct at timeframe boundaries.
- [ ] Per-course table re-aggregates against the active timeframe and is sortable by every column; default sort is revenue descending.
- [ ] Bar chart renders revenue per bucket with bucketing rules: daily (1w, 1m), weekly (6m), monthly (1y).
- [ ] `/instructor/:courseId/analytics` renders the same KPI cards, picker, and chart scoped to the chosen course only.
- [ ] Drill-down page additionally renders a per-country revenue breakdown.
- [ ] Per-course drill-down loader returns 403 if the current instructor does not own the course.
- [ ] Course titles in the main per-course table navigate to `/instructor/:courseId/analytics` and preserve the active timeframe in the URL.
- [ ] `analyticsService` unit tests cover: previous-period correctness (including timeframe boundary inclusivity), bucketing correctness for each range, and per-course scoping.

---

## Phase 3: Admin view + polish

**User stories**: 17, 18, 19, 22, 23, 24

### What to build

Extend the same routes to admins without forking the UI, then handle empty states and discoverability.

For admins, `/instructor/analytics` defaults to a platform-wide view aggregating revenue, students, purchases, and AOV across every published course on the platform. An instructor picker (combobox of users with role `instructor`, plus a "platform-wide" option) appears at the top of the page for admins only. Picking an instructor sets `?instructorId=`, which causes the loader to scope every query as if the admin were that instructor — the page renders identically to that instructor's own view. `/instructor/:courseId/analytics` becomes accessible to any admin regardless of who owns the course.

Empty states: when the in-scope query returns zero purchases in the timeframe, KPI cards show "—" or "$0" with no percentage change rather than "Infinity%" / "NaN%". When an instructor has no published courses at all, replace the dashboard body with a guidance empty state ("Publish a course to start seeing analytics") instead of empty cards and an empty chart.

Add an "Analytics" link/tab to the existing `/instructor` landing page so the dashboard is reachable without typing the URL. Ensure the per-course table remains readable when the instructor has many courses (sensible row density / overflow handling).

### Acceptance criteria

- [ ] An admin visiting `/instructor/analytics` with no `?instructorId=` sees platform-wide totals across every published course.
- [ ] The instructor picker is visible only to admins and lists all users with role `instructor` plus a "platform-wide" option.
- [ ] Selecting an instructor sets `?instructorId=` and re-renders the page identically to that instructor's own view, including the per-course table contents.
- [ ] Removing `?instructorId=` (or selecting "platform-wide") returns to the platform-wide aggregation.
- [ ] `/instructor/:courseId/analytics` is accessible to admins regardless of course ownership; instructor ownership check still applies to non-admins.
- [ ] Zero-purchase timeframe: KPI cards display "—" or "$0" with no percentage-change indicator (no "Infinity%" or "NaN%").
- [ ] Instructor with no published courses sees a guidance empty state, not zeroed cards plus an empty chart.
- [ ] An "Analytics" link is reachable from `/instructor` and lands on `/instructor/analytics`.
- [ ] The per-course table stays usable with dozens of rows.
- [ ] Tests cover: admin platform-wide aggregation, admin-as-instructor scoping via `?instructorId=`, admin access to any per-course page, and the two empty-state branches.
