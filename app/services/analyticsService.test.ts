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

import { getAnalyticsSummary, type TimePeriod } from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── Summary Totals ───

  describe("getAnalyticsSummary", () => {
    it("returns zeros when instructor has no courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const result = getAnalyticsSummary({
        instructorId: otherInstructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });

    it("returns zeros when instructor has courses but no data", () => {
      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });

    it("returns correct total revenue", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            pricePaid: 2500,
            country: "IN",
          },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(7499);
    });

    it("returns correct total enrollment count", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalEnrollments).toBe(2);
    });

    it("returns correct average rating and count", () => {
      testDb
        .insert(schema.courseRatings)
        .values([
          { userId: base.user.id, courseId: base.course.id, rating: 5 },
          { userId: base.instructor.id, courseId: base.course.id, rating: 3 },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.averageRating).toBe(4);
      expect(result.ratingCount).toBe(2);
    });

    it("aggregates data across multiple courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 2999,
            country: "US",
          },
        ])
        .run();

      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.user.id, courseId: course2.id },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(7998);
      expect(result.totalEnrollments).toBe(2);
    });
  });

  // ─── Instructor Isolation ───

  describe("instructor isolation", () => {
    it("only returns data for the specified instructor's courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Not mine",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      // Purchases on both instructors' courses
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            country: "US",
          },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(4999);
    });
  });

  // ─── Time Period Filtering ───

  describe("time period filtering", () => {
    it("filters purchases by 7d period", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: threeDaysAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            pricePaid: 2500,
            country: "US",
            createdAt: tenDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "7d",
      });

      expect(result.totalRevenue).toBe(4999);
    });

    it("filters enrollments by 30d period", () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: tenDaysAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: sixtyDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "30d",
      });

      expect(result.totalEnrollments).toBe(1);
    });

    it("filters ratings by 12m period", () => {
      const now = new Date();
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setMonth(now.getMonth() - 2);
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);

      testDb
        .insert(schema.courseRatings)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            rating: 5,
            createdAt: twoMonthsAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            rating: 1,
            createdAt: twoYearsAgo.toISOString(),
          },
        ])
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "12m",
      });

      expect(result.averageRating).toBe(5);
      expect(result.ratingCount).toBe(1);
    });

    it("returns all data for 'all' period regardless of date", () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: twoYearsAgo.toISOString(),
        })
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result.totalRevenue).toBe(4999);
    });

    it("returns zeros when no data exists in the selected period", () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: twoYearsAgo.toISOString(),
        })
        .run();

      const result = getAnalyticsSummary({
        instructorId: base.instructor.id,
        period: "7d",
      });

      expect(result.totalRevenue).toBe(0);
    });
  });
});
