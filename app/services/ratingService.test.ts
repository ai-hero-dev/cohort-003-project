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

// Import after mock so the module picks up our test db
import {
  canUserRateCourse,
  getCourseRatingSummary,
  getRatingSummariesForCourses,
  getRatingsByCourse,
  getUserRating,
  rateCourse,
  removeRating,
} from "./ratingService";

/** Creates an extra student and enrolls them, so we can average across users. */
function enrolledStudent(email: string) {
  const user = testDb
    .insert(schema.users)
    .values({ name: email, email, role: schema.UserRole.Student })
    .returning()
    .get();

  testDb
    .insert(schema.enrollments)
    .values({ userId: user.id, courseId: base.course.id })
    .run();

  return user;
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    // The base student is enrolled in the base course for most tests.
    testDb
      .insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();
  });

  describe("rateCourse", () => {
    it("records a rating for an enrolled student", () => {
      const rating = rateCourse(base.user.id, base.course.id, 4);

      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
      expect(rating.rating).toBe(4);
    });

    it("overwrites the previous rating instead of adding a second one", () => {
      rateCourse(base.user.id, base.course.id, 2);
      const updated = rateCourse(base.user.id, base.course.id, 5);

      expect(updated.rating).toBe(5);
      expect(getRatingsByCourse(base.course.id)).toHaveLength(1);
    });

    it("rejects ratings outside 1–5", () => {
      expect(() => rateCourse(base.user.id, base.course.id, 0)).toThrowError(
        /between 1 and 5/
      );
      expect(() => rateCourse(base.user.id, base.course.id, 6)).toThrowError(
        /between 1 and 5/
      );
    });

    it("rejects fractional ratings", () => {
      expect(() => rateCourse(base.user.id, base.course.id, 3.5)).toThrowError(
        /between 1 and 5/
      );
    });

    it("rejects a student who is not enrolled", () => {
      const outsider = testDb
        .insert(schema.users)
        .values({
          name: "Outsider",
          email: "outsider@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      expect(() => rateCourse(outsider.id, base.course.id, 5)).toThrowError(
        "Only enrolled students can rate this course"
      );
    });

    it("rejects the instructor rating their own course", () => {
      // Enrolled or not, the course owner must not rate their own course.
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.instructor.id, courseId: base.course.id })
        .run();

      expect(() =>
        rateCourse(base.instructor.id, base.course.id, 5)
      ).toThrowError("Only enrolled students can rate this course");
    });

    it("rejects a rating for a non-existent course", () => {
      expect(() => rateCourse(base.user.id, 9999, 5)).toThrowError(
        "Only enrolled students can rate this course"
      );
    });
  });

  describe("getUserRating", () => {
    it("returns the rating the user left", () => {
      rateCourse(base.user.id, base.course.id, 3);

      expect(getUserRating(base.user.id, base.course.id)?.rating).toBe(3);
    });

    it("returns undefined when the user has not rated", () => {
      expect(getUserRating(base.user.id, base.course.id)).toBeUndefined();
    });
  });

  describe("getCourseRatingSummary", () => {
    it("returns an empty summary when there are no ratings", () => {
      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: null,
        count: 0,
      });
    });

    it("averages ratings across users", () => {
      rateCourse(base.user.id, base.course.id, 5);
      rateCourse(enrolledStudent("b@example.com").id, base.course.id, 4);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 4.5,
        count: 2,
      });
    });

    it("rounds the average to one decimal", () => {
      rateCourse(base.user.id, base.course.id, 5);
      rateCourse(enrolledStudent("b@example.com").id, base.course.id, 4);
      rateCourse(enrolledStudent("c@example.com").id, base.course.id, 4);

      // 13 / 3 = 4.333…
      expect(getCourseRatingSummary(base.course.id).average).toBe(4.3);
    });

    it("reflects an overwritten rating rather than counting it twice", () => {
      rateCourse(base.user.id, base.course.id, 1);
      rateCourse(base.user.id, base.course.id, 5);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 5,
        count: 1,
      });
    });
  });

  describe("getRatingSummariesForCourses", () => {
    it("returns a summary per course id", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another test course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: otherCourse.id })
        .run();

      rateCourse(base.user.id, base.course.id, 2);
      rateCourse(base.user.id, otherCourse.id, 4);

      const summaries = getRatingSummariesForCourses([
        base.course.id,
        otherCourse.id,
      ]);

      expect(summaries.get(base.course.id)).toEqual({ average: 2, count: 1 });
      expect(summaries.get(otherCourse.id)).toEqual({ average: 4, count: 1 });
    });

    it("omits courses that have no ratings", () => {
      const summaries = getRatingSummariesForCourses([base.course.id]);

      expect(summaries.has(base.course.id)).toBe(false);
    });

    it("returns an empty map for an empty id list", () => {
      expect(getRatingSummariesForCourses([]).size).toBe(0);
    });
  });

  describe("canUserRateCourse", () => {
    it("allows an enrolled student", () => {
      expect(canUserRateCourse(base.user.id, base.course.id)).toBe(true);
    });

    it("denies a student who is not enrolled", () => {
      const outsider = testDb
        .insert(schema.users)
        .values({
          name: "Outsider",
          email: "outsider@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      expect(canUserRateCourse(outsider.id, base.course.id)).toBe(false);
    });

    it("denies the course instructor", () => {
      expect(canUserRateCourse(base.instructor.id, base.course.id)).toBe(false);
    });

    it("denies a non-existent course", () => {
      expect(canUserRateCourse(base.user.id, 9999)).toBe(false);
    });
  });

  describe("removeRating", () => {
    it("deletes the user's rating", () => {
      rateCourse(base.user.id, base.course.id, 3);
      removeRating(base.user.id, base.course.id);

      expect(getUserRating(base.user.id, base.course.id)).toBeUndefined();
      expect(getCourseRatingSummary(base.course.id).count).toBe(0);
    });

    it("throws when there is nothing to remove", () => {
      expect(() => removeRating(base.user.id, base.course.id)).toThrowError(
        "User has not rated this course"
      );
    });
  });
});
