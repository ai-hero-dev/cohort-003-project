import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  lessonComments,
  CommentStatus,
  users,
  lessons,
  modules,
} from "~/db/schema";

export function getCommentsForLesson(lessonId: number, includeHidden: boolean) {
  const statusFilter = includeHidden
    ? inArray(lessonComments.status, [
        CommentStatus.Visible,
        CommentStatus.Hidden,
      ])
    : eq(lessonComments.status, CommentStatus.Visible);

  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      content: lessonComments.content,
      status: lessonComments.status,
      createdAt: lessonComments.createdAt,
      updatedAt: lessonComments.updatedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(and(eq(lessonComments.lessonId, lessonId), statusFilter))
    .orderBy(lessonComments.createdAt)
    .all();
}

export function getCommentById(commentId: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();
}

export function createComment(
  lessonId: number,
  userId: number,
  content: string
) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, content, status: CommentStatus.Visible })
    .returning()
    .get();
}

export function hideComment(commentId: number) {
  return db
    .update(lessonComments)
    .set({ status: CommentStatus.Hidden, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function unhideComment(commentId: number) {
  return db
    .update(lessonComments)
    .set({ status: CommentStatus.Visible, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function deleteComment(commentId: number) {
  return db
    .delete(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function getRecentCommentsForCourse(courseId: number) {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      lessonTitle: lessons.title,
      userId: lessonComments.userId,
      content: lessonComments.content,
      status: lessonComments.status,
      createdAt: lessonComments.createdAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .innerJoin(lessons, eq(lessonComments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(desc(lessonComments.createdAt))
    .limit(50)
    .all();
}
