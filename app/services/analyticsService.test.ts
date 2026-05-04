import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { getInstructorAnalytics } from "./analyticsService";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-04-29T12:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

function createUser(opts: { name: string; email: string; role: schema.UserRole }) {
  return testDb
    .insert(schema.users)
    .values({ name: opts.name, email: opts.email, role: opts.role })
    .returning()
    .get();
}

function createCourse(opts: {
  instructorId: number;
  categoryId: number;
  title: string;
  slug: string;
  status: schema.CourseStatus;
  price?: number;
}) {
  return testDb
    .insert(schema.courses)
    .values({
      title: opts.title,
      slug: opts.slug,
      description: "desc",
      instructorId: opts.instructorId,
      categoryId: opts.categoryId,
      status: opts.status,
      price: opts.price ?? 4999,
    })
    .returning()
    .get();
}

function createPurchase(opts: {
  userId: number;
  courseId: number;
  pricePaid: number;
  createdAt: string;
}) {
  return testDb
    .insert(schema.purchases)
    .values({
      userId: opts.userId,
      courseId: opts.courseId,
      pricePaid: opts.pricePaid,
      country: "US",
      createdAt: opts.createdAt,
    })
    .returning()
    .get();
}

function createTeam() {
  return testDb.insert(schema.teams).values({}).returning().get();
}

