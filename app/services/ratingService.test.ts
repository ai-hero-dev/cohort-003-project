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

import { submitRating } from "./ratingService";

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

    it("throws when the user has already rated the course", () => {
      enroll(base.user.id, base.course.id);
      submitRating(base.user.id, base.course.id, 3);

      expect(() =>
        submitRating(base.user.id, base.course.id, 5)
      ).toThrowError("User has already rated this course");
    });
  });
});
