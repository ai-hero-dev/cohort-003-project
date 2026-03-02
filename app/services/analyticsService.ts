import { sql, eq } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courseRatings, courses } from "~/db/schema";

// ─── Analytics Service ───
// Encapsulates all database query logic for the instructor analytics dashboard.
// Takes an instructor ID and time period, returns summary, time series, and per-course data.

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

// ─── Revenue Time Series ───

export interface RevenueDataPoint {
  date: string; // YYYY-MM-DD for daily, YYYY-MM for monthly
  revenue: number; // in cents
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function generateDailyKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

function generateMonthlyKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (current <= end) {
    keys.push(formatMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }
  return keys;
}

export function getRevenueTimeSeries(opts: {
  instructorId: number;
  period: TimePeriod;
}): RevenueDataPoint[] {
  const { instructorId, period } = opts;

  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);
  if (courseIds.length === 0) return [];

  const courseIdList = sql.join(
    courseIds.map((id) => sql`${id}`),
    sql`, `
  );

  const now = new Date();
  const useDaily = period === "7d" || period === "30d";

  // Determine the start date for the range
  let rangeStart: Date;
  const startDateStr = getStartDate(period);
  if (startDateStr) {
    rangeStart = new Date(startDateStr);
  } else {
    // "all" period: find the earliest purchase date
    const earliest = db
      .select({
        minDate: sql<string | null>`min(${purchases.createdAt})`,
      })
      .from(purchases)
      .where(sql`${purchases.courseId} IN (${courseIdList})`)
      .get();

    if (!earliest?.minDate) return [];
    rangeStart = new Date(earliest.minDate);
  }

  // Generate all date/month keys in range
  const keys = useDaily
    ? generateDailyKeys(rangeStart, now)
    : generateMonthlyKeys(rangeStart, now);

  // Query revenue grouped by date/month
  const groupExpr = useDaily
    ? sql<string>`substr(${purchases.createdAt}, 1, 10)`
    : sql<string>`substr(${purchases.createdAt}, 1, 7)`;

  const whereClause = startDateStr
    ? sql`${purchases.courseId} IN (${courseIdList}) AND ${purchases.createdAt} >= ${startDateStr}`
    : sql`${purchases.courseId} IN (${courseIdList})`;

  const rows = db
    .select({
      dateKey: groupExpr,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(whereClause)
    .groupBy(groupExpr)
    .all();

  const revenueMap = new Map(rows.map((r) => [r.dateKey, r.revenue]));

  return keys.map((key) => ({
    date: key,
    revenue: revenueMap.get(key) ?? 0,
  }));
}

// ─── Per-Course Breakdown ───

export interface CourseAnalytics {
  courseId: number;
  title: string;
  slug: string;
  listPrice: number;
  revenue: number;
  salesCount: number;
  enrollmentCount: number;
  averageRating: number | null;
  ratingCount: number;
}

export function getPerCourseBreakdown(opts: {
  instructorId: number;
  period: TimePeriod;
}): CourseAnalytics[] {
  const { instructorId, period } = opts;
  const startDate = getStartDate(period);

  const instructorCourses = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      price: courses.price,
    })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  if (instructorCourses.length === 0) return [];

  return instructorCourses.map((course) => {
    const purchaseWhere = startDate
      ? sql`${purchases.courseId} = ${course.id} AND ${purchases.createdAt} >= ${startDate}`
      : sql`${purchases.courseId} = ${course.id}`;

    const revenueResult = db
      .select({
        revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(purchases)
      .where(purchaseWhere)
      .get();

    const enrollmentWhere = startDate
      ? sql`${enrollments.courseId} = ${course.id} AND ${enrollments.enrolledAt} >= ${startDate}`
      : sql`${enrollments.courseId} = ${course.id}`;

    const enrollmentResult = db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(enrollmentWhere)
      .get();

    const ratingWhere = startDate
      ? sql`${courseRatings.courseId} = ${course.id} AND ${courseRatings.createdAt} >= ${startDate}`
      : sql`${courseRatings.courseId} = ${course.id}`;

    const ratingResult = db
      .select({
        avg: sql<number | null>`avg(${courseRatings.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(courseRatings)
      .where(ratingWhere)
      .get();

    return {
      courseId: course.id,
      title: course.title,
      slug: course.slug,
      listPrice: course.price,
      revenue: revenueResult?.revenue ?? 0,
      salesCount: revenueResult?.salesCount ?? 0,
      enrollmentCount: enrollmentResult?.count ?? 0,
      averageRating: ratingResult?.avg ?? null,
      ratingCount: ratingResult?.count ?? 0,
    };
  });
}
