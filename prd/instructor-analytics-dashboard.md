# Instructor Analytics Dashboard

## Problem Statement

Instructors on the platform have no visibility into how their courses are performing financially. After a course is published and students start buying, the only feedback an instructor sees today is a flat enrollment count on the "My Courses" page. They cannot tell:

- How much money they have actually earned, in total or recently
- Whether revenue is trending up or down
- Which of their courses are driving most of the income
- Whether revenue swings are caused by more buyers or higher per-transaction values
- How their newest courses compare to their established ones

Admins face the same blindness at the platform level: they can browse courses and users, but there is no aggregated view of money flowing through the platform, and no way to inspect a specific instructor's performance.

## Solution

A single, role-aware analytics dashboard at `/instructor/analytics` focused on revenue.

For an **instructor**, it shows the combined performance of every course they own: top-line KPI cards (revenue, students, purchases, average order value), a revenue-over-time bar chart, and a per-course breakdown table. All numbers respect a timeframe picker (1 week / 1 month / 6 months / 1 year, default 1 month). Clicking a course in the table opens a per-course analytics page scoped to that one course.

For an **admin**, the same route shows **platform-wide** totals by default, plus an instructor picker at the top of the page that switches the view to render any chosen instructor's dashboard exactly as that instructor would see it.

Students cannot access either view.

## User Stories

1. As an instructor, I want to see how much total money I have earned across all my courses in the last month, so that I can quickly tell whether my income is healthy.
2. As an instructor, I want to switch the timeframe between 1 week, 1 month, 6 months, and 1 year, so that I can investigate both short-term swings and long-term trends.
3. As an instructor, I want each KPI card to show a percentage change versus the previous period of the same length, so that I can tell at a glance whether things are improving or getting worse.
4. As an instructor, I want to see how many unique students bought my courses in the timeframe, so that I can tell whether revenue moved because of more buyers or higher prices.
5. As an instructor, I want to see the count of purchases separately from the count of students, so that I can recognise when one student bought multiple of my courses.
6. As an instructor, I want to see my average order value, so that I can spot when discounts, coupons, or PPP pricing are pulling typical transactions down.
7. As an instructor, I want a revenue-over-time bar chart that buckets automatically (daily for short ranges, weekly/monthly for longer ones), so that the chart is readable regardless of timeframe.
8. As an instructor, I want a table below the chart showing every one of my published courses with its own revenue, students, purchases, and AOV, so that I can compare courses against each other.
9. As an instructor, I want to sort the per-course table by any column, so that I can answer questions like "which course earned the most this month?"
10. As an instructor, I want clicking a course title in the table to open a per-course analytics page, so that I can drill into one course's performance without leaving the analytics flow.
11. As an instructor, I want the per-course analytics page to show the same KPI cards and chart but scoped to that single course, plus a per-country revenue breakdown, so that I can understand who is buying and whether PPP pricing is dragging the numbers.
12. As an instructor, I want my free courses (price = 0) to still appear in the dashboard with $0 revenue, so that I see all my published courses in one place.
13. As an instructor, I want draft and archived courses excluded from analytics, so that the dashboard reflects what is actively selling.
14. As an instructor, I want bulk team purchases to count as revenue on the day the buyer paid (not when individual seats are redeemed), so that the chart matches when money actually arrived.
15. As an instructor, I want the "students" count to include both individual buyers and people who later redeem team-purchase coupons, so that the number reflects how many people are actually learning from my course.
16. As an instructor, I want to be unable to see any other instructor's data, so that my dashboard stays focused on my own work and doesn't expose private information about peers.
17. As an admin, I want a default "platform-wide" view showing combined revenue, students, purchases, and AOV across every instructor and course, so that I can monitor overall platform health.
18. As an admin, I want an "instructor picker" at the top of the dashboard to switch the entire view to a single instructor's perspective, so that I can audit or assist any specific instructor.
19. As an admin, I want the picked instructor's view to render identically to what that instructor sees, so that I can troubleshoot or verify their dashboard without being confused by a different layout.
20. As a student, I want to be redirected (or shown a clear "access denied" page) when I try to visit the analytics dashboard, so that the system fails closed rather than leaking instructor data.
21. As an unauthenticated visitor, I want to be denied access to the analytics dashboard, so that revenue data is never exposed to anonymous users.
22. As an instructor on my first day, I want a clear empty state when I have no purchases yet, so that I'm not greeted with a confusing dashboard full of zeros and undefined percentage changes.
23. As an instructor with many courses, I want the per-course table to remain readable when I have dozens of rows, so that the page stays usable as my catalogue grows.
24. As an instructor, I want the dashboard reachable from a clear link on the existing `/instructor` page (alongside "My Courses"), so that I can find it without typing a URL.
25. As an instructor, I want PPP-discounted purchases mixed into my totals (not broken out on the main dashboard), so that I see one unified revenue number rather than juggling multiple definitions.

