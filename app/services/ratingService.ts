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
