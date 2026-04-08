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
  createRating,
  getRatingByUserAndCourse,
  getAverageRating,
  getAverageRatingsForCourses,
} from "./ratingService";

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createRating", () => {
    it("creates a rating", () => {
      const rating = createRating(base.user.id, base.course.id, 4);

      expect(rating).toBeDefined();
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.rating).toBe(4);
      expect(rating.createdAt).toBeDefined();
    });

    it("throws on duplicate rating for same user and course", () => {
      createRating(base.user.id, base.course.id, 4);

      expect(() =>
        createRating(base.user.id, base.course.id, 5)
      ).toThrow();
    });
  });

  describe("getRatingByUserAndCourse", () => {
    it("returns the rating when it exists", () => {
      createRating(base.user.id, base.course.id, 3);

      const found = getRatingByUserAndCourse(base.user.id, base.course.id);
      expect(found).toBeDefined();
      expect(found!.rating).toBe(3);
    });

    it("returns undefined when no rating exists", () => {
      const found = getRatingByUserAndCourse(base.user.id, base.course.id);
      expect(found).toBeUndefined();
    });
  });

  describe("getAverageRating", () => {
    it("returns average and count", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student Two",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      createRating(base.user.id, base.course.id, 4);
      createRating(student2.id, base.course.id, 2);

      const result = getAverageRating(base.course.id);
      expect(result.average).toBe(3);
      expect(result.count).toBe(2);
    });

    it("returns 0 average and 0 count when no ratings exist", () => {
      const result = getAverageRating(base.course.id);
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe("getAverageRatingsForCourses", () => {
    it("returns a map of courseId to average and count", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      createRating(base.user.id, base.course.id, 5);
      createRating(base.user.id, course2.id, 3);

      const result = getAverageRatingsForCourses([base.course.id, course2.id]);
      expect(result.get(base.course.id)).toEqual({ average: 5, count: 1 });
      expect(result.get(course2.id)).toEqual({ average: 3, count: 1 });
    });

    it("returns empty map for empty input", () => {
      const result = getAverageRatingsForCourses([]);
      expect(result.size).toBe(0);
    });

    it("omits courses with no ratings from the map", () => {
      const result = getAverageRatingsForCourses([base.course.id]);
      expect(result.has(base.course.id)).toBe(false);
    });
  });
});