function createCoupon(opts: {
  teamId: number;
  courseId: number;
  purchaseId: number;
  code: string;
  redeemedByUserId?: number | null;
  redeemedAt?: string | null;
}) {
  return testDb
    .insert(schema.coupons)
    .values({
      teamId: opts.teamId,
      courseId: opts.courseId,
      purchaseId: opts.purchaseId,
      code: opts.code,
      redeemedByUserId: opts.redeemedByUserId ?? null,
      redeemedAt: opts.redeemedAt ?? null,
    })
    .returning()
    .get();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getInstructorAnalytics — revenue aggregation", () => {
    it("sums pricePaid for in-window purchases of instructor's published courses", () => {
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 4999,
        createdAt: isoDaysAgo(1),
      });
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 2500,
        createdAt: isoDaysAgo(10),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(7499);
      expect(result.kpis.purchases).toBe(2);
      expect(result.kpis.aov).toBeCloseTo(7499 / 2);
    });

    it("excludes purchases outside the 30-day window", () => {
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 4999,
        createdAt: isoDaysAgo(45),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(0);
      expect(result.kpis.purchases).toBe(0);
    });

    it("does not include other instructors' courses", () => {
      const otherInstructor = createUser({
        name: "Other",
        email: "other@example.com",
        role: schema.UserRole.Instructor,
      });
      const otherCourse = createCourse({
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        title: "Other course",
        slug: "other-course",
        status: schema.CourseStatus.Published,
      });
      createPurchase({
        userId: base.user.id,
        courseId: otherCourse.id,
        pricePaid: 9999,
        createdAt: isoDaysAgo(1),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(0);
    });
  });

  describe("getInstructorAnalytics — student union-distinct", () => {
    it("counts buyers and coupon redeemers as a distinct union", () => {
      const buyer = base.user;
      const redeemer = createUser({
        name: "Redeemer",
        email: "redeemer@example.com",
        role: schema.UserRole.Student,
      });

      const purchase = createPurchase({
        userId: buyer.id,
        courseId: base.course.id,
        pricePaid: 10000,
        createdAt: isoDaysAgo(2),
      });
      const team = createTeam();
      createCoupon({
        teamId: team.id,
        courseId: base.course.id,
        purchaseId: purchase.id,
        code: "C1",
        redeemedByUserId: redeemer.id,
        redeemedAt: isoDaysAgo(1),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.students).toBe(2);
    });

    it("counts a user appearing as both buyer and redeemer only once", () => {
      const dualUser = base.user;

      const purchase = createPurchase({
        userId: dualUser.id,
        courseId: base.course.id,
        pricePaid: 10000,
        createdAt: isoDaysAgo(3),
      });
      const team = createTeam();
      createCoupon({
        teamId: team.id,
        courseId: base.course.id,
        purchaseId: purchase.id,
        code: "C1",
        redeemedByUserId: dualUser.id,
        redeemedAt: isoDaysAgo(1),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.students).toBe(1);
    });

    it("ignores unredeemed coupons", () => {
      const purchase = createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 10000,
        createdAt: isoDaysAgo(2),
      });
      const team = createTeam();
      createCoupon({
        teamId: team.id,
        courseId: base.course.id,
        purchaseId: purchase.id,
        code: "C-unredeemed",
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.students).toBe(1);
    });
  });

  describe("getInstructorAnalytics — per-course rows", () => {
    it("includes free (price=0) published courses with $0 revenue", () => {
      const freeCourse = createCourse({
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        title: "Free course",
        slug: "free-course",
        status: schema.CourseStatus.Published,
        price: 0,
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      const freeRow = result.perCourse.find(
        (r) => r.courseId === freeCourse.id
      );
      expect(freeRow).toBeDefined();
      expect(freeRow!.revenue).toBe(0);
      expect(freeRow!.aov).toBe(0);
    });

    it("excludes draft and archived courses", () => {
      createCourse({
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        title: "Draft",
        slug: "draft-course",
        status: schema.CourseStatus.Draft,
      });
      createCourse({
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        title: "Archived",
        slug: "archived-course",
        status: schema.CourseStatus.Archived,
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      const titles = result.perCourse.map((r) => r.title);
      expect(titles).not.toContain("Draft");
      expect(titles).not.toContain("Archived");
    });

    it("does not let purchases of draft courses contribute to KPIs", () => {
      const draft = createCourse({
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        title: "Draft",
        slug: "draft-course",
        status: schema.CourseStatus.Draft,
      });
      createPurchase({
        userId: base.user.id,
        courseId: draft.id,
        pricePaid: 9999,
        createdAt: isoDaysAgo(1),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(0);
      expect(result.kpis.purchases).toBe(0);
    });
  });

  describe("getInstructorAnalytics — team purchase attribution", () => {
    it("attributes team-purchase revenue at full pricePaid on createdAt regardless of redemption timing", () => {
      const purchase = createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 30000,
        createdAt: isoDaysAgo(5),
      });
      const team = createTeam();
      // One redeemed seat in window, two unredeemed — revenue should not depend on this.
      const redeemer = createUser({
        name: "R1",
        email: "r1@example.com",
        role: schema.UserRole.Student,
      });
      createCoupon({
        teamId: team.id,
        courseId: base.course.id,
        purchaseId: purchase.id,
        code: "T1",
        redeemedByUserId: redeemer.id,
        redeemedAt: isoDaysAgo(1),
      });
      createCoupon({
        teamId: team.id,
        courseId: base.course.id,
        purchaseId: purchase.id,
        code: "T2",
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(30000);
      expect(result.kpis.purchases).toBe(1);
    });
  });

  describe("getInstructorAnalytics — empty / divide-by-zero", () => {
    it("returns zeros and AOV=0 when there are no purchases", () => {
      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });
      expect(result.kpis.revenue).toBe(0);
      expect(result.kpis.purchases).toBe(0);
      expect(result.kpis.students).toBe(0);
      expect(result.kpis.aov).toBe(0);
    });
  });

  describe("getInstructorAnalytics — authorisation scoping", () => {
    it("never returns another instructor's data", () => {
      const otherInstructor = createUser({
        name: "Other",
        email: "other@example.com",
        role: schema.UserRole.Instructor,
      });
      const otherCourse = createCourse({
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        title: "Other course",
        slug: "other-course",
        status: schema.CourseStatus.Published,
      });
      createPurchase({
        userId: base.user.id,
        courseId: otherCourse.id,
        pricePaid: 5000,
        createdAt: isoDaysAgo(1),
      });
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 2000,
        createdAt: isoDaysAgo(1),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(2000);
      expect(result.perCourse.map((r) => r.title)).not.toContain("Other course");
    });
  });

  describe("getInstructorAnalytics — previous period", () => {
    it("compares against the immediately preceding window of the same length", () => {
      // 1m range = 30 days. Current = days 0-30 ago. Prev = days 30-60 ago.
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        createdAt: isoDaysAgo(5),
      });
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 4000,
        createdAt: isoDaysAgo(40),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1m",
        now: NOW,
      });

      expect(result.kpis.revenue).toBe(1000);
      expect(result.prevKpis.revenue).toBe(4000);
    });

    it("excludes purchases older than two windows from prevKpis", () => {
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 9999,
        createdAt: isoDaysAgo(120),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1m",
        now: NOW,
      });

      expect(result.prevKpis.revenue).toBe(0);
    });
  });

  describe("getInstructorAnalytics — chart bucketing", () => {
    it("uses daily buckets for 1w (7 buckets) with no gaps", () => {
      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1w",
        now: NOW,
      });
      expect(result.bucket).toBe("day");
      expect(result.chart).toHaveLength(7);
      // Each bucket end == next bucket start (no gaps, no overlap).
      for (let i = 1; i < result.chart.length; i++) {
        expect(result.chart[i].startIso).toBe(result.chart[i - 1].endIso);
      }
    });

    it("uses daily buckets for 1m (30 buckets)", () => {
      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1m",
        now: NOW,
      });
      expect(result.bucket).toBe("day");
      expect(result.chart).toHaveLength(30);
    });

    it("uses weekly buckets for 6m", () => {
      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "6m",
        now: NOW,
      });
      expect(result.bucket).toBe("week");
      // 180 days / 7 = ~26 buckets
      expect(result.chart.length).toBeGreaterThanOrEqual(25);
      expect(result.chart.length).toBeLessThanOrEqual(27);
    });

    it("uses monthly buckets for 'all' starting at the earliest purchase", () => {
      // Seed a purchase ~5 months ago so the all-time window spans ~5 months.
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        createdAt: isoDaysAgo(150),
      });
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 2000,
        createdAt: isoDaysAgo(2),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "all",
        now: NOW,
      });
      expect(result.bucket).toBe("month");
      // ~150 days / 30 ≈ 5-6 monthly buckets.
      expect(result.chart.length).toBeGreaterThanOrEqual(5);
      expect(result.chart.length).toBeLessThanOrEqual(6);
      // All-time has no preceding window — prevKpis collapse to zero.
      expect(result.prevKpis.revenue).toBe(0);
      // Both purchases fall inside the all-time window.
      expect(result.kpis.revenue).toBe(3000);
    });

    it("returns an empty chart for 'all' when there are no purchases", () => {
      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "all",
        now: NOW,
      });
      expect(result.bucket).toBe("month");
      expect(result.chart).toHaveLength(0);
      expect(result.kpis.revenue).toBe(0);
    });

    it("places purchases in the correct bucket and total bucket revenue equals KPI revenue", () => {
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        createdAt: isoDaysAgo(1),
      });
      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 2000,
        createdAt: isoDaysAgo(5),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1w",
        now: NOW,
      });

      const total = result.chart.reduce((s, b) => s + b.revenue, 0);
      expect(total).toBe(result.kpis.revenue);
      expect(total).toBe(3000);
    });
  });

  describe("getInstructorAnalytics — per-course scoping", () => {
    it("aggregates each course independently in perCourse rows", () => {
      const courseB = createCourse({
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        title: "Course B",
        slug: "course-b",
        status: schema.CourseStatus.Published,
      });

      createPurchase({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 1000,
        createdAt: isoDaysAgo(1),
      });
      createPurchase({
        userId: base.user.id,
        courseId: courseB.id,
        pricePaid: 5000,
        createdAt: isoDaysAgo(2),
      });

      const result = getInstructorAnalytics({
        instructorId: base.instructor.id,
        range: "1m",
        now: NOW,
      });

      const rowA = result.perCourse.find((r) => r.courseId === base.course.id)!;
      const rowB = result.perCourse.find((r) => r.courseId === courseB.id)!;
      expect(rowA.revenue).toBe(1000);
      expect(rowB.revenue).toBe(5000);
      expect(result.kpis.revenue).toBe(6000);
    });
  });
});

