# Course Star Ratings — Design Spec

**Date:** 2026-05-13
**Status:** Approved

## Summary

Add a star-rating system to Cadence so enrolled students can rate courses (1–5 stars, one rating per student, updatable at any time). The average rating is displayed wherever courses appear: the course list page and the course detail page.

---

## Requirements

- Only enrolled students may submit a rating.
- Ratings are integers 1–5.
- One rating per student per course; the student may update their rating at any time. The latest submission replaces the previous value.
- The average rating (and count) is visible on the course list cards and the course detail page.
- No written reviews — star rating only.

---

## Data Layer

### New table: `course_ratings`

| Column      | Type    | Constraints                        |
|-------------|---------|-------------------------------------|
| id          | INTEGER | PK, autoincrement                  |
| userId      | INTEGER | FK → users.id, NOT NULL            |
| courseId    | INTEGER | FK → courses.id, NOT NULL          |
| rating      | INTEGER | NOT NULL, 1–5                      |
| createdAt   | TEXT    | NOT NULL, defaultFn ISO string     |
|             |         | UNIQUE(userId, courseId)           |

The `UNIQUE(userId, courseId)` constraint enforces one-rating-per-student at the database level.

### Migration

New Drizzle migration: `drizzle/000X_course_ratings.sql` (generated via `pnpm drizzle-kit generate`).

### Schema addition (`app/db/schema.ts`)

```ts
export const courseRatings = sqliteTable(
  "course_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    courseId: integer("course_id").notNull().references(() => courses.id),
    rating: integer("rating").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => ({ uniq: unique().on(t.userId, t.courseId) })
);
```

---

## Service Layer

**New file:** `app/services/ratingService.ts`

| Function | Description |
|---|---|
| `submitRating(userId, courseId, rating)` | Upserts the rating (insert on first call, update on subsequent calls via `ON CONFLICT (userId, courseId) DO UPDATE`). Throws if user is not enrolled. |
| `getRatingForUser(userId, courseId)` | Returns the user's existing rating row, or `undefined`. |
| `getCourseRatingStats(courseId)` | Returns `{ average: number \| null, count: number }` via `AVG` + `COUNT`. |
| `getCourseRatingStatsForCourses(courseIds[])` | Bulk version — one SQL query for the list page; returns a `Map<courseId, stats>`. |

Average is computed on read via SQL aggregate — no denormalization on the `courses` table.

---

## API Route

**New file:** `app/routes/api.rate-course.ts` (POST only)

Steps:
1. Require authenticated user → 401 if not.
2. Parse and validate `courseId` (integer) and `rating` (integer 1–5) from form body using Zod.
3. Verify user is enrolled in the course → 403 if not.
4. Call `submitRating()` (which upserts) and return `{ ok: true }` JSON.

Route registered in `app/routes.ts` alongside the other `api.*` routes.

---

## UI Components

### `StarRating` component (`app/components/star-rating.tsx`)

Two modes via a `mode` prop:

- **`mode="display"`** — read-only; renders filled/partial/empty stars from a float average. Accepts `average: number | null` and `count: number`.
- **`mode="input"`** — interactive; 5 clickable stars with hover highlight. Pre-highlights the user's existing rating (if any) when not hovering. On click, submits a hidden form (via `useFetcher`, so no navigation) to `/api/rate-course`. Accepts `courseId: number` and `currentRating: number | null`.

### Course list page (`app/routes/courses.tsx`)

- Loader adds a bulk `getCourseRatingStatsForCourses` call (one query).
- Each `CourseCard` renders `<StarRating mode="display" />` in the `CardFooter` alongside instructor name and price.
- Shows "X ratings" count. If no ratings yet, renders nothing.

### Course detail page (`app/routes/courses.$slug.tsx`)

**Hero section (read-only for all):**
- `<StarRating mode="display" />` added to the metadata row (instructor / lessons / duration).

**Sidebar card (enrolled students only):**
- Always shows `<StarRating mode="input" courseId={course.id} currentRating={userRating?.rating ?? null} />`.
- Label is "Your rating" if the user has already rated, otherwise "Rate this course".
- Non-enrolled visitors: no rating UI in sidebar.

Loader additions:
- `getCourseRatingStats(course.id)` for the display stats.
- `getRatingForUser(currentUserId, course.id)` for the user's existing rating (`undefined` from the service, treated as `null` in the loader when not enrolled or not yet rated).

---

## Data Flow

```
User clicks a star (course detail page)
  → StarRating submits via useFetcher().Form to /api/rate-course
  → api.rate-course action: validates → checks enrollment → upserts rating
  → React Router revalidates courses.$slug loader (no navigation)
  → Updated average + user's own rating rendered automatically
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Not logged in | 401 — redirect to login |
| Not enrolled | 403 — ignored silently on client (button never shown) |
| Invalid rating value | Zod validation → 400 with error message |

---

## Testing

- **`ratingService.test.ts`** — unit tests for all four service functions: happy path, update-on-resubmit, non-enrollment rejection, bulk stats.
- No route-level tests (consistent with the rest of the codebase).
