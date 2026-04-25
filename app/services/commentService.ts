import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db } from "~/db";
import { comments, users, CommentStatus } from "~/db/schema";

// ─── Comment Service ───
// Handles comment CRUD and moderation for lesson discussions.
// Uses positional parameters (project convention).

export function getCommentsByLesson(lessonId: number) {
  return db
    .select({
      id: comments.id,
      lessonId: comments.lessonId,
      userId: comments.userId,
      parentId: comments.parentId,
      content: comments.content,
      status: comments.status,
      isPinned: comments.isPinned,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(desc(comments.isPinned), asc(comments.createdAt))
    .all();
}

export function getCommentById(commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

export function createComment(
  lessonId: number,
  userId: number,
  content: string,
  parentId: number | null
) {
  if (parentId !== null) {
    const parent = getCommentById(parentId);
    if (!parent || parent.parentId !== null) {
      throw new Error("Can only reply to top-level comments");
    }
  }

  return db
    .insert(comments)
    .values({
      lessonId,
      userId,
      content,
      parentId,
      status: CommentStatus.Active,
    })
    .returning()
    .get();
}

export function deleteComment(commentId: number) {
  return db
    .update(comments)
    .set({ status: CommentStatus.Deleted, isPinned: false, updatedAt: new Date().toISOString() })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}

export function togglePinComment(commentId: number) {
  const comment = getCommentById(commentId);
  if (!comment) return undefined;

  return db
    .update(comments)
    .set({ isPinned: !comment.isPinned, updatedAt: new Date().toISOString() })
    .where(eq(comments.id, commentId))
    .returning()
    .get();
}

export function getCommentCount(lessonId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(
      and(
        eq(comments.lessonId, lessonId),
        eq(comments.status, CommentStatus.Active)
      )
    )
    .get();
  return result?.count ?? 0;
}