import { getCourseAnalytics, getPlatformAnalytics } from "./analyticsService";

describe("analyticsService — getPlatformAnalytics", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("aggregates revenue across every published course on the platform", () => {
    const otherInstructor = createUser({
      name: "Other",
      email: "other@example.com",
      role: schema.UserRole.Instructor,
    });
    const otherCourse = createCourse({
      instructorId: otherInstructor.id,
      categoryId: base.category.id,
      title: "Other course",
      slug: "other-course",
      status: schema.CourseStatus.Published,
    });

    createPurchase({
      userId: base.user.id,
      courseId: base.course.id,
      pricePaid: 1000,
      createdAt: isoDaysAgo(1),
    });
    createPurchase({
      userId: base.user.id,
      courseId: otherCourse.id,
      pricePaid: 5000,
      createdAt: isoDaysAgo(2),
    });

    const result = getPlatformAnalytics({ range: "1m", now: NOW });

    expect(result.kpis.revenue).toBe(6000);
    expect(result.perCourse).toHaveLength(2);
  });

  it("excludes drafts and archived courses platform-wide", () => {
    createCourse({
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      title: "Draft",
      slug: "draft",
      status: schema.CourseStatus.Draft,
    });
    const result = getPlatformAnalytics({ range: "1m", now: NOW });
    expect(result.perCourse.map((r) => r.title)).not.toContain("Draft");
  });

  it("returns zero KPIs when there are no purchases anywhere", () => {
    const result = getPlatformAnalytics({ range: "1m", now: NOW });
    expect(result.kpis.revenue).toBe(0);
    expect(result.kpis.purchases).toBe(0);
    expect(result.kpis.students).toBe(0);
  });
});

