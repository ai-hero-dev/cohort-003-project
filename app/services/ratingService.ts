import { eq, and, avg, count, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getCourseAverageRating(courseId: number): {
  average: number | null;
  count: number;
} {
  const result = db
    .select({
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  const rawAvg = result?.average;
  return {
    average: rawAvg != null ? parseFloat(String(rawAvg)) : null,
    count: result?.count ?? 0,
  };
}

export function getCourseAverageRatings(
  courseIds: number[]
): Map<number, { average: number | null; count: number }> {
  if (courseIds.length === 0) return new Map();

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(
      sql`${courseRatings.courseId} IN (${sql.join(
        courseIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(courseRatings.courseId)
    .all();

  const map = new Map<number, { average: number | null; count: number }>();
  for (const row of rows) {
    map.set(row.courseId, {
      average: row.average != null ? parseFloat(String(row.average)) : null,
      count: row.count,
    });
  }
  return map;
}

export function getUserRatingForCourse(
  userId: number,
  courseId: number
): number | null {
  const row = db
    .select({ rating: courseRatings.rating })
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();

  return row?.rating ?? null;
}

export function upsertCourseRating(
  userId: number,
  courseId: number,
  rating: number
) {
  const existing = db
    .select({ id: courseRatings.id })
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();

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
