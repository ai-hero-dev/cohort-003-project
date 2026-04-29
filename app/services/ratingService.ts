import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function rateCourse(userId: number, courseId: number, rating: number) {
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
    return db
      .update(courseRatings)
      .set({ rating, createdAt: new Date().toISOString() })
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

export function getAverageRating(courseId: number) {
  const result = db
    .select({
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ? Math.round(result.average * 10) / 10 : null,
    count: result?.count ?? 0,
  };
}

export function getAverageRatingsForCourses(courseIds: number[]) {
  if (courseIds.length === 0) return new Map<number, { average: number | null; count: number }>();

  const results = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .groupBy(courseRatings.courseId)
    .all();

  const map = new Map<number, { average: number | null; count: number }>();
  for (const row of results) {
    map.set(row.courseId, {
      average: row.average ? Math.round(row.average * 10) / 10 : null,
      count: row.count,
    });
  }
  return map;
}
