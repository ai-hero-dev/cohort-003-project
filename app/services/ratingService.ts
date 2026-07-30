import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courseRatings,
  courses,
  enrollments,
  MAX_RATING,
  MIN_RATING,
} from "~/db/schema";

// ─── Rating Service ───
// Handles star-only course ratings (no written reviews). One rating per user
// per course; re-rating overwrites the previous value.
// Uses positional parameters (project convention).

export type RatingSummary = {
  /** Mean rating rounded to one decimal, or null when nothing has been rated. */
  average: number | null;
  count: number;
};

const EMPTY_SUMMARY: RatingSummary = { average: null, count: 0 };

export function getRatingById(id: number) {
  return db.select().from(courseRatings).where(eq(courseRatings.id, id)).get();
}

export function getUserRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function getRatingsByCourse(courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .all();
}

export function getCourseRatingSummary(courseId: number): RatingSummary {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  if (!result || result.count === 0) return EMPTY_SUMMARY;

  return {
    average: roundToOneDecimal(result.average),
    count: result.count,
  };
}

/**
 * Batched version of getCourseRatingSummary for list views, so rendering a
 * grid of courses stays a single query. Course ids with no ratings are absent
 * from the map — callers should fall back to an empty summary.
 */
export function getRatingSummariesForCourses(courseIds: number[]) {
  const summaries = new Map<number, RatingSummary>();

  if (courseIds.length === 0) return summaries;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    summaries.set(row.courseId, {
      average: roundToOneDecimal(row.average),
      count: row.count,
    });
  }

  return summaries;
}

export function emptyRatingSummary(): RatingSummary {
  return EMPTY_SUMMARY;
}

/**
 * Only enrolled students may rate, and instructors may not rate their own
 * course. Mirrors the check enforced in rateCourse.
 */
export function canUserRateCourse(userId: number, courseId: number) {
  const course = db
    .select({ instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();

  if (!course) return false;
  if (course.instructorId === userId) return false;

  return !!db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
    )
    .get();
}

export function rateCourse(userId: number, courseId: number, rating: number) {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new Error(`Rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}`);
  }

  if (!canUserRateCourse(userId, courseId)) {
    throw new Error("Only enrolled students can rate this course");
  }

  const existing = getUserRating(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function removeRating(userId: number, courseId: number) {
  const existing = getUserRating(userId, courseId);
  if (!existing) {
    throw new Error("User has not rated this course");
  }

  return db
    .delete(courseRatings)
    .where(eq(courseRatings.id, existing.id))
    .returning()
    .get();
}

function roundToOneDecimal(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}
