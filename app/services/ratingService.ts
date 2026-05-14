import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings, enrollments } from "~/db/schema";

// ─── Rating Service ───
// One rating per enrolled student per course, immutable after submission.
// Averages are computed on read via SQL aggregates (no denormalization).

export function submitRating(userId: number, courseId: number, rating: number) {
  const enrollment = db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
    )
    .get();

  if (!enrollment) {
    throw new Error("User is not enrolled in this course");
  }

  const existing = db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();

  if (existing) {
    throw new Error("User has already rated this course");
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getRatingForUser(userId: number, courseId: number) {
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

export function getCourseRatingStats(courseId: number) {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ?? null,
    count: result?.count ?? 0,
  };
}

export function getCourseRatingStatsForCourses(courseIds: number[]) {
  const stats = new Map<number, { average: number | null; count: number }>();

  for (const id of courseIds) {
    stats.set(id, { average: null, count: 0 });
  }

  if (courseIds.length === 0) {
    return stats;
  }

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
    stats.set(row.courseId, {
      average: row.average ?? null,
      count: row.count ?? 0,
    });
  }

  return stats;
}
