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

import { markLessonComplete, isLessonCompleted } from "./progressService";
import { getLessonsByModule } from "./lessonService";
import { getModuleById } from "./moduleService";

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
      .values({
        moduleId: mod.id,
        title: `Lesson ${i + 1}`,
        position: i + 1,
      })
      .returning()
      .get();
    lessons.push(lesson);
  }

  return { module: mod, lessons };
}

/**
 * Tests the module completion detection logic used in the lesson action handler.
 * This mirrors the logic in courses.$slug.lessons.$lessonId.tsx action.
 */
function checkModuleComplete(userId: number, lessonId: number) {
  const lesson = testDb
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.id, lessonId))
    .get();
  if (!lesson) return null;

  const moduleLessons = getLessonsByModule(lesson.moduleId);
  const allComplete = moduleLessons.every(
    (l) => l.id === lessonId || isLessonCompleted(userId, l.id)
  );

  if (allComplete) {
    const moduleRecord = getModuleById(lesson.moduleId);
    return {
      moduleTitle: moduleRecord?.title ?? "Module",
      totalXp: moduleLessons.length * 10,
    };
  }
  return null;
}

describe("module completion detection", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("detects module completion when last lesson is completed", () => {
    const { lessons } = createModuleWithLessons(
      base.course.id,
      "Module 1",
      1,
      3
    );

    // Complete first two lessons
    markLessonComplete(base.user.id, lessons[0].id);
    markLessonComplete(base.user.id, lessons[1].id);

    // Mark the third (last) lesson complete
    markLessonComplete(base.user.id, lessons[2].id);
    const result = checkModuleComplete(base.user.id, lessons[2].id);

    expect(result).not.toBeNull();
    expect(result!.moduleTitle).toBe("Module 1");
    expect(result!.totalXp).toBe(30); // 3 lessons × 10 XP
  });

  it("does not detect completion when not all lessons are done", () => {
    const { lessons } = createModuleWithLessons(
      base.course.id,
      "Module 1",
      1,
      3
    );

    // Only complete the first lesson
    markLessonComplete(base.user.id, lessons[0].id);
    const result = checkModuleComplete(base.user.id, lessons[0].id);

    expect(result).toBeNull();
  });

  it("detects completion for a single-lesson module", () => {
    const { lessons } = createModuleWithLessons(base.course.id, "Single", 1, 1);

    markLessonComplete(base.user.id, lessons[0].id);
    const result = checkModuleComplete(base.user.id, lessons[0].id);

    expect(result).not.toBeNull();
    expect(result!.totalXp).toBe(10);
  });

  it("does not trigger for non-final lesson completions", () => {
    const { lessons } = createModuleWithLessons(
      base.course.id,
      "Module 1",
      1,
      4
    );

    // Complete lessons 1 and 3 (out of 4)
    markLessonComplete(base.user.id, lessons[0].id);
    markLessonComplete(base.user.id, lessons[2].id);

    // Now complete lesson 2 — still missing lesson 4
    markLessonComplete(base.user.id, lessons[1].id);
    const result = checkModuleComplete(base.user.id, lessons[1].id);

    expect(result).toBeNull();
  });

  it("module completion is per-module, not per-course", () => {
    const mod1 = createModuleWithLessons(base.course.id, "Module 1", 1, 2);
    const mod2 = createModuleWithLessons(base.course.id, "Module 2", 2, 2);

    // Complete all of module 1
    markLessonComplete(base.user.id, mod1.lessons[0].id);
    markLessonComplete(base.user.id, mod1.lessons[1].id);

    // Module 1 should be complete
    const result1 = checkModuleComplete(base.user.id, mod1.lessons[1].id);
    expect(result1).not.toBeNull();
    expect(result1!.moduleTitle).toBe("Module 1");

    // Module 2 should not be complete
    markLessonComplete(base.user.id, mod2.lessons[0].id);
    const result2 = checkModuleComplete(base.user.id, mod2.lessons[0].id);
    expect(result2).toBeNull();
  });

  it("calculates correct XP for modules of different sizes", () => {
    const mod1 = createModuleWithLessons(base.course.id, "Small", 1, 2);
    const mod2 = createModuleWithLessons(base.course.id, "Large", 2, 5);

    // Complete all of module 1
    mod1.lessons.forEach((l) => markLessonComplete(base.user.id, l.id));
    const result1 = checkModuleComplete(base.user.id, mod1.lessons[1].id);
    expect(result1!.totalXp).toBe(20); // 2 × 10

    // Complete all of module 2
    mod2.lessons.forEach((l) => markLessonComplete(base.user.id, l.id));
    const result2 = checkModuleComplete(base.user.id, mod2.lessons[4].id);
    expect(result2!.totalXp).toBe(50); // 5 × 10
  });
});
