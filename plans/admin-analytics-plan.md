# Plan: Admin Analytics Dashboard

> Source PRD: prd/admin-analytics.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Route**: `/admin/analytics` — new route under the admin namespace, following existing admin route patterns
- **Auth**: Admin role check in loader, 403 if not admin (same pattern as other admin routes)
- **Schema**: No new tables. All data derived from existing `purchases`, `courses`, `enrollments`, `courseRatings`, and `users` tables
- **Analytics service**: New platform-wide aggregation functions added to the existing analytics service (or a dedicated admin analytics service), querying across all instructors rather than filtering by one
- **Time periods**: Same options as instructor analytics — `7d`, `30d`, `12m`, `all` (default `30d`). Daily granularity for 7d/30d, monthly for 12m/all
- **Revenue format**: Stored in cents in `purchases.pricePaid`, displayed via existing `formatPrice` utility
- **Sidebar**: "Analytics" link added to admin sidebar navigation alongside Users, Courses, Categories

---

## Phase 1: Admin Analytics Summary + Route

**User stories**: 1, 2, 3, 11, 12, 15

### What to build

Wire up the `/admin/analytics` route with admin-only access. Add an "Analytics" link to the admin sidebar. Build analytics service functions that aggregate total revenue and total enrollments across all courses, and identify the top earning course. Display three summary cards: Total Revenue, Total Enrollments, and Top Earning Course (name + revenue amount). Include an empty state when there is no purchase or enrollment data. The time period selector should be present (defaulting to 30d) as it will affect the summary card values.

### Acceptance criteria

- [ ] `/admin/analytics` route exists and returns 403 for non-admin users
- [ ] Admin sidebar includes an "Analytics" link that navigates to the dashboard
- [ ] Summary card shows total revenue across all courses for the selected time period
- [ ] Summary card shows total enrollments across all courses for the selected time period
- [ ] Summary card shows the top earning course name and its revenue for the selected time period
- [ ] Time period tabs (7d, 30d, 12m, all) are present and update the summary cards
- [ ] Empty state is shown when there is no data
- [ ] Analytics service has tests for the new aggregation functions

---

## Phase 2: Revenue Over Time Chart

**User stories**: 4, 5, 9, 10

### What to build

Add a revenue-over-time line chart below the summary cards. The chart shows a single combined revenue line across all courses. It uses daily data points for 7d/30d periods and monthly data points for 12m/all periods. Zero-revenue periods are included as $0 data points. The chart responds to the time period selector from Phase 1.

### Acceptance criteria

- [ ] Line chart displays combined revenue over time for the selected period
- [ ] Chart uses daily granularity for 7d and 30d periods
- [ ] Chart uses monthly granularity for 12m and all periods
- [ ] Zero-revenue days/months appear as $0 data points
- [ ] Revenue axis labels are formatted as currency
- [ ] Chart updates when the time period tab is changed
- [ ] Analytics service has tests for the time series aggregation function

---

## Phase 3: Course Breakdown Table with Instructor Filter

**User stories**: 6, 7, 8, 13, 14

### What to build

Add a per-course breakdown table below the chart. The table includes columns: Course Title, Instructor, List Price, Revenue, Sales, Enrollments, and Average Rating. Above the table, add an instructor dropdown filter populated with instructors who have at least one course. The default selection is "All Instructors", showing all courses. Selecting an instructor filters the table server-side to show only that instructor's courses. The table respects the selected time period for revenue, sales, and enrollment figures.

### Acceptance criteria

- [ ] Table displays all courses with columns: Title, Instructor, List Price, Revenue, Sales, Enrollments, Rating
- [ ] Instructor dropdown is populated with instructors who have at least one course
- [ ] Default filter is "All Instructors" showing every course
- [ ] Selecting an instructor filters the table to only their courses
- [ ] Filtering is applied server-side in the loader
- [ ] Table data respects the selected time period
- [ ] Revenue and list price columns are formatted as currency
- [ ] Analytics service has tests for the per-course breakdown with optional instructor filter