describe("analyticsService — getCourseAnalytics", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("returns null for a non-existent course", () => {
    const result = getCourseAnalytics({ courseId: 99999, now: NOW });
    expect(result).toBeNull();
  });

  it("scopes KPIs and chart to a single course", () => {
    const otherCourse = createCourse({
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      title: "Other",
      slug: "other-course",
      status: schema.CourseStatus.Published,
    });

    createPurchase({
      userId: base.user.id,
      courseId: base.course.id,
      pricePaid: 1000,
      createdAt: isoDaysAgo(1),
    });
    createPurchase({
      userId: base.user.id,
      courseId: otherCourse.id,
      pricePaid: 9999,
      createdAt: isoDaysAgo(1),
    });

    const result = getCourseAnalytics({
      courseId: base.course.id,
      range: "1m",
      now: NOW,
    });

    expect(result).not.toBeNull();
    expect(result!.kpis.revenue).toBe(1000);
    expect(result!.courseId).toBe(base.course.id);
    expect(result!.instructorId).toBe(base.instructor.id);
  });

  it("groups revenue by country, sorted descending", () => {
    createPurchase({
      userId: base.user.id,
      courseId: base.course.id,
      pricePaid: 1000,
      createdAt: isoDaysAgo(1),
    });
    // Insert with different country directly.
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.instructor.id,
        courseId: base.course.id,
        pricePaid: 5000,
        country: "IN",
        createdAt: isoDaysAgo(2),
      })
      .run();
    testDb
      .insert(schema.purchases)
      .values({
        userId: base.instructor.id,
        courseId: base.course.id,
        pricePaid: 2000,
        country: null,
        createdAt: isoDaysAgo(3),
      })
      .run();

    const result = getCourseAnalytics({
      courseId: base.course.id,
      range: "1m",
      now: NOW,
    })!;

    expect(result.byCountry[0]).toEqual({ country: "IN", revenue: 5000 });
    expect(result.byCountry).toContainEqual({ country: "US", revenue: 1000 });
    expect(result.byCountry).toContainEqual({ country: "Unknown", revenue: 2000 });
  });
});
