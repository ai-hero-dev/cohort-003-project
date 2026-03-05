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

import {
  getAnalyticsSummary,
  getRevenueTimeSeries,
  getPerCourseBreakdown,
  getAdminAnalyticsSummary,
  getAdminRevenueTimeSeries,
  type TimePeriod,
} from "./analyticsService";

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

  // ─── Revenue Time Series ───

  describe("getRevenueTimeSeries", () => {
    it("returns empty array when instructor has no courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const result = getRevenueTimeSeries({
        instructorId: otherInstructor.id,
        period: "7d",
      });

      expect(result).toEqual([]);
    });

    it("returns daily data points for 7d period", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: threeDaysAgo.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "7d",
      });

      // Should have 8 data points (7 days ago through today)
      expect(result.length).toBe(8);
      // Each point should have a YYYY-MM-DD date
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns daily data points for 30d period", () => {
      const now = new Date();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: now.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "30d",
      });

      // Should have 31 data points (30 days ago through today)
      expect(result.length).toBe(31);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns monthly data points for 12m period", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: sixMonthsAgo.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "12m",
      });

      // Should have 13 data points (12 months ago through current month)
      expect(result.length).toBe(13);
      // Each point should have a YYYY-MM date
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("fills zero-revenue periods with $0 data points", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: fiveDaysAgo.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "7d",
      });

      // Most days should be $0
      const zeroDays = result.filter((p) => p.revenue === 0);
      expect(zeroDays.length).toBe(7); // 7 of 8 days are zero

      // The purchase day should have revenue
      const purchaseDay = result.find((p) => p.revenue > 0);
      expect(purchaseDay?.revenue).toBe(4999);
    });

    it("aggregates multiple purchases on the same day", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: twoDaysAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            pricePaid: 2500,
            country: "IN",
            createdAt: twoDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "7d",
      });

      const purchaseDay = result.find((p) => p.revenue > 0);
      expect(purchaseDay?.revenue).toBe(7499);
    });

    it("returns monthly data for 'all' period based on earliest purchase", () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: threeMonthsAgo.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "all",
      });

      // Should have 4 monthly data points (3 months ago through current month)
      expect(result.length).toBe(4);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("returns empty array for 'all' period when no purchases exist", () => {
      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result).toEqual([]);
    });

    it("only includes data for the specified instructor's courses", () => {
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

      const now = new Date();
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: now.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            country: "US",
            createdAt: now.toISOString(),
          },
        ])
        .run();

      const result = getRevenueTimeSeries({
        instructorId: base.instructor.id,
        period: "7d",
      });

      const totalRevenue = result.reduce((sum, p) => sum + p.revenue, 0);
      expect(totalRevenue).toBe(4999);
    });
  });

  // ─── Per-Course Breakdown ───

  describe("getPerCourseBreakdown", () => {
    it("returns empty array when instructor has no courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const result = getPerCourseBreakdown({
        instructorId: otherInstructor.id,
        period: "all",
      });

      expect(result).toEqual([]);
    });

    it("returns course info with zeros when no data exists", () => {
      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        courseId: base.course.id,
        title: base.course.title,
        slug: base.course.slug,
        listPrice: base.course.price,
        revenue: 0,
        salesCount: 0,
        enrollmentCount: 0,
        averageRating: null,
        ratingCount: 0,
      });
    });

    it("returns correct revenue and sales count per course", () => {
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

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result[0].revenue).toBe(7499);
      expect(result[0].salesCount).toBe(2);
    });

    it("returns correct enrollment count per course", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result[0].enrollmentCount).toBe(2);
    });

    it("returns correct average rating and count per course", () => {
      testDb
        .insert(schema.courseRatings)
        .values([
          { userId: base.user.id, courseId: base.course.id, rating: 5 },
          { userId: base.instructor.id, courseId: base.course.id, rating: 3 },
        ])
        .run();

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result[0].averageRating).toBe(4);
      expect(result[0].ratingCount).toBe(2);
    });

    it("returns separate data for multiple courses", () => {
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

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result).toHaveLength(2);

      const course1Data = result.find((c) => c.courseId === base.course.id)!;
      const course2Data = result.find((c) => c.courseId === course2.id)!;

      expect(course1Data.revenue).toBe(4999);
      expect(course1Data.salesCount).toBe(1);
      expect(course1Data.enrollmentCount).toBe(1);

      expect(course2Data.revenue).toBe(2999);
      expect(course2Data.salesCount).toBe(1);
      expect(course2Data.enrollmentCount).toBe(1);
    });

    it("respects time period filter", () => {
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

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "7d",
      });

      expect(result[0].revenue).toBe(4999);
      expect(result[0].salesCount).toBe(1);
    });

    it("only includes the specified instructor's courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      testDb
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
        .run();

      const result = getPerCourseBreakdown({
        instructorId: base.instructor.id,
        period: "all",
      });

      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe(base.course.id);
    });
  });

  // ─── Admin Analytics Summary ───

  describe("getAdminAnalyticsSummary", () => {
    it("returns zeros and null top course when no data exists", () => {
      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.topEarningCourse).toBeNull();
    });

    it("returns total revenue across all instructors", () => {
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
          description: "Another course",
          instructorId: otherInstructor.id,
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
            courseId: otherCourse.id,
            pricePaid: 2999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(7998);
    });

    it("returns total enrollments across all courses", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalEnrollments).toBe(2);
    });

    it("returns the top earning course", () => {
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
          title: "Expensive Course",
          slug: "expensive-course",
          description: "Pricey",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
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
            courseId: otherCourse.id,
            pricePaid: 9999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.topEarningCourse).toEqual({
        title: "Expensive Course",
        revenue: 9999,
      });
    });

    it("filters by time period", () => {
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

      const result = getAdminAnalyticsSummary({ period: "7d" });

      expect(result.totalRevenue).toBe(4999);
    });

    it("returns null top course when no purchases in selected period", () => {
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

      const result = getAdminAnalyticsSummary({ period: "7d" });

      expect(result.topEarningCourse).toBeNull();
    });
  });

  // ─── Admin Revenue Time Series ───

  describe("getAdminRevenueTimeSeries", () => {
    it("returns empty array when no purchases exist for 'all' period", () => {
      const result = getAdminRevenueTimeSeries({ period: "all" });
      expect(result).toEqual([]);
    });

    it("returns daily data points for 7d period", () => {
      const now = new Date();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: now.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      expect(result.length).toBe(8);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns monthly data points for 12m period", () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: sixMonthsAgo.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "12m" });

      expect(result.length).toBe(13);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("fills zero-revenue periods with $0 data points", () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: fiveDaysAgo.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      const zeroDays = result.filter((p) => p.revenue === 0);
      expect(zeroDays.length).toBe(7);

      const purchaseDay = result.find((p) => p.revenue > 0);
      expect(purchaseDay?.revenue).toBe(4999);
    });

    it("aggregates revenue across all instructors' courses", () => {
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
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      const now = new Date();
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: now.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 2999,
            country: "US",
            createdAt: now.toISOString(),
          },
        ])
        .run();

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      const totalRevenue = result.reduce((sum, p) => sum + p.revenue, 0);
      expect(totalRevenue).toBe(7998);
    });

    it("respects time period filter", () => {
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

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      const totalRevenue = result.reduce((sum, p) => sum + p.revenue, 0);
      expect(totalRevenue).toBe(4999);
    });

    it("returns monthly data for 'all' period based on earliest purchase", () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: threeMonthsAgo.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "all" });

      expect(result.length).toBe(4);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
