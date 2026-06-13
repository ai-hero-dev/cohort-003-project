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
  createComment,
  editComment,
  softDeleteComment,
  reportComment,
  setCommentVisibility,
  getCommentsForLesson,
  getModerationQueueForCourse,
} from "./commentService";

// Builds a lesson + module under base.course and enrolls base.user.
function seedLesson() {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module 1", position: 1 })
    .returning()
    .get();
  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();
  testDb
    .insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
  return { mod, lesson };
}

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── createComment ───

  describe("createComment", () => {
    it("creates a top-level comment", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Hello world", null);

      expect(c.id).toBeDefined();
      expect(c.body).toBe("Hello world");
      expect(c.lessonId).toBe(lesson.id);
      expect(c.userId).toBe(base.user.id);
      expect(c.parentId).toBeNull();
      expect(c.status).toBe(schema.CommentStatus.Visible);
      expect(c.reportCount).toBe(0);
    });

    it("creates a reply to a top-level comment", () => {
      const { lesson } = seedLesson();
      const top = createComment(base.user.id, lesson.id, "Top", null);
      const reply = createComment(
        base.instructor.id,
        lesson.id,
        "Reply",
        top.id
      );

      expect(reply.parentId).toBe(top.id);
    });

    it("rejects a reply whose parent is itself a reply", () => {
      const { lesson } = seedLesson();
      const top = createComment(base.user.id, lesson.id, "Top", null);
      const reply = createComment(
        base.instructor.id,
        lesson.id,
        "Reply",
        top.id
      );

      expect(() =>
        createComment(base.user.id, lesson.id, "Deep", reply.id)
      ).toThrow(/Cannot reply to a reply/i);
    });

    it("rejects a reply whose parent belongs to a different lesson", () => {
      const { lesson } = seedLesson();
      const otherLesson = testDb
        .insert(schema.lessons)
        .values({
          moduleId: lesson.moduleId,
          title: "Lesson 2",
          position: 2,
        })
        .returning()
        .get();
      const top = createComment(base.user.id, lesson.id, "Top", null);

      expect(() =>
        createComment(base.user.id, otherLesson.id, "Wrong", top.id)
      ).toThrow();
    });
  });

  // ─── editComment ───

  describe("editComment", () => {
    it("lets the author edit and sets editedAt", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Original", null);

      const edited = editComment(base.user.id, c.id, "Updated");
      expect(edited.body).toBe("Updated");
      expect(edited.editedAt).not.toBeNull();
    });

    it("rejects edits from a non-author", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Original", null);

      expect(() => editComment(base.instructor.id, c.id, "Hacked")).toThrow(
        /Not authorized/i
      );
    });

    it("rejects edits on a hidden comment", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Original", null);
      setCommentVisibility(base.instructor.id, c.id, true);

      expect(() => editComment(base.user.id, c.id, "Updated")).toThrow(
        /hidden/i
      );
    });
  });

  // ─── softDeleteComment ───

  describe("softDeleteComment", () => {
    it("lets the author soft-delete (sets deletedAt, keeps row)", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Original", null);

      const deleted = softDeleteComment(base.user.id, c.id);
      expect(deleted.deletedAt).not.toBeNull();
      // row still present
      const all = getCommentsForLesson(lesson.id);
      expect(all).toHaveLength(1);
    });

    it("rejects deletes from a non-author", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Original", null);

      expect(() => softDeleteComment(base.instructor.id, c.id)).toThrow(
        /Not authorized/i
      );
    });
  });

  // ─── reportComment ───

  describe("reportComment", () => {
    it("increments reportCount and persists a report row", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Spam?", null);

      reportComment(base.instructor.id, c.id);

      const refreshed = testDb
        .select()
        .from(schema.lessonComments)
        .where(eqId(c.id))
        .get();
      expect(refreshed?.reportCount).toBe(1);
    });

    it("treats a second report from the same user as a no-op", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Spam?", null);

      reportComment(base.instructor.id, c.id);
      reportComment(base.instructor.id, c.id);

      const refreshed = testDb
        .select()
        .from(schema.lessonComments)
        .where(eqId(c.id))
        .get();
      expect(refreshed?.reportCount).toBe(1);
    });

    it("rejects self-reporting", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "My own", null);

      expect(() => reportComment(base.user.id, c.id)).toThrow(
        /report your own/i
      );
    });
  });

  // ─── setCommentVisibility ───

  describe("setCommentVisibility", () => {
    it("lets the course's own instructor hide a comment", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Yikes", null);

      const hidden = setCommentVisibility(base.instructor.id, c.id, true);
      expect(hidden.status).toBe(schema.CommentStatus.Hidden);
    });

    it("lets an admin hide a comment", () => {
      const admin = testDb
        .insert(schema.users)
        .values({
          name: "Admin",
          email: "admin@example.com",
          role: schema.UserRole.Admin,
        })
        .returning()
        .get();
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Yikes", null);

      const hidden = setCommentVisibility(admin.id, c.id, true);
      expect(hidden.status).toBe(schema.CommentStatus.Hidden);
    });

    it("rejects another instructor who does not own the course", () => {
      const other = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Yikes", null);

      expect(() => setCommentVisibility(other.id, c.id, true)).toThrow(
        /Not authorized/i
      );
    });

    it("can unhide a previously hidden comment", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Yikes", null);

      setCommentVisibility(base.instructor.id, c.id, true);
      const unhidden = setCommentVisibility(base.instructor.id, c.id, false);
      expect(unhidden.status).toBe(schema.CommentStatus.Visible);
    });
  });

  // ─── getCommentsForLesson ───

  describe("getCommentsForLesson", () => {
    it("returns hidden comments with status='hidden' (UI placeholder concern)", () => {
      const { lesson } = seedLesson();
      const c = createComment(base.user.id, lesson.id, "Yikes", null);
      setCommentVisibility(base.instructor.id, c.id, true);

      const all = getCommentsForLesson(lesson.id);
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe(schema.CommentStatus.Hidden);
    });

    it("returns top-level comments newest-first and replies oldest-first", () => {
      const { lesson } = seedLesson();
      const top1 = createComment(base.user.id, lesson.id, "First", null);
      const top2 = createComment(base.user.id, lesson.id, "Second", null);
      const r1 = createComment(base.instructor.id, lesson.id, "R1", top1.id);
      const r2 = createComment(base.instructor.id, lesson.id, "R2", top1.id);

      const all = getCommentsForLesson(lesson.id);
      expect(all).toHaveLength(4);

      const topLevel = all.filter((c) => c.parentId === null);
      expect(topLevel[0].id).toBe(top2.id); // newest first
      expect(topLevel[1].id).toBe(top1.id);

      const replies = all.filter((c) => c.parentId === top1.id);
      expect(replies[0].id).toBe(r1.id); // oldest first
      expect(replies[1].id).toBe(r2.id);
    });

    it("includes the author's name", () => {
      const { lesson } = seedLesson();
      createComment(base.user.id, lesson.id, "Hi", null);

      const all = getCommentsForLesson(lesson.id);
      expect(all[0].authorName).toBe("Test User");
    });
  });

  // ─── getModerationQueueForCourse ───

  describe("getModerationQueueForCourse", () => {
    it("scopes results to the given course", () => {
      const { lesson } = seedLesson();
      createComment(base.user.id, lesson.id, "On this course", null);

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other",
          slug: "other",
          description: "x",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const otherMod = testDb
        .insert(schema.modules)
        .values({ courseId: otherCourse.id, title: "M", position: 1 })
        .returning()
        .get();
      const otherLesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: otherMod.id, title: "L", position: 1 })
        .returning()
        .get();
      createComment(base.user.id, otherLesson.id, "Different course", null);

      const queue = getModerationQueueForCourse(base.course.id);
      expect(queue).toHaveLength(1);
      expect(queue[0].body).toBe("On this course");
    });

    it("orders by reportCount descending", () => {
      const { lesson } = seedLesson();
      const c1 = createComment(base.user.id, lesson.id, "One", null);
      const c2 = createComment(base.user.id, lesson.id, "Two", null);

      reportComment(base.instructor.id, c2.id);

      const queue = getModerationQueueForCourse(base.course.id);
      expect(queue[0].id).toBe(c2.id);
      expect(queue[1].id).toBe(c1.id);
    });
  });
});

// Small helper to keep test signal high.
import { eq } from "drizzle-orm";
function eqId(id: number) {
  return eq(schema.lessonComments.id, id);
}
