import { sql, eq } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courseRatings, courses } from "~/db/schema";

// ─── Analytics Service ───
// Encapsulates all database query logic for the instructor analytics dashboard.
// Takes an instructor ID and time period, returns summary data.

export type TimePeriod = "7d" | "30d" | "12m" | "all";

export interface AnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

function getStartDate(period: TimePeriod): string | null {
  if (period === "all") return null;

  const now = new Date();
  switch (period) {
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "30d":
      now.setDate(now.getDate() - 30);
      break;
    case "12m":
      now.setMonth(now.getMonth() - 12);
      break;
  }
  return now.toISOString();
}

export function getAnalyticsSummary(opts: {
  instructorId: number;
  period: TimePeriod;
}): AnalyticsSummary {
  const { instructorId, period } = opts;
  const startDate = getStartDate(period);

  // Get all course IDs for this instructor
  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      totalRevenue: 0,
      totalEnrollments: 0,
      averageRating: null,
      ratingCount: 0,
    };
  }

  // Build the IN clause for course IDs
  const courseIdList = sql.join(
    courseIds.map((id) => sql`${id}`),
    sql`, `
  );

  // Total revenue
  const revenueResult = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(
      startDate
        ? sql`${purchases.courseId} IN (${courseIdList}) AND ${purchases.createdAt} >= ${startDate}`
        : sql`${purchases.courseId} IN (${courseIdList})`
    )
    .get();

  // Total enrollments
  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      startDate
        ? sql`${enrollments.courseId} IN (${courseIdList}) AND ${enrollments.enrolledAt} >= ${startDate}`
        : sql`${enrollments.courseId} IN (${courseIdList})`
    )
    .get();

  // Average rating and count
  const ratingResult = db
    .select({
      avg: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(
      startDate
        ? sql`${courseRatings.courseId} IN (${courseIdList}) AND ${courseRatings.createdAt} >= ${startDate}`
        : sql`${courseRatings.courseId} IN (${courseIdList})`
    )
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentResult?.count ?? 0,
    averageRating: ratingResult?.avg ?? null,
    ratingCount: ratingResult?.count ?? 0,
  };
}
