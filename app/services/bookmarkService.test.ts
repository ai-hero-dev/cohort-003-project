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
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function makeModule(title: string, position: number) {
  return testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title, position })
    .returning()
    .get();
}

function makeLesson(moduleId: number, title: string, position: number) {
  return testDb
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get();
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: true });
    });

    it("removes a bookmark when one already exists", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: false });
    });

    it("re-creates a bookmark after toggling off then on", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({
        userId: base.user.id,
        lessonId: lesson.id,
      });

      expect(result).toEqual({ bookmarked: true });
    });

    it("does not affect bookmarks from other users", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: otherUser.id, lessonId: lesson.id });

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
      expect(
        isLessonBookmarked({ userId: otherUser.id, lessonId: lesson.id })
      ).toBe(true);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });

    it("returns true after bookmarking", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(true);
    });

    it("returns false after unbookmarking", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks exist", () => {
      const result = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(result).toEqual([]);
    });

    it("returns bookmarked lesson IDs for the given course", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson1 = makeLesson(mod.id, "Lesson 1", 1);
      const lesson2 = makeLesson(mod.id, "Lesson 2", 2);
      const lesson3 = makeLesson(mod.id, "Lesson 3", 3);

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson3.id });

      const result = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(result.sort()).toEqual([lesson1.id, lesson3.id].sort());
    });

    it("does not include bookmarks from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other",
          slug: "other",
          description: "desc",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const mod1 = makeModule("Mod 1", 1);
      const lesson1 = makeLesson(mod1.id, "Lesson 1", 1);

      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: otherCourse.id, title: "Other Mod", position: 1 })
        .returning()
        .get();
      const otherLesson = makeLesson(mod2.id, "Other Lesson", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: otherLesson.id });

      const result = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(result).toEqual([lesson1.id]);
    });

    it("does not include bookmarks from other users", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const mod = makeModule("Mod 1", 1);
      const lesson1 = makeLesson(mod.id, "Lesson 1", 1);
      const lesson2 = makeLesson(mod.id, "Lesson 2", 2);

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: otherUser.id, lessonId: lesson2.id });

      const result = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(result).toEqual([lesson1.id]);
    });

    it("spans multiple modules in the same course", () => {
      const mod1 = makeModule("Mod 1", 1);
      const mod2 = makeModule("Mod 2", 2);
      const lesson1 = makeLesson(mod1.id, "Lesson 1", 1);
      const lesson2 = makeLesson(mod2.id, "Lesson 2", 1);

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson2.id });

      const result = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(result.sort()).toEqual([lesson1.id, lesson2.id].sort());
    });
  });

  describe("unique constraint", () => {
    it("rejects a second raw insert for the same user/lesson", () => {
      const mod = makeModule("Mod 1", 1);
      const lesson = makeLesson(mod.id, "Lesson 1", 1);

      testDb
        .insert(schema.lessonBookmarks)
        .values({ userId: base.user.id, lessonId: lesson.id })
        .run();

      expect(() => {
        testDb
          .insert(schema.lessonBookmarks)
          .values({ userId: base.user.id, lessonId: lesson.id })
          .run();
      }).toThrow();
    });
  });
});
