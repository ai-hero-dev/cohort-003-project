# Plan: Instructor Revenue Analytics Dashboard

> Source PRD: `prd/instructor-analytics-dashboard.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: Instructor analytics at `/instructor/analytics` (file: `instructor.analytics.tsx`). Admin analytics at `/admin/instructor/:instructorId/analytics` (file: `admin.instructor.$instructorId.analytics.tsx`). Both registered in `app/routes.ts`.
- **Schema**: No changes. All data comes from existing `purchases` (`pricePaid` in cents, `createdAt`), `enrollments` (`enrolledAt`), `courseRatings` (`rating` 1-5, `createdAt`), and `courses` (`instructorId`, `price`) tables.
- **Service**: New `analyticsService.ts` + `analyticsService.test.ts` in `app/services/`. Synchronous functions (better-sqlite3). Takes instructor ID and time period, returns all dashboard data.
- **Time period filter**: URL search param `?period=7d|30d|12m|all`, defaults to `30d`. Navigation-based (not client state) so loaders can use it and URLs are bookmarkable.
- **Auth**: `getCurrentUserId(request)` + role check. Instructor route enforces `UserRole.Instructor` and passes the user's own ID to the service. Admin route enforces `UserRole.Admin` and reads instructor ID from URL params.
- **Shared UI**: A single `AnalyticsDashboard` presentational component used by both routes. Receives analytics data as props.
- **Chart library**: `recharts` added as a dependency.
- **Price display**: `formatPrice()` from `~/lib/utils` for all revenue values.
- **Validation**: Valibot for parsing `period` search param and route params.

---

## Phase 1: Analytics Service + Instructor Route + Summary Cards

**User stories**: 1, 2, 3, 5, 6, 11, 12, 17, 19, 20

### What to build

The thinnest end-to-end slice: a new analytics service that queries summary totals (total revenue, total enrollments, average rating with count) for an instructor's courses within a time period. An instructor-only route at `/instructor/analytics` that calls this service and renders three summary cards. A period selector (tabs for 7d / 30d / 12mo / All) that navigates via URL search params. An "Analytics" link in the sidebar for instructors. Service tests covering summary calculations, time filtering, and instructor isolation.

### Acceptance criteria

- [ ] `analyticsService` returns correct total revenue (sum of `pricePaid`) for a given instructor and time period
- [ ] `analyticsService` returns correct total enrollment count for a given instructor and time period
- [ ] `analyticsService` returns correct average rating and rating count for a given instructor and time period
- [ ] Instructor route at `/instructor/analytics` loads and renders three summary cards (Total Revenue, Total Enrollments, Average Rating)
- [ ] Period selector tabs (7d / 30d / 12mo / All) update the `?period=` search param and reload data
- [ ] Default period is `30d` when no param is present
- [ ] Revenue is displayed formatted in dollars via `formatPrice()`
- [ ] Sidebar shows "Analytics" link for instructor role
- [ ] Unauthenticated users are rejected (401)
- [ ] Non-instructor users are rejected (403)
- [ ] Instructor can only see analytics for their own courses
- [ ] Service tests cover summary totals, time period filtering, boundary dates, and instructor isolation

---

## Phase 2: Revenue Chart + Per-Course Table

**User stories**: 4, 7, 8, 9, 18, 21, 22

### What to build

Extend the analytics service to return two additional datasets: a revenue time series (data points bucketed by day or month depending on period) and a per-course breakdown (list price, revenue, sales count, enrollment count, average rating, rating count per course). Install `recharts` and add a revenue line chart to the dashboard that auto-scales granularity (daily for 7d/30d, monthly for 12mo/All). Add a sortable per-course table below the chart, defaulting to revenue descending. Client-side sorting via column header clicks. Zero-revenue periods appear as `$0` data points. Service tests for time series bucketing and per-course attribution.

### Acceptance criteria

- [ ] `recharts` is installed as a project dependency
- [ ] `analyticsService` returns time series data points with date and revenue amount
- [ ] Time series uses daily granularity for 7d and 30d periods
- [ ] Time series uses monthly granularity for 12mo and All periods
- [ ] Zero-revenue periods appear as $0 data points (no gaps in the line)
- [ ] Revenue line chart renders using recharts with properly formatted axes
- [ ] `analyticsService` returns per-course breakdown with: list price, revenue, sales count, enrollment count, average rating, rating count
- [ ] Per-course table renders all columns for every course the instructor owns
- [ ] Table is sortable by clicking column headers (toggles ascending/descending)
- [ ] Table defaults to sorting by revenue descending
- [ ] All course data visible on a single page without navigation between courses
- [ ] Service tests cover daily and monthly bucketing, zero-revenue periods, and per-course data attribution

---

## Phase 3: Admin Access + Empty States

**User stories**: 10, 13, 14, 15, 16

### What to build

Add an admin-facing route at `/admin/instructor/:instructorId/analytics` that renders the same shared dashboard component with data for the specified instructor. Add a "View Analytics" link next to instructor-role users on the admin users page. Handle empty states throughout: when an instructor has no courses, no revenue, or no data for the selected period, show friendly messages instead of blank sections. Ensure students are blocked from all analytics routes.

### Acceptance criteria

- [ ] Admin route at `/admin/instructor/:instructorId/analytics` loads and renders the full analytics dashboard for the specified instructor
- [ ] Admin route enforces `UserRole.Admin` (403 for non-admins)
- [ ] Admin route uses the same shared `AnalyticsDashboard` component as the instructor route
- [ ] Admin users page shows a "View Analytics" link next to users with the instructor role
- [ ] "View Analytics" link points to `/admin/instructor/:id/analytics`
- [ ] Empty state message shown when instructor has no courses
- [ ] Empty state message shown when instructor has courses but no revenue/enrollment/rating data for the selected period
- [ ] Chart and table sections handle empty data gracefully (no crashes, no blank whitespace)
- [ ] Students receive 403 when attempting to access either analytics route
- [ ] Unauthenticated users are rejected from the admin analytics route