## Implementation Decisions

### Modules

- **New service: `analyticsService`** — single source of truth for revenue/student/purchase aggregations. Takes a scope (instructor id, course id, or platform-wide) and a timeframe; returns the shapes consumed by KPI cards, the bar chart, and the per-course table. Also computes the previous-period equivalent for percentage-change calculations.
- **Existing services consumed**: `purchaseService` (revenue source of truth), `couponService` and `enrollmentService` (for the "students = buyers ∪ redeemers" definition), `courseService` (instructor ownership, course metadata, published-status filter), `userService` (role checks, instructor picker population for admins).
- **New route: `/instructor/analytics`** — main dashboard. Role-aware loader: instructor → own data; admin → platform-wide by default, or scoped to a specific instructor when `?instructorId=` is set.
- **New route: `/instructor/:courseId/analytics`** — per-course drill-down. Loader enforces that the current user is the course's instructor or an admin.
- **Modified route: `/instructor`** — add an "Analytics" link/tab to the existing course-list page so the dashboard is reachable from the instructor's normal landing.
- **Internal UI building blocks** (no new shared primitives): a KPI card, a timeframe picker, and a revenue bar chart, reused between the main and per-course pages.

### Technical Decisions

| Decision | Details |
|---|---|
| Authorisation enforced in the loader, not the UI | UI never receives data the user is not allowed to see; loader returns 401 for unauthenticated, 403 for `student` role, scopes to `courses.instructorId = currentUser.id` for instructors, and is unrestricted for admins. |
| Per-course route ownership check | Loader on `/instructor/:courseId/analytics` returns 403 if the course is not owned by the current instructor; admins bypass the check. |
| Admin scoping via `?instructorId=` | When admin sets `?instructorId=`, loader scopes every query as if admin were that instructor — page renders identically. Avoids forking the UI for admins. |
| Revenue = gross `SUM(purchases.pricePaid)` | No refunds (no refunds table exists), no platform-fee split (deferred). One unambiguous revenue number. |
| Team-purchase attribution by `purchases.createdAt` at full `pricePaid` | Revenue lands on the day the buyer paid, not when seats are redeemed — chart matches when money actually arrived. |
| PPP purchases mixed into main-dashboard totals | Instructors see one unified revenue number rather than juggling multiple definitions; per-country breakdown lives only on per-course drill-down. |
| Students = UNION-distinct of in-window purchasers and in-window coupon redeemers | Captures both individual buyers and team-seat redeemers as "students" so the count reflects who is actually learning, not just who paid. |
| Free (price = 0) published courses included | Show $0 revenue but real student counts; instructors expect a single complete view of their published catalogue. |
| Drafts and archived courses excluded | Dashboard reflects what is actively selling. |
| Timeframe stored in URL as `?range=1w\|1m\|6m\|1y`, default `1m` | Views are linkable and refresh-stable. "All-time" intentionally not offered in v1. |
| Percentage change is vs. immediately preceding window of the same length | E.g. 1 month compares last 30 days vs the 30 days before. Length-matched comparison only. |
| Chart bucketing derived from active timeframe, not user-chosen | 1w → daily, 1m → daily, 6m → weekly, 1y → monthly. Keeps the chart readable across ranges without an extra control. |
| Per-course table sortable by every column; default revenue descending | Answers "which course earned most this period?" by default; users can re-sort for other questions. |
| Empty state — zero purchases in timeframe | KPI cards show "—" / "$0" with no percentage change rather than "Infinity%" / "NaN%". |
| Empty state — instructor has no published courses | Replace dashboard body with guidance ("Publish a course to start seeing analytics") instead of zeroed cards and an empty chart. |
| Single-currency assumption | `purchases.pricePaid` is an integer with no currency column; if multi-currency is ever introduced, `analyticsService` is the single place to update. |
| Direct aggregation per page load (no caching, no rollups) in v1 | SQLite + Drizzle dataset is small enough; materialised daily revenue rollups per course are the natural next step if/when slow. |

