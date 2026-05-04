import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "~/db";
import { coupons, courses, CourseStatus, purchases } from "~/db/schema";

// ─── Analytics Service ───
// Single source of truth for revenue / student / purchase aggregations
// across instructor, course, and platform-wide scopes.

export type Range = "1w" | "1m" | "6m" | "all";
export type Bucket = "day" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

const FIXED_RANGE_TO_DAYS: Record<Exclude<Range, "all">, number> = {
  "1w": 7,
  "1m": 30,
  "6m": 180,
};

const RANGE_TO_BUCKET: Record<Range, Bucket> = {
  "1w": "day",
  "1m": "day",
  "6m": "week",
  all: "month",
};

const BUCKET_TO_DAYS: Record<Bucket, number> = {
  day: 1,
  week: 7,
  month: 30,
};

export type Kpis = {
  revenue: number;
  students: number;
  purchases: number;
  aov: number;
};

export type ChartBucket = {
  startIso: string;
  endIso: string;
  label: string;
  revenue: number;
};

export type PerCourseRow = {
  courseId: number;
  title: string;
  status: CourseStatus;
} & Kpis;

export type InstructorAnalytics = {
  range: Range;
  bucket: Bucket;
  kpis: Kpis;
  prevKpis: Kpis;
  chart: ChartBucket[];
  perCourse: PerCourseRow[];
};

export type CourseAnalytics = {
  range: Range;
  bucket: Bucket;
  courseId: number;
  title: string;
  instructorId: number;
  kpis: Kpis;
  prevKpis: Kpis;
  chart: ChartBucket[];
  byCountry: { country: string; revenue: number }[];
};

function aov(opts: { revenue: number; purchaseCount: number }): number {
  if (opts.purchaseCount === 0) return 0;
  return opts.revenue / opts.purchaseCount;
}

function computeWindow(opts: { range: Range; now: Date; courseIds: number[] }) {
  const end = opts.now;
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (opts.range === "all") {
    // "All time" begins at the earliest purchase across the relevant courses.
    // No previous window exists, so we collapse it to a zero-width range —
    // prevKpis come back as zero and the % change UI shows "—".
    const row =
      opts.courseIds.length === 0
        ? null
        : db
            .select({
              minCreatedAt: sql<string | null>`MIN(${purchases.createdAt})`,
            })
            .from(purchases)
            .where(inArray(purchases.courseId, opts.courseIds))
            .get();
    const earliestIso = row?.minCreatedAt ?? null;
    start = earliestIso ? new Date(earliestIso) : end;
    prevEnd = start;
    prevStart = start;
  } else {
    const days = FIXED_RANGE_TO_DAYS[opts.range];
    start = new Date(end.getTime() - days * DAY_MS);
    prevEnd = start;
    prevStart = new Date(start.getTime() - days * DAY_MS);
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    prevStartIso: prevStart.toISOString(),
    prevEndIso: prevEnd.toISOString(),
  };
}

function aggregateKpis(opts: {
  courseIds: number[];
  startIso: string;
  endIso: string;
}): Kpis {
  const { courseIds, startIso, endIso } = opts;

  if (courseIds.length === 0) {
    return { revenue: 0, students: 0, purchases: 0, aov: 0 };
  }

  const purchaseAgg = db
    .select({
      revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        gte(purchases.createdAt, startIso),
        lt(purchases.createdAt, endIso)
      )
    )
    .get();

  const buyerRows = db
    .selectDistinct({ userId: purchases.userId })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        gte(purchases.createdAt, startIso),
        lt(purchases.createdAt, endIso)
      )
    )
    .all();

  const redeemerRows = db
    .selectDistinct({ userId: coupons.redeemedByUserId })
    .from(coupons)
    .where(
      and(
        inArray(coupons.courseId, courseIds),
        isNotNull(coupons.redeemedByUserId),
        isNotNull(coupons.redeemedAt),
        gte(coupons.redeemedAt, startIso),
        lt(coupons.redeemedAt, endIso)
      )
    )
    .all();

  const studentIds = new Set<number>();
  for (const row of buyerRows) studentIds.add(row.userId);
  for (const row of redeemerRows) {
    if (row.userId !== null) studentIds.add(row.userId);
  }

  const revenue = purchaseAgg?.revenue ?? 0;
  const purchaseCount = purchaseAgg?.count ?? 0;

  return {
    revenue,
    purchases: purchaseCount,
    students: studentIds.size,
    aov: aov({ revenue, purchaseCount }),
  };
}

function bucketLabel(opts: { bucket: Bucket; start: Date }): string {
  const d = opts.start;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  if (opts.bucket === "month") return `${yyyy}-${mm}`;
  return `${yyyy}-${mm}-${dd}`;
}

