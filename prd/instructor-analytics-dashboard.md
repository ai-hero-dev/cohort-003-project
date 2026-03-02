# PRD: Instructor Revenue Analytics Dashboard

## Problem Statement

Instructors on the platform have no visibility into how their courses are performing financially. There is no way for an instructor to see total revenue, revenue trends over time, or per-course breakdowns. Admins similarly have no way to view an instructor's revenue performance. This makes it impossible for instructors to make informed decisions about pricing, marketing, or course development priorities.

## Solution

A dedicated analytics dashboard for instructors that provides a revenue-focused overview of all their courses on a single page. The dashboard includes summary cards (total revenue, total enrollments, average rating), a revenue-over-time line chart, and a detailed per-course table. A time period filter (7 days, 30 days, 12 months, All time) controls the data shown across all sections of the page. Admins can access any instructor's analytics dashboard through a link on the admin users page.

## User Stories

1. As an instructor, I want to see my total revenue across all courses for a selected time period, so that I can understand my overall earnings.
2. As an instructor, I want to see my total enrollment count across all courses for a selected time period, so that I can gauge student interest.
3. As an instructor, I want to see my average course rating across all courses for a selected time period, so that I can assess student satisfaction.
4. As an instructor, I want to view a line chart of my revenue over time, so that I can identify revenue trends and the impact of launches or promotions.
5. As an instructor, I want to switch between time periods (7 days, 30 days, 12 months, All time) and have all dashboard data update accordingly, so that I can analyze different windows of performance.
6. As an instructor, I want the selected time period to be stored in the URL, so that I can bookmark or share specific views.
7. As an instructor, I want to see a per-course table showing each course's list price, revenue, sales count, enrollment count, average rating, and rating count for the selected period, so that I can compare performance across my courses.
8. As an instructor, I want to sort the per-course table by clicking column headers (ascending/descending), so that I can quickly find my highest or lowest performing courses by any metric.
9. As an instructor, I want the line chart to automatically adjust its time granularity (daily for 7d/30d, monthly for 12mo/All time), so that the data is readable at every zoom level.
10. As an instructor, I want to see a friendly empty state message when I have no courses or no revenue data yet, so that I understand why the dashboard is blank and what to do next.
11. As an instructor, I want the analytics dashboard to be accessible from the instructor navigation, so that I can find it easily.
12. As an instructor, I want to be confident that I can only see analytics for my own courses, so that my data is private from other instructors.
13. As an admin, I want to click a "View Analytics" link next to any instructor on the admin users page, so that I can quickly navigate to their analytics dashboard.
14. As an admin, I want to see an instructor's analytics dashboard with the same layout and data an instructor would see, so that I have full visibility into their performance.
15. As an admin, I want the admin analytics route to be separate from the instructor route, so that the URL structure is clean and instructor routes remain exclusively for instructors.
16. As a student, I want to be blocked from accessing the analytics dashboard, so that instructor revenue data stays private.
17. As an unauthenticated user, I want to be redirected to login if I try to access the analytics dashboard, so that the data is protected.
18. As an instructor with multiple courses, I want to see all course data on a single page without needing to navigate between courses, so that I can get a holistic view of my business.
19. As an instructor, I want the default time period to be 30 days when I first visit the dashboard, so that I see a useful starting view without needing to select a filter.
20. As an instructor, I want revenue displayed in dollars (formatted from cents), so that the numbers are human-readable.
21. As an instructor, I want zero-revenue periods to appear as $0 data points on the chart rather than gaps, so that the trend line is continuous and accurate.
22. As an instructor, I want the per-course table to default to sorting by revenue descending, so that my top-performing courses are immediately visible.

## Implementation Decisions

### Modules

1. **analyticsService** (new) — A deep module that encapsulates all database query logic for the dashboard. Takes an instructor ID and time period, returns all data needed: summary totals (revenue, enrollments, avg rating + count), revenue time series data points, and per-course breakdowns. This is the core of the feature — complex SQL aggregations behind a simple, testable interface.

2. **Instructor analytics route** at `/instructor/analytics` — A thin route with a loader that authenticates the user (must be an instructor), reads the `?period=` search param (defaulting to `30d`), calls the analytics service with the instructor's own user ID, and returns the data. The component renders the shared dashboard.

3. **Admin instructor analytics route** at `/admin/instructor/:instructorId/analytics` — A thin route with a loader that authenticates the user (must be an admin), reads the instructor ID from URL params and the period from search params, calls the analytics service, and returns the data. The component renders the same shared dashboard.

