# Course Rating Feature — Design Spec

## Overview

Add star-based course ratings (1-5) for enrolled students. Each student can rate a course once (immutable). The average rating is displayed everywhere courses appear in the UI.

## Data Model

New `ratings` table in `app/db/schema.ts`:

| Column    | Type    | Notes                          |
|-----------|---------|--------------------------------|
| id        | integer | primary key, autoincrement     |
| userId    | integer | FK -> users, not null          |
| courseId   | integer | FK -> courses, not null        |
| rating    | integer | 1-5, not null                  |
| createdAt | text    | ISO timestamp, default now     |

- Unique constraint on `(userId, courseId)` — one rating per student per course, enforced at the DB level.

## Service Layer

New `app/services/ratingService.ts` with:

- `createRating(userId, courseId, rating)` — inserts a rating. Relies on the unique constraint to prevent duplicates.
- `getRatingByUserAndCourse(userId, courseId)` — returns the user's rating for a course, or null.
- `getAverageRating(courseId)` — returns `{ average: number, count: number }` via SQL `AVG` and `COUNT`.
- `getAverageRatingsForCourses(courseIds)` — batch query for course listings, returns a map of `courseId -> { average, count }`.

New `app/services/ratingService.test.ts` — tests for create, duplicate prevention, average calculation, per-user lookup. Follows existing test patterns (e.g., `enrollmentService.test.ts`).

## UI Component

New `app/components/star-rating.tsx` — a reusable `StarRating` component with two modes:

- **Display mode**: Renders filled/empty stars with average and count text (e.g., 4.2 (18 ratings)). Read-only.
- **Interactive mode**: Clickable stars with hover state. Used for rating submission.

Uses Lucide `Star` icon (already in the project). Courses with no ratings show nothing (no stars, no text).

## Rating Submission

- Only enrolled students can rate — checked server-side.
- Submitted via a React Router form action (POST) on the course detail page (`courses.$slug.tsx`).
- Once rated, the student sees their locked-in filled stars (non-interactive).
- Validation: Zod schema, integer 1-5.
- Duplicate attempt: unique constraint error caught, returns user-friendly message.
- Not enrolled: server-side check, returns error.

## Display Locations

The display-mode `StarRating` appears in every place courses are shown:

| Location                  | File                    | Placement                          |
|---------------------------|-------------------------|------------------------------------|
| Home — featured courses   | `home.tsx`              | Card footer                        |
| Browse — course grid      | `courses.tsx`           | Card footer, near instructor/price |
| Dashboard — in progress   | `dashboard.tsx`         | Card content                       |
| Dashboard — completed     | `dashboard.tsx`         | Card content                       |
| Course detail — hero      | `courses.$slug.tsx`     | Near lesson count/duration stats   |
| Course detail — sidebar   | `courses.$slug.tsx`     | In the sticky sidebar card         |
| Instructor dashboard      | `instructor.tsx`        | Card content, near enrollment stats|

## Migration

New Drizzle migration generated via `pnpm db:generate` after schema changes.