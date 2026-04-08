# Course Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1-5 star ratings for enrolled students, displayed as averages everywhere courses appear.

**Architecture:** New `ratings` table + `ratingService` for data access + `StarRating` component for display/input. Each route loader fetches rating averages alongside existing course data. Rating submission is handled via a form action on the course detail page.

**Tech Stack:** Drizzle ORM, SQLite, React Router v7, Lucide icons, Vitest

---

### Task 1: Add ratings table to schema

**Files:**
- Modify: `app/db/schema.ts`

- [ ] **Step 1: Add the ratings table definition**

Add after the `videoWatchEvents` table at the end of `app/db/schema.ts`:

```typescript
import { uniqueIndex } from "drizzle-orm/sqlite-core";
```

Add this import alongside the existing `sqliteTable, text, integer, real` import at the top of the file. Then add the table at the end:

```typescript
export const ratings = sqliteTable(
  "ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id),
    rating: integer("rating").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("ratings_user_course_unique").on(table.userId, table.courseId)]
);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: A new migration file appears in `drizzle/` (e.g., `0003_*.sql`)

- [ ] **Step 3: Run the migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

- [ ] **Step 4: Commit**

```bash
git add app/db/schema.ts drizzle/
git commit -m "feat: add ratings table to schema"
```

---

### Task 2: Create ratingService with tests (TDD)

**Files:**
- Create: `app/services/ratingService.ts`
- Create: `app/services/ratingService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/services/ratingService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createRating,
  getRatingByUserAndCourse,
  getAverageRating,
  getAverageRatingsForCourses,
} from "./ratingService";

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createRating", () => {
    it("creates a rating", () => {
      const rating = createRating(base.user.id, base.course.id, 4);

      expect(rating).toBeDefined();
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.rating).toBe(4);
      expect(rating.createdAt).toBeDefined();
    });

    it("throws on duplicate rating for same user and course", () => {
      createRating(base.user.id, base.course.id, 4);

      expect(() =>
        createRating(base.user.id, base.course.id, 5)
      ).toThrow();
    });
  });

  describe("getRatingByUserAndCourse", () => {
    it("returns the rating when it exists", () => {
      createRating(base.user.id, base.course.id, 3);

      const found = getRatingByUserAndCourse(base.user.id, base.course.id);
      expect(found).toBeDefined();
      expect(found!.rating).toBe(3);
    });

    it("returns undefined when no rating exists", () => {
      const found = getRatingByUserAndCourse(base.user.id, base.course.id);
      expect(found).toBeUndefined();
    });
  });

  describe("getAverageRating", () => {
    it("returns average and count", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      createRating(base.user.id, base.course.id, 4);
      createRating(student2.id, base.course.id, 2);

      const result = getAverageRating(base.course.id);
      expect(result.average).toBe(3);
      expect(result.count).toBe(2);
    });

    it("returns 0 average and 0 count when no ratings exist", () => {
      const result = getAverageRating(base.course.id);
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe("getAverageRatingsForCourses", () => {
    it("returns a map of courseId to average and count", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      createRating(base.user.id, base.course.id, 5);
      createRating(base.user.id, course2.id, 3);

      const result = getAverageRatingsForCourses([base.course.id, course2.id]);
      expect(result.get(base.course.id)).toEqual({ average: 5, count: 1 });
      expect(result.get(course2.id)).toEqual({ average: 3, count: 1 });
    });

    it("returns empty map for empty input", () => {
      const result = getAverageRatingsForCourses([]);
      expect(result.size).toBe(0);
    });

    it("omits courses with no ratings from the map", () => {
      const result = getAverageRatingsForCourses([base.course.id]);
      expect(result.has(base.course.id)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test app/services/ratingService.test.ts`
Expected: FAIL — module `./ratingService` cannot resolve exports

- [ ] **Step 3: Write the ratingService implementation**

Create `app/services/ratingService.ts`:

```typescript
import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { ratings } from "~/db/schema";

export function createRating(userId: number, courseId: number, rating: number) {
  return db
    .insert(ratings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getRatingByUserAndCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.courseId, courseId)))
    .get();
}

export function getAverageRating(courseId: number) {
  const result = db
    .select({
      average: sql<number>`coalesce(avg(${ratings.rating}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(eq(ratings.courseId, courseId))
    .get();

  return {
    average: result ? Number(result.average) : 0,
    count: result ? Number(result.count) : 0,
  };
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  const map = new Map<number, { average: number; count: number }>();
  if (courseIds.length === 0) return map;

  const results = db
    .select({
      courseId: ratings.courseId,
      average: sql<number>`avg(${ratings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(inArray(ratings.courseId, courseIds))
    .groupBy(ratings.courseId)
    .all();

  for (const row of results) {
    map.set(row.courseId, {
      average: Number(row.average),
      count: Number(row.count),
    });
  }

  return map;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test app/services/ratingService.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/ratingService.ts app/services/ratingService.test.ts
git commit -m "feat: add ratingService with tests"
```

---

### Task 3: Create StarRating component

**Files:**
- Create: `app/components/star-rating.tsx`

- [ ] **Step 1: Create the StarRating component**

Create `app/components/star-rating.tsx`:

```tsx
import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingDisplayProps {
  average: number;
  count: number;
}

export function StarRatingDisplay({ average, count }: StarRatingDisplayProps) {
  if (count === 0) return null;

  const rounded = Math.round(average * 10) / 10;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-3.5 ${
              i < Math.round(average)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rounded} ({count})
      </span>
    </div>
  );
}

interface StarRatingInputProps {
  courseId: number;
}

export function StarRatingInput({ courseId }: StarRatingInputProps) {
  const [hoveredStar, setHoveredStar] = useState(0);

  return (
    <form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="rate" />
      <span className="text-sm text-muted-foreground">Rate this course:</span>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          return (
            <button
              key={i}
              type="submit"
              name="rating"
              value={starValue}
              onMouseEnter={() => setHoveredStar(starValue)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-0.5 transition-transform hover:scale-110"
              title={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
            >
              <Star
                className={`size-5 ${
                  starValue <= hoveredStar
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          );
        })}
      </div>
    </form>
  );
}

interface StarRatingLockedProps {
  rating: number;
}

export function StarRatingLocked({ rating }: StarRatingLockedProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Your rating:</span>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-5 ${
              i < rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/star-rating.tsx
git commit -m "feat: add StarRating display, input, and locked components"
```

---

### Task 4: Add rating submission to course detail page

**Files:**
- Modify: `app/routes/courses.$slug.tsx`

- [ ] **Step 1: Add rating imports and loader data**

In `app/routes/courses.$slug.tsx`, add these imports at the top:

```typescript
import { getAverageRating, getRatingByUserAndCourse, createRating } from "~/services/ratingService";
import { isUserEnrolled as checkEnrolled } from "~/services/enrollmentService";
import { StarRatingDisplay, StarRatingInput, StarRatingLocked } from "~/components/star-rating";
import { z } from "zod";
```

In the `loader` function, before the `return` statement, add:

```typescript
  const ratingInfo = getAverageRating(course.id);
  const userRating = currentUserId
    ? getRatingByUserAndCourse(currentUserId, course.id)
    : null;
```

Add `ratingInfo` and `userRating` to the returned object:

```typescript
  return {
    course: courseWithDetails,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    ratingInfo,
    userRating: userRating ? { rating: userRating.rating } : null,
  };
```

- [ ] **Step 2: Add the action handler**

Replace the `// No action` comment with:

```typescript
const ratingSchema = z.object({
  intent: z.literal("rate"),
  rating: z.coerce.number().int().min(1).max(5),
});

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    return { error: "You must be logged in to rate a course." };
  }

  const slug = params.slug;
  const course = getCourseBySlug(slug);
  if (!course) {
    return { error: "Course not found." };
  }

  if (!isUserEnrolled(currentUserId, course.id)) {
    return { error: "You must be enrolled to rate this course." };
  }

  const formData = await request.formData();
  const parsed = ratingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Invalid rating. Please select 1-5 stars." };
  }

  try {
    createRating(currentUserId, course.id, parsed.data.rating);
  } catch {
    return { error: "You have already rated this course." };
  }

  return { success: true };
}
```

- [ ] **Step 3: Add rating display to the hero section**

In the component, destructure `ratingInfo` and `userRating` from `loaderData`:

```typescript
  const {
    course,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    ratingInfo,
    userRating,
  } = loaderData;
```

In the hero section, after the stats row (the `<div>` with instructor name, lesson count, and duration at around line 304-323), add:

```tsx
        {ratingInfo.count > 0 && (
          <div className="mt-3">
            <StarRatingDisplay average={ratingInfo.average} count={ratingInfo.count} />
          </div>
        )}
```

- [ ] **Step 4: Add rating input/locked to the sidebar card**

In the sidebar `<CardContent>`, after the enrolled section's "Buy More Seats" button (after the `</Link>` for team purchase around line 415), add:

```tsx
                  <div className="border-t pt-4">
                    {userRating ? (
                      <StarRatingLocked rating={userRating.rating} />
                    ) : (
                      <StarRatingInput courseId={course.id} />
                    )}
                  </div>
```

- [ ] **Step 5: Run the dev server and verify manually**

Run: `pnpm dev`
- Navigate to a course detail page as an enrolled student
- Verify the star input appears in the sidebar
- Click a star to submit a rating
- Verify the rating locks and the average updates in the hero section

- [ ] **Step 6: Commit**

```bash
git add app/routes/courses.\$slug.tsx
git commit -m "feat: add rating submission and display to course detail page"
```

---

### Task 5: Add ratings to course catalog page

**Files:**
- Modify: `app/routes/courses.tsx`

- [ ] **Step 1: Add rating imports**

Add at the top of `app/routes/courses.tsx`:

```typescript
import { getAverageRatingsForCourses } from "~/services/ratingService";
import { StarRatingDisplay } from "~/components/star-rating";
```

- [ ] **Step 2: Fetch ratings in the loader**

In the loader, after the `coursesWithLessonCount` mapping, add:

```typescript
  const courseIds = coursesWithLessonCount.map((c) => c.id);
  const ratingsMap = getAverageRatingsForCourses(courseIds);

  const coursesWithRatings = coursesWithLessonCount.map((course) => {
    const rating = ratingsMap.get(course.id);
    return {
      ...course,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    };
  });
```

Update the return statement to use `coursesWithRatings` instead of `coursesWithLessonCount`:

```typescript
  return { courses: coursesWithRatings, categories, search, category, currentUserId };
```

- [ ] **Step 3: Add StarRatingDisplay to the course card**

In the `CardFooter` (around line 229), add the star display between the instructor avatar and the price. Replace the entire `<CardFooter>` with:

```tsx
                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5">
                      <UserAvatar
                        name={course.instructorName}
                        avatarUrl={course.instructorAvatarUrl}
                        className="size-5"
                      />
                      {course.instructorName}
                    </span>
                    <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
                  </div>
                  <span className="font-semibold text-foreground">
                    {course.pppPrice < course.price ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs line-through text-muted-foreground font-normal">
                          {formatPrice(course.price)}
                        </span>
                        {formatPrice(course.pppPrice)}
                      </span>
                    ) : (
                      formatPrice(course.price)
                    )}
                  </span>
                </CardFooter>
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/courses.tsx
git commit -m "feat: add rating display to course catalog"
```

---

### Task 6: Add ratings to home page featured courses

**Files:**
- Modify: `app/routes/home.tsx`

- [ ] **Step 1: Add rating imports**

Add at the top of `app/routes/home.tsx`:

```typescript
import { getAverageRatingsForCourses } from "~/services/ratingService";
import { StarRatingDisplay } from "~/components/star-rating";
```

- [ ] **Step 2: Fetch ratings in the loader**

After the `featured` mapping (around line 28), add:

```typescript
  const featuredIds = featured.map((c) => c.id);
  const ratingsMap = getAverageRatingsForCourses(featuredIds);

  const featuredWithRatings = featured.map((course) => {
    const rating = ratingsMap.get(course.id);
    return {
      ...course,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    };
  });
```

Update the return to use `featuredWithRatings` instead of `featured`:

```typescript
    featuredCourses: featuredWithRatings,
```

- [ ] **Step 3: Add StarRatingDisplay to the featured course card**

In the `<CardFooter>` (around line 190), add after the lessons span:

```tsx
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {course.instructorName ?? "Instructor"}
                    </span>
                    <div className="flex items-center gap-3">
                      <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
                      <span className="flex items-center gap-1">
                        <BookOpen className="size-3" />
                        {course.lessonCount} lessons
                      </span>
                    </div>
                  </CardFooter>
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/home.tsx
git commit -m "feat: add rating display to home page featured courses"
```

---

### Task 7: Add ratings to dashboard

**Files:**
- Modify: `app/routes/dashboard.tsx`

- [ ] **Step 1: Add rating imports**

Add at the top of `app/routes/dashboard.tsx`:

```typescript
import { getAverageRatingsForCourses } from "~/services/ratingService";
import { StarRatingDisplay } from "~/components/star-rating";
```

- [ ] **Step 2: Fetch ratings in the loader**

After the `coursesWithProgress` mapping (around line 57), add:

```typescript
  const allCourseIds = coursesWithProgress.map((c) => c.courseId);
  const ratingsMap = getAverageRatingsForCourses(allCourseIds);

  const coursesWithRatings = coursesWithProgress.map((course) => {
    const rating = ratingsMap.get(course.courseId);
    return {
      ...course,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    };
  });
```

Update the completed/inProgress filtering to use `coursesWithRatings`:

```typescript
  const completedCourses = coursesWithRatings.filter((c) => c.isCompleted);
  const inProgressCourses = coursesWithRatings.filter((c) => !c.isCompleted);
```

- [ ] **Step 3: Add StarRatingDisplay to in-progress course cards**

In the in-progress cards, after the progress bar `<div>` (around line 177), add:

```tsx
                      <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
```

- [ ] **Step 4: Add StarRatingDisplay to completed course cards**

In the completed cards, after the "Completed" status line (around line 242), add:

```tsx
                      <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/dashboard.tsx
git commit -m "feat: add rating display to student dashboard"
```

---

### Task 8: Add ratings to instructor dashboard

**Files:**
- Modify: `app/routes/instructor.tsx`

- [ ] **Step 1: Add rating imports**

Add at the top of `app/routes/instructor.tsx`:

```typescript
import { getAverageRatingsForCourses } from "~/services/ratingService";
import { StarRatingDisplay } from "~/components/star-rating";
```

- [ ] **Step 2: Fetch ratings in the loader**

After the `coursesWithStats` mapping (around line 57), add:

```typescript
  const courseIds = coursesWithStats.map((c) => c.id);
  const ratingsMap = getAverageRatingsForCourses(courseIds);

  const coursesWithRatings = coursesWithStats.map((course) => {
    const rating = ratingsMap.get(course.id);
    return {
      ...course,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    };
  });
```

Update the return to use `coursesWithRatings`:

```typescript
  return { courses: coursesWithRatings };
```

- [ ] **Step 3: Add StarRatingDisplay to instructor course cards**

In the `<CardContent>` (around line 191), after the enrollment stats `<div>`, add:

```tsx
                <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/instructor.tsx
git commit -m "feat: add rating display to instructor dashboard"
```

---

### Task 9: Run all tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass, including the new `ratingService.test.ts`

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Final commit if any fixes were needed**

If any fixes were required, commit them:

```bash
git add -A
git commit -m "fix: address test/type issues in course rating feature"
```
