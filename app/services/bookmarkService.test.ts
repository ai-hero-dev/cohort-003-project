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
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function seedModule() {
  const mod = testDb
    .insert(schema.modules)
    .values({
      courseId: base.course.id,
      title: "Module 1",
      position: 1,
    })
    .returning()
    .get();

  const lesson1 = testDb
    .insert(schema.lessons)
    .values({
      moduleId: mod.id,
      title: "Lesson 1",
      position: 1,
    })
    .returning()
    .get();

  const lesson2 = testDb
    .insert(schema.lessons)
    .values({
      moduleId: mod.id,
      title: "Lesson 2",
      position: 2,
    })
    .returning()
    .get();

  return { mod, lesson1, lesson2 };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const { lesson1 } = seedModule();

      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson1.id,
      });

      expect(result.bookmarked).toBe(true);
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson1.id })
      ).toBe(true);
    });

    it("removes a bookmark when one exists", () => {
      const { lesson1 } = seedModule();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson1.id,
      });

      expect(result.bookmarked).toBe(false);
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson1.id })
      ).toBe(false);
    });

    it("re-creates a bookmark after toggling off and on", () => {
      const { lesson1 } = seedModule();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson1.id,
      });

      expect(result.bookmarked).toBe(true);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      const { lesson1 } = seedModule();

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson1.id })
      ).toBe(false);
    });

    it("returns true when a bookmark exists", () => {
      const { lesson1 } = seedModule();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson1.id })
      ).toBe(true);
    });

    it("is scoped to the user", () => {
      const { lesson1 } = seedModule();
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other User",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });

      expect(
        isLessonBookmarked({ userId: otherUser.id, lessonId: lesson1.id })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks exist", () => {
      seedModule();

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([]);
    });

    it("returns bookmarked lesson IDs for the course", () => {
      const { lesson1, lesson2 } = seedModule();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson2.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids.sort()).toEqual([lesson1.id, lesson2.id].sort());
    });

    it("does not include bookmarks from other courses", () => {
      const { lesson1 } = seedModule();

      // Create a second course with its own lesson
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: course2.id, title: "Mod 2", position: 1 })
        .returning()
        .get();
      const otherLesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod2.id, title: "Other Lesson", position: 1 })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: otherLesson.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([lesson1.id]);
    });

    it("does not include other users' bookmarks", () => {
      const { lesson1 } = seedModule();
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other User",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      toggleBookmark({ userId: otherUser.id, lessonId: lesson1.id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([]);
    });
  });
});
