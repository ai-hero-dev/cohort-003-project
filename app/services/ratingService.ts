import { eq, and, avg, count } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getCourseAverageRating(courseId: number) {
  const result = db
    .select({
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ? Math.round(Number(result.average) * 10) / 10 : null,
    count: result?.count ?? 0,
  };
}

export function getUserRatingForCourse(userId: number, courseId: number) {
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

export function upsertCourseRating(userId: number, courseId: number, rating: number) {
  const existing = getUserRatingForCourse(userId, courseId);
  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating })
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