### Schema Changes

No schema changes. The analytics service reads only from existing tables: `purchases` (revenue, `pricePaid`, `createdAt`, `userId`, `courseId`), `coupons` (`redeemedAt`, redeemer `userId`, `courseId` for team-purchase student counting), `courses` (`instructorId`, status filter), and `users` (role checks; admin instructor picker).

### Testing Decisions

`analyticsService` is the highest-leverage place for unit tests because every UI surface depends on it. Required coverage:

- **Revenue aggregation correctness** — per-instructor and platform-wide; published-only filter; free-course inclusion at $0.
- **Student-count UNION-distinct** — user appearing as both buyer and redeemer is counted once; team-purchase buyer counts via the purchase row, redeemers count via the redemption.
- **Timeframe boundary inclusivity** — purchases on the first/last instant of a window are correctly included/excluded; previous-period comparison aligns lengths exactly.
- **Team-purchase attribution** — revenue lands on `purchases.createdAt` regardless of how many seats have been redeemed.
- **Course filter exclusions** — draft and archived courses never contribute to KPIs, chart, or per-course table.
- **Bucketing correctness** — daily/weekly/monthly buckets cover the full window with no gaps and no double-counted edges.
- **Authorisation scoping in route loaders** — unauthenticated → 401, student → 403, instructor → only own courses returned, per-course route 403s on cross-instructor access, admin platform-wide and `?instructorId=` scoping behave as specified.

### Prior Art

- **Service layer pattern** — follow the shape of `purchaseService`, `courseService`, `enrollmentService`, `couponService`: a module of pure functions that take ids and return aggregated/queried data, no class hierarchy.
- **Role-gated route loaders** — the existing `/instructor` route loader already does the "fetch current user, reject if not instructor" pattern via `getCurrentUserId` from `~/lib/session` and `getUserById` from `userService`; both new routes should mirror it (extended for admin role and per-course ownership).
- **Admin route conventions** — `admin.users.tsx`, `admin.courses.tsx`, `admin.categories.tsx` show how admin-only loaders are structured today; the admin branch of `/instructor/analytics` should be consistent with them.
- **Shared course-card / image patterns** — `CourseImage` and the existing `Card` UI components from `~/components/ui` should be used for the per-course table rows where applicable, rather than introducing new primitives.
- **DevUI user switcher** — the existing DevUI already supports switching between instructor/admin/student accounts, so manual verification of role-based behaviour does not require new tooling.

## Out of Scope

- **Refunds.** No refunds table exists today, so no refund tracking, refund-rate metric, or net-of-refunds calculation is part of this PRD.
- **Platform-fee / revenue-share split.** Revenue is shown as the full `pricePaid`; a platform-cut feature is deferred.
- **Conversion rate** (course-page visits → purchases). The platform does not currently track page views, so this metric cannot be produced in v1.
- **CSV / PDF export.** No download or export buttons.
- **Scheduled email reports** of revenue (weekly/monthly digests).
- **Instructor leaderboards** ranking instructors against each other in the admin view.
- **Per-student or per-purchase drill-down** (e.g. "show me the list of every transaction"). Aggregates only.
- **Forecasting / projections.** Past-and-current data only; no predictive analytics.
- **Free-course engagement metrics** (completion rate, watch time) — even though free courses appear in the table, they are only shown for completeness; engagement analytics are a separate concern.

## Further Notes

- **Future per-course breakdowns.** PPP-by-country lives only on the per-course detail page in v1; if instructors ask for it on the main dashboard later, it can be added without any schema change.
- **Performance escape hatch.** If direct aggregation per page load becomes slow as data grows, materialised daily revenue rollups per course are the natural next step — the `analyticsService` boundary is designed so this can be swapped in without changes to routes or UI.