4. **Shared AnalyticsDashboard component** — A presentational component used by both routes. Receives the analytics data as props and renders:
   - Period selector tabs (7d / 30d / 12mo / All) that navigate via URL search params
   - Three summary cards: Total Revenue, Total Enrollments, Average Rating
   - A revenue line chart (using recharts)
   - A sortable per-course table

5. **Admin users page modification** — Add a "View Analytics" link next to users with the instructor role, pointing to `/admin/instructor/:id/analytics`.

### Technical Decisions

- **Time period filter** is a URL search param (`?period=7d|30d|12m|all`). Defaults to `30d`. The period selector uses navigation (not client-side state) so the page is bookmarkable and the loader can use the param.
- **Line chart granularity** auto-scales: daily data points for 7d and 30d, monthly data points for 12mo and All time.
- **Summary cards respect the time filter** — they show totals for the selected period, not all-time.
- **Per-course table respects the time filter** — revenue, sales, enrollments, and ratings are all scoped to the selected period.
- **Table sorting** is client-side (no server round-trip needed since all data is already loaded).
- **Revenue data source** is the `purchases` table (`pricePaid` column, stored in cents). Revenue includes both individual purchases and team purchases.
- **Enrollment data source** is the `enrollments` table (`enrolledAt` column). This includes coupon redemption enrollments.
- **Rating data source** is the `courseRatings` table (`rating` column, 1-5 scale, with `createdAt` for time filtering).
- **New dependency: recharts** — lightweight React charting library for the line chart.
- **Price formatting** uses the existing `formatPrice()` utility.
- **Empty state** shows a friendly message (e.g., "No revenue data yet. Publish a course to start tracking analytics.") when the instructor has no courses or no data in the selected period.
- **Auth pattern** follows existing conventions: `getCurrentUserId(request)` for session, role check against `UserRole.Instructor` or `UserRole.Admin`, instructor can only see their own data (enforced by passing their own user ID to the service).

### Schema Changes

None. All data needed (purchases, enrollments, courseRatings, courses) already exists in the current schema.

## Testing Decisions

### Philosophy

Tests should verify external behavior through the service's public interface, not implementation details like specific SQL queries. Good tests for this feature set up realistic data scenarios (multiple courses, purchases at different dates, different prices, PPP discounts, team purchases) and assert that the returned analytics data is correct.

### Modules to Test

- **analyticsService** — This is the only module that needs tests, per the project convention that all service files have accompanying `.test.ts` files. The routes are thin loaders and the dashboard component is presentational.

### What to Test

- Summary totals are correct for different time periods (revenue sums, enrollment counts, rating averages)
- Time series data points are correctly bucketed (daily vs monthly granularity)
- Per-course breakdown correctly attributes revenue, sales, enrollments, and ratings to the right courses
- Time period filtering correctly includes/excludes data at period boundaries
- Instructor isolation — only returns data for courses owned by the specified instructor
- Edge cases: instructor with no courses, courses with no purchases, courses with no ratings, zero-revenue periods in time series

### Prior Art

Existing service tests in the codebase (e.g., `purchaseService.test.ts`, `couponService.test.ts`, `enrollmentService.test.ts`) follow the pattern of: mock the db module, use `createTestDb()` and `seedBaseData()` in `beforeEach`, then exercise the service functions and assert results.

## Out of Scope

- **PPP discount impact analysis** (showing how much revenue was "lost" to PPP discounts)
- **Team vs. individual purchase breakdown**
- **Geographic/country breakdown** of revenue
- **Platform-wide admin analytics** (aggregated across all instructors)
- **Custom date range picker** (only fixed periods are supported)
- **Revenue comparison to previous period** (e.g., "+12% vs last 30 days")
- **Export/download of analytics data** (CSV, PDF, etc.)
- **Real-time updates** (data refreshes on page load only)
- **Refunds or revenue adjustments** (no refund system exists)
- **Revenue sharing or instructor payouts**
- **Enrollment-over-time chart** (chart shows revenue only)
- **Student-level purchase details** (who bought what)

## Further Notes

- The `recharts` library should be added as a project dependency. It is a widely-used React charting library that integrates well with React Router and SSR.
- The analytics service should be designed so that additional metrics (PPP impact, geographic breakdown, etc.) can be added later without changing the existing interface — the return type can be extended.
- For the "All time" period, the earliest data point is determined by the instructor's first purchase. Months with no purchases should still appear as $0 in the time series to keep the line continuous.
- The admin route uses a separate path (`/admin/instructor/:instructorId/analytics`) rather than a query param on the instructor route, keeping the URL namespaces cleanly separated.
