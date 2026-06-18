import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  lessonComments,
  lessonCommentReports,
  lessons,
  modules,
  courses,
  users,
  CommentStatus,
  UserRole,
} from "~/db/schema";

// ─── Comment Service ───
// Lesson comments with one-level threading, author edit/delete (soft),
// per-user reporting, and instructor/admin moderation (hide/unhide).
// Plain functions, positional params (project convention).
// Throws plain Error on invariant violations; the calling route maps to HTTP.

export type CommentWithAuthor = {
  id: number;
  lessonId: number;
  userId: number;
  parentId: number | null;
  body: string;
  status: CommentStatus;
  reportCount: number;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type ModerationItem = CommentWithAuthor & {
  lessonId: number;
  lessonTitle: string;
  courseSlug: string;
};

// ─── Reads ───

export function getCommentsForLesson(lessonId: number): CommentWithAuthor[] {
  const rows = db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      parentId: lessonComments.parentId,
      body: lessonComments.body,
      status: lessonComments.status,
      reportCount: lessonComments.reportCount,
      createdAt: lessonComments.createdAt,
      editedAt: lessonComments.editedAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(users.id, lessonComments.userId))
    .where(eq(lessonComments.lessonId, lessonId))
    .all();

  const topLevel = rows
    .filter((r) => r.parentId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);

  const repliesByParent = new Map<number, CommentWithAuthor[]>();
  for (const r of rows.filter((r) => r.parentId !== null)) {
    const arr = repliesByParent.get(r.parentId!) ?? [];
    arr.push(r);
    repliesByParent.set(r.parentId!, arr);
  }
  for (const arr of repliesByParent.values()) {
    arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  }

  const out: CommentWithAuthor[] = [];
  for (const top of topLevel) {
    out.push(top);
    const replies = repliesByParent.get(top.id) ?? [];
    out.push(...replies);
  }
  return out;
}

export function getModerationQueueForCourse(
  courseId: number
): ModerationItem[] {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      parentId: lessonComments.parentId,
      body: lessonComments.body,
      status: lessonComments.status,
      reportCount: lessonComments.reportCount,
      createdAt: lessonComments.createdAt,
      editedAt: lessonComments.editedAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      lessonTitle: lessons.title,
      courseSlug: courses.slug,
    })
    .from(lessonComments)
    .innerJoin(users, eq(users.id, lessonComments.userId))
    .innerJoin(lessons, eq(lessons.id, lessonComments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(courses.id, courseId))
    .orderBy(desc(lessonComments.reportCount), desc(lessonComments.createdAt))
    .all();
}

// ─── Mutations ───

export function createComment(
  userId: number,
  lessonId: number,
  body: string,
  parentId: number | null
) {
  if (parentId !== null) {
    const parent = db
      .select()
      .from(lessonComments)
      .where(eq(lessonComments.id, parentId))
      .get();

    if (!parent) {
      throw new Error("Parent comment not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("Parent comment is on a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Cannot reply to a reply");
    }
  }

  return db
    .insert(lessonComments)
    .values({ userId, lessonId, body, parentId })
    .returning()
    .get();
}

export function editComment(userId: number, commentId: number, body: string) {
  const existing = requireComment(commentId);

  if (existing.userId !== userId) {
    throw new Error("Not authorized");
  }
  if (existing.deletedAt) {
    throw new Error("Cannot edit a deleted comment");
  }
  if (existing.status === CommentStatus.Hidden) {
    throw new Error("Cannot edit a hidden comment");
  }

  return db
    .update(lessonComments)
    .set({ body, editedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function softDeleteComment(userId: number, commentId: number) {
  const existing = requireComment(commentId);

  if (existing.userId !== userId) {
    throw new Error("Not authorized");
  }

  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function reportComment(reporterId: number, commentId: number) {
  const existing = requireComment(commentId);

  if (existing.userId === reporterId) {
    throw new Error("You cannot report your own comment");
  }

  db.transaction((tx) => {
    tx.insert(lessonCommentReports)
      .values({ commentId, userId: reporterId })
      .onConflictDoNothing({
        target: [lessonCommentReports.commentId, lessonCommentReports.userId],
      })
      .run();

    const result = tx
      .select({ count: sql<number>`count(*)` })
      .from(lessonCommentReports)
      .where(eq(lessonCommentReports.commentId, commentId))
      .get();

    tx.update(lessonComments)
      .set({ reportCount: result?.count ?? 0 })
      .where(eq(lessonComments.id, commentId))
      .run();
  });
}

export function setCommentVisibility(
  moderatorId: number,
  commentId: number,
  hidden: boolean
) {
  const moderator = db
    .select()
    .from(users)
    .where(eq(users.id, moderatorId))
    .get();
  if (!moderator) {
    throw new Error("Not authorized");
  }

  // Admins moderate everything; otherwise the moderator must own the course.
  if (moderator.role !== UserRole.Admin) {
    const ownerRow = db
      .select({ instructorId: courses.instructorId })
      .from(lessonComments)
      .innerJoin(lessons, eq(lessons.id, lessonComments.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(eq(lessonComments.id, commentId))
      .get();

    if (!ownerRow || ownerRow.instructorId !== moderatorId) {
      throw new Error("Not authorized");
    }
  }

  return db
    .update(lessonComments)
    .set({ status: hidden ? CommentStatus.Hidden : CommentStatus.Visible })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

// ─── Internal ───

function requireComment(commentId: number) {
  const row = db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();
  if (!row) {
    throw new Error("Comment not found");
  }
  return row;
}
