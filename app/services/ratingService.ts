import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { ratings } from "~/db/schema";

export type CourseRatingStats = {
  average: number | null;
  count: number;
};

export function getUserRating(userId: number, courseId: number) {
  return db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.courseId, courseId)))
    .get();
}

export function upsertRating(
  userId: number,
  courseId: number,
  rating: number
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  const existing = getUserRating(userId, courseId);

  if (existing) {
    return db
      .update(ratings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(ratings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(ratings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getCourseRatingStats(courseId: number): CourseRatingStats {
  const result = db
    .select({
      average: sql<number | null>`avg(${ratings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(eq(ratings.courseId, courseId))
    .get();

  return {
    average: result?.average ?? null,
    count: result?.count ?? 0,
  };
}

export function getRatingStatsForCourses(
  courseIds: number[]
): Map<number, CourseRatingStats> {
  const stats = new Map<number, CourseRatingStats>();
  if (courseIds.length === 0) return stats;

  const rows = db
    .select({
      courseId: ratings.courseId,
      average: sql<number>`avg(${ratings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(ratings)
    .where(inArray(ratings.courseId, courseIds))
    .groupBy(ratings.courseId)
    .all();

  for (const row of rows) {
    stats.set(row.courseId, { average: row.average, count: row.count });
  }
  return stats;
}
