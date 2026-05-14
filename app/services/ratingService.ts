import { eq, and } from "drizzle-orm";
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
