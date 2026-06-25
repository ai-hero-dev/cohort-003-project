import { eq, and, inArray } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

export function toggleBookmark(opts: {
  userId: number;
  lessonId: number;
}): { bookmarked: boolean } {
  const { userId, lessonId } = opts;

  const existing = db
    .select({ id: lessonBookmarks.id })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, existing.id)).run();
    return { bookmarked: false };
  }

  db.insert(lessonBookmarks).values({ userId, lessonId }).run();
  return { bookmarked: true };
}

export function isLessonBookmarked(opts: {
  userId: number;
  lessonId: number;
}): boolean {
  const { userId, lessonId } = opts;

  const row = db
    .select({ id: lessonBookmarks.id })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  return !!row;
}

export function getBookmarkedLessonIds(opts: {
  userId: number;
  courseId: number;
}): number[] {
  const { userId, courseId } = opts;

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseLessons.length === 0) return [];

  const lessonIds = courseLessons.map((l) => l.id);

  const bookmarks = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        inArray(lessonBookmarks.lessonId, lessonIds)
      )
    )
    .all();

  return bookmarks.map((b) => b.lessonId);
}
