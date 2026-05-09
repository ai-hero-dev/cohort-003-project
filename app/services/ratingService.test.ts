import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
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
  getUserRating,
  upsertRating,
  getCourseRatingStats,
  getRatingStatsForCourses,
} from "./ratingService";

function makeUser(name: string, email: string) {
  return testDb
    .insert(schema.users)
    .values({ name, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

function makeCourse(title: string, slug: string) {
  return testDb
    .insert(schema.courses)
    .values({
      title,
      slug,
      description: "desc",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("upsertRating", () => {
    it("inserts a rating on first call", () => {
      const result = upsertRating(base.user.id, base.course.id, 4);

      expect(result.userId).toBe(base.user.id);
      expect(result.courseId).toBe(base.course.id);
      expect(result.rating).toBe(4);
      expect(result.createdAt).toBeDefined();
    });

    it("updates the existing rating on second call from the same user", () => {
      const first = upsertRating(base.user.id, base.course.id, 3);
      const second = upsertRating(base.user.id, base.course.id, 5);

      expect(second.id).toBe(first.id);
      expect(second.rating).toBe(5);
      expect(second.createdAt).toBe(first.createdAt);

      // Only one row total
      const allForCourse = testDb
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.courseId, base.course.id))
        .all();
      expect(allForCourse).toHaveLength(1);
    });

    it("throws when rating is below 1", () => {
      expect(() => upsertRating(base.user.id, base.course.id, 0)).toThrow();
    });

    it("throws when rating is above 5", () => {
      expect(() => upsertRating(base.user.id, base.course.id, 6)).toThrow();
    });

    it("throws when rating is not an integer", () => {
      expect(() => upsertRating(base.user.id, base.course.id, 3.5)).toThrow();
    });

    it("allows different users to rate the same course independently", () => {
      const u2 = makeUser("Second", "second@example.com");
      upsertRating(base.user.id, base.course.id, 5);
      upsertRating(u2.id, base.course.id, 1);

      const all = testDb
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.courseId, base.course.id))
        .all();
      expect(all).toHaveLength(2);
    });
  });

  describe("unique constraint", () => {
    it("rejects a second raw insert for the same user/course", () => {
      testDb
        .insert(schema.ratings)
        .values({ userId: base.user.id, courseId: base.course.id, rating: 4 })
        .run();

      expect(() => {
        testDb
          .insert(schema.ratings)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            rating: 5,
          })
          .run();
      }).toThrow();
    });
  });

  describe("getUserRating", () => {
    it("returns undefined when the user has not rated", () => {
      expect(getUserRating(base.user.id, base.course.id)).toBeUndefined();
    });

    it("returns the rating when present", () => {
      upsertRating(base.user.id, base.course.id, 4);
      const r = getUserRating(base.user.id, base.course.id);
      expect(r).toBeDefined();
      expect(r!.rating).toBe(4);
    });
  });

  describe("getCourseRatingStats", () => {
    it("returns null average and 0 count for an unrated course", () => {
      const stats = getCourseRatingStats(base.course.id);
      expect(stats.average).toBeNull();
      expect(stats.count).toBe(0);
    });

    it("computes average and count across multiple raters", () => {
      const u2 = makeUser("Two", "two@example.com");
      const u3 = makeUser("Three", "three@example.com");

      upsertRating(base.user.id, base.course.id, 4);
      upsertRating(u2.id, base.course.id, 5);
      upsertRating(u3.id, base.course.id, 3);

      const stats = getCourseRatingStats(base.course.id);
      expect(stats.count).toBe(3);
      expect(stats.average).toBeCloseTo(4, 5);
    });
  });

  describe("getRatingStatsForCourses", () => {
    it("returns an empty map for an empty input array", () => {
      const result = getRatingStatsForCourses([]);
      expect(result.size).toBe(0);
    });

    it("returns stats only for courses that have ratings", () => {
      const c2 = makeCourse("Course Two", "course-two");
      const c3 = makeCourse("Course Three", "course-three");
      const u2 = makeUser("Two", "two@example.com");

      // base.course: avg 4 from 2 ratings
      upsertRating(base.user.id, base.course.id, 3);
      upsertRating(u2.id, base.course.id, 5);
      // c2: avg 2 from 1 rating
      upsertRating(base.user.id, c2.id, 2);
      // c3: no ratings

      const result = getRatingStatsForCourses([
        base.course.id,
        c2.id,
        c3.id,
      ]);

      expect(result.get(base.course.id)).toEqual({ average: 4, count: 2 });
      expect(result.get(c2.id)).toEqual({ average: 2, count: 1 });
      expect(result.has(c3.id)).toBe(false);
    });
  });
});
