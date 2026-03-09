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

import { awardXp, getTotalXp, getXpEvents } from "./xpService";

function createModuleWithLessons(
  courseId: number,
  moduleTitle: string,
  position: number,
  lessonCount: number
) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: moduleTitle, position })
    .returning()
    .get();

  const lessons = [];
  for (let i = 0; i < lessonCount; i++) {
    const lesson = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${i + 1}`, position: i + 1 })
      .returning()
      .get();
    lessons.push(lesson);
  }

  return { module: mod, lessons };
}

describe("xpService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("awardXp", () => {
    it("awards XP for a lesson completion", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 1);

      const event = awardXp(base.user.id, 10, "lesson_complete", lessons[0].id);

      expect(event).not.toBeNull();
      expect(event!.userId).toBe(base.user.id);
      expect(event!.amount).toBe(10);
      expect(event!.sourceType).toBe("lesson_complete");
      expect(event!.sourceId).toBe(lessons[0].id);
    });

    it("prevents duplicate XP for the same source", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 1);

      awardXp(base.user.id, 10, "lesson_complete", lessons[0].id);
      const duplicate = awardXp(
        base.user.id,
        10,
        "lesson_complete",
        lessons[0].id
      );

      expect(duplicate).toBeNull();
    });

    it("allows XP for different sources", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 2);

      const event1 = awardXp(
        base.user.id,
        10,
        "lesson_complete",
        lessons[0].id
      );
      const event2 = awardXp(
        base.user.id,
        10,
        "lesson_complete",
        lessons[1].id
      );

      expect(event1).not.toBeNull();
      expect(event2).not.toBeNull();
    });

    it("allows same source for different users", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 1);

      const event1 = awardXp(
        base.user.id,
        10,
        "lesson_complete",
        lessons[0].id
      );
      const event2 = awardXp(
        base.instructor.id,
        10,
        "lesson_complete",
        lessons[0].id
      );

      expect(event1).not.toBeNull();
      expect(event2).not.toBeNull();
    });
  });

  describe("getTotalXp", () => {
    it("returns 0 for a user with no XP", () => {
      expect(getTotalXp(base.user.id)).toBe(0);
    });

    it("sums XP across multiple events", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 3);

      awardXp(base.user.id, 10, "lesson_complete", lessons[0].id);
      awardXp(base.user.id, 10, "lesson_complete", lessons[1].id);
      awardXp(base.user.id, 5, "quiz_pass", 100);

      expect(getTotalXp(base.user.id)).toBe(25);
    });

    it("does not include other users XP", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 1);

      awardXp(base.user.id, 10, "lesson_complete", lessons[0].id);
      awardXp(base.instructor.id, 10, "lesson_complete", lessons[0].id);

      expect(getTotalXp(base.user.id)).toBe(10);
    });
  });

  describe("getXpEvents", () => {
    it("returns all XP events for a user", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "M1", 1, 2);

      awardXp(base.user.id, 10, "lesson_complete", lessons[0].id);
      awardXp(base.user.id, 10, "lesson_complete", lessons[1].id);

      const events = getXpEvents(base.user.id);
      expect(events).toHaveLength(2);
    });

    it("returns empty array for user with no events", () => {
      expect(getXpEvents(base.user.id)).toHaveLength(0);
    });
  });
});
