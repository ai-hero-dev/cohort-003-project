## Problem Statement

Admins of the Cadence course platform currently have no way to view platform-wide revenue or performance metrics. The existing analytics dashboard is scoped to individual instructors, meaning an admin must navigate to each instructor's analytics page separately to understand overall platform health. There is no single view that aggregates revenue across all instructors and courses.

## Solution

Add a read-only admin analytics dashboard at `/admin/analytics` that provides a unified view of platform-wide revenue and enrollment data. The dashboard includes summary cards, a revenue-over-time chart, and a per-course breakdown table with instructor filtering. Only users with the Admin role can access this page.

## User Stories

1. As an admin, I want to see total revenue across all courses, so that I can understand overall platform performance.
2. As an admin, I want to see total enrollments across all courses, so that I can gauge platform adoption.
3. As an admin, I want to see which course is the top earner, so that I can identify the most successful content.
4. As an admin, I want to view a revenue-over-time chart, so that I can identify trends and growth patterns.
5. As an admin, I want to filter the time period (7d, 30d, 12m, all), so that I can analyze different time windows.
6. As an admin, I want to see a table of all courses with their revenue, sales, enrollments, and ratings, so that I can compare course performance.
7. As an admin, I want to see which instructor owns each course in the table, so that I can attribute performance to instructors.
8. As an admin, I want to filter the course table by instructor, so that I can focus on a specific instructor's courses.
9. As an admin, I want the revenue chart to show combined revenue across all courses, so that I get a single platform-wide trend line.
10. As an admin, I want the dashboard to respect the same time period options as the existing instructor analytics (7d, 30d, 12m, all), so that the experience is consistent.
11. As an admin, I want the dashboard to be accessible from the admin sidebar, so that I can navigate to it easily.
12. As an admin, I want the page to be restricted to admin users only, so that sensitive revenue data is protected.
13. As an admin, I want to see the course list price in the table, so that I can compare revenue against pricing.
14. As an admin, I want to see average ratings per course, so that I can correlate quality with revenue.
15. As an admin, I want to see an appropriate empty state when there is no data, so that the page is not confusing when the platform is new.

## Implementation Decisions

- Add new functions to the existing analytics service that aggregate data across all instructors rather than filtering by a single instructor. The existing per-instructor functions should remain unchanged.
- The admin analytics route will be a new route under the admin namespace, following the same pattern as other admin routes (role check in loader, 403 if not admin).
- The revenue-over-time chart will use the same Recharts-based line chart approach as the existing instructor analytics, but showing a single combined revenue line across all courses.
- The per-course breakdown table will extend the existing table format with an additional "Instructor" column showing the instructor's name.
- The instructor filter will be a dropdown select above the course table. When "All Instructors" is selected (default), all courses are shown. When a specific instructor is selected, only their courses appear. The filter should be applied server-side in the loader.
- Summary cards will display: Total Revenue, Total Enrollments, and Top Earning Course (course name and its revenue amount).
- Time period selection will use the same tab-based UI pattern (7d, 30d, 12m, all) as the existing instructor analytics, defaulting to 30d.
- Revenue values are stored in cents in the purchases table and should be formatted using the existing `formatPrice` utility.
- The daily/monthly granularity logic for chart data points follows the same rules as existing analytics: daily for 7d/30d, monthly for 12m/all.
- Add an "Analytics" link to the admin sidebar navigation, alongside the existing Users, Courses, and Categories links.

## Out of Scope

- Revenue export or download (CSV, PDF, etc.)
- Revenue breakdown by instructor as a separate chart or summary
- Filtering the revenue chart by instructor or course (chart always shows combined total)
- PPP discount impact analysis or comparison of full price vs. discounted revenue
- Coupon redemption statistics
- Real-time or auto-refreshing data
- Comparison views (e.g., this period vs. last period)
- Per-instructor summary cards or instructor ranking

## Further Notes

- The existing `AnalyticsDashboard` component is shared between the instructor and admin-per-instructor views. The admin analytics dashboard will likely need its own component since it has different summary cards (Top Earning Course) and table columns (Instructor column + filter). However, individual sub-components like the chart may be reusable.
- The instructor filter dropdown should be populated from the list of instructors who have at least one course, not all users with the instructor role.