function buildChart(opts: {
  courseIds: number[];
  startIso: string;
  endIso: string;
  bucket: Bucket;
}): ChartBucket[] {
  const { courseIds, startIso, endIso, bucket } = opts;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const widthMs = BUCKET_TO_DAYS[bucket] * DAY_MS;

  const buckets: ChartBucket[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += widthMs) {
    const bStart = new Date(t);
    const bEnd = new Date(Math.min(t + widthMs, end.getTime()));
    buckets.push({
      startIso: bStart.toISOString(),
      endIso: bEnd.toISOString(),
      label: bucketLabel({ bucket, start: bStart }),
      revenue: 0,
    });
  }

  if (courseIds.length === 0 || buckets.length === 0) return buckets;

  const rows = db
    .select({
      pricePaid: purchases.pricePaid,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .where(
      and(
        inArray(purchases.courseId, courseIds),
        gte(purchases.createdAt, startIso),
        lt(purchases.createdAt, endIso)
      )
    )
    .all();

  for (const row of rows) {
    const ts = new Date(row.createdAt).getTime();
    const idx = Math.floor((ts - start.getTime()) / widthMs);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].revenue += row.pricePaid;
    }
  }

  return buckets;
}

function getInstructorPublishedCourses(opts: { instructorId: number }) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
    })
    .from(courses)
    .where(
      and(
        eq(courses.instructorId, opts.instructorId),
        eq(courses.status, CourseStatus.Published)
      )
    )
    .all();
}

function getAllPublishedCourses() {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
    })
    .from(courses)
    .where(eq(courses.status, CourseStatus.Published))
    .all();
}

export function getInstructorAnalytics(opts: {
  instructorId: number;
  range?: Range;
  now?: Date;
}): InstructorAnalytics {
  const range = opts.range ?? "1m";
  const now = opts.now ?? new Date();
  const bucket = RANGE_TO_BUCKET[range];

  const instructorCourses = getInstructorPublishedCourses({
    instructorId: opts.instructorId,
  });
  const courseIds = instructorCourses.map((c) => c.id);

  const win = computeWindow({ range, now, courseIds });

  const kpis = aggregateKpis({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
  });

  const prevKpis = aggregateKpis({
    courseIds,
    startIso: win.prevStartIso,
    endIso: win.prevEndIso,
  });

  const chart = buildChart({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
    bucket,
  });

  const perCourse: PerCourseRow[] = instructorCourses.map((course) => {
    const cKpis = aggregateKpis({
      courseIds: [course.id],
      startIso: win.startIso,
      endIso: win.endIso,
    });
    return {
      courseId: course.id,
      title: course.title,
      status: course.status,
      ...cKpis,
    };
  });

  return { range, bucket, kpis, prevKpis, chart, perCourse };
}

export function getPlatformAnalytics(opts: {
  range?: Range;
  now?: Date;
}): InstructorAnalytics {
  const range = opts.range ?? "1m";
  const now = opts.now ?? new Date();
  const bucket = RANGE_TO_BUCKET[range];

  const allCourses = getAllPublishedCourses();
  const courseIds = allCourses.map((c) => c.id);

  const win = computeWindow({ range, now, courseIds });

  const kpis = aggregateKpis({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
  });
  const prevKpis = aggregateKpis({
    courseIds,
    startIso: win.prevStartIso,
    endIso: win.prevEndIso,
  });
  const chart = buildChart({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
    bucket,
  });

  const perCourse: PerCourseRow[] = allCourses.map((course) => {
    const cKpis = aggregateKpis({
      courseIds: [course.id],
      startIso: win.startIso,
      endIso: win.endIso,
    });
    return {
      courseId: course.id,
      title: course.title,
      status: course.status,
      ...cKpis,
    };
  });

  return { range, bucket, kpis, prevKpis, chart, perCourse };
}

export function getCourseAnalytics(opts: {
  courseId: number;
  range?: Range;
  now?: Date;
}): CourseAnalytics | null {
  const range = opts.range ?? "1m";
  const now = opts.now ?? new Date();
  const bucket = RANGE_TO_BUCKET[range];

  const course = db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: courses.instructorId,
      status: courses.status,
    })
    .from(courses)
    .where(eq(courses.id, opts.courseId))
    .get();

  if (!course) return null;

  const courseIds = [course.id];
  const win = computeWindow({ range, now, courseIds });

  const kpis = aggregateKpis({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
  });
  const prevKpis = aggregateKpis({
    courseIds,
    startIso: win.prevStartIso,
    endIso: win.prevEndIso,
  });
  const chart = buildChart({
    courseIds,
    startIso: win.startIso,
    endIso: win.endIso,
    bucket,
  });

  const countryRows = db
    .select({
      country: purchases.country,
      revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, opts.courseId),
        gte(purchases.createdAt, win.startIso),
        lt(purchases.createdAt, win.endIso)
      )
    )
    .groupBy(purchases.country)
    .all();

  const byCountry = countryRows
    .map((r) => ({ country: r.country ?? "Unknown", revenue: r.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    range,
    bucket,
    courseId: course.id,
    title: course.title,
    instructorId: course.instructorId,
    kpis,
    prevKpis,
    chart,
    byCountry,
  };
}

export function parseRange(value: string | null): Range {
  if (value === "1w" || value === "1m" || value === "6m" || value === "all") {
    return value;
  }
  return "1m";
}
