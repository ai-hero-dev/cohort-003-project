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
  submitRating,
  getRatingForUser,
  getCourseRatingStats,
  getCourseRatingStatsForCourses,
} from "./ratingService";

function enroll(userId: number, courseId: number) {
  return testDb
    .insert(schema.enrollments)
    .values({ userId, courseId })
    .returning()
    .get();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("submitRating", () => {
    it("inserts a rating for an enrolled user", () => {
      enroll(base.user.id, base.course.id);

      const row = submitRating(base.user.id, base.course.id, 4);

      expect(row).toBeDefined();
      expect(row.userId).toBe(base.user.id);
      expect(row.courseId).toBe(base.course.id);
      expect(row.rating).toBe(4);
      expect(row.createdAt).toBeDefined();
    });

    it("throws when the user is not enrolled in the course", () => {
      expect(() =>
        submitRating(base.user.id, base.course.id, 5)
      ).toThrowError("User is not enrolled in this course");
    });

    it("updates the rating when the user has already rated the course", () => {
      enroll(base.user.id, base.course.id);
      const first = submitRating(base.user.id, base.course.id, 3);

      const second = submitRating(base.user.id, base.course.id, 5);

      expect(second.id).toBe(first.id);
      expect(second.rating).toBe(5);

      const stats = getCourseRatingStats(base.course.id);
      expect(stats.count).toBe(1);
      expect(stats.average).toBe(5);
    });
  });

  describe("getRatingForUser", () => {
    it("returns the rating row when the user has rated the course", () => {
      enroll(base.user.id, base.course.id);
      submitRating(base.user.id, base.course.id, 5);

      const row = getRatingForUser(base.user.id, base.course.id);

      expect(row).toBeDefined();
      expect(row?.rating).toBe(5);
      expect(row?.userId).toBe(base.user.id);
      expect(row?.courseId).toBe(base.course.id);
    });

    it("returns undefined when the user has not rated the course", () => {
      const row = getRatingForUser(base.user.id, base.course.id);
      expect(row).toBeUndefined();
    });
  });

  describe("getCourseRatingStats", () => {
    it("returns { average: null, count: 0 } when no ratings exist", () => {
      const stats = getCourseRatingStats(base.course.id);
      expect(stats).toEqual({ average: null, count: 0 });
    });

    it("returns the correct average and count for a rated course", () => {
      enroll(base.user.id, base.course.id);
      submitRating(base.user.id, base.course.id, 5);

      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      enroll(otherUser.id, base.course.id);
      submitRating(otherUser.id, base.course.id, 3);

      const stats = getCourseRatingStats(base.course.id);
      expect(stats.count).toBe(2);
      expect(stats.average).toBe(4);
    });
  });

  describe("getCourseRatingStatsForCourses", () => {
    it("returns an empty map when given an empty array", () => {
      const map = getCourseRatingStatsForCourses([]);
      expect(map.size).toBe(0);
    });

    it("returns stats per course, defaulting unrated courses to (null, 0)", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2",
          slug: "course-2",
          description: "another",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      enroll(base.user.id, base.course.id);
      submitRating(base.user.id, base.course.id, 4);

      const map = getCourseRatingStatsForCourses([base.course.id, course2.id]);

      expect(map.get(base.course.id)).toEqual({ average: 4, count: 1 });
      expect(map.get(course2.id)).toEqual({ average: null, count: 0 });
    });
  });
});
