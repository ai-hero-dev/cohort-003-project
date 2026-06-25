import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "~/db";
import {
  lessonComments,
  CommentStatus,
  UserRole,
  users,
  lessons,
  modules,
  courses,
} from "~/db/schema";
import { isUserEnrolled } from "~/services/enrollmentService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";

export function getCommentsForLesson(
  lessonId: number,
  viewerUserId: number | null,
  viewerRole: UserRole | null
) {
  const rows = db
    .select({
      id: lessonComments.id,
      userId: lessonComments.userId,
      content: lessonComments.content,
      status: lessonComments.status,
      createdAt: lessonComments.createdAt,
      editedAt: lessonComments.editedAt,
      parentCommentId: lessonComments.parentCommentId,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(and(eq(lessonComments.lessonId, lessonId), isNull(lessonComments.deletedAt)))
    .orderBy(desc(lessonComments.createdAt))
    .all();

  return rows.filter((c) => {
    if (c.status === CommentStatus.Approved) return true;
    if (
      viewerRole === UserRole.Instructor ||
      viewerRole === UserRole.Admin
    )
      return true;
    if (viewerUserId && c.userId === viewerUserId) return true;
    return false;
  });
}

export function createComment(userId: number, lessonId: number, content: string) {
  return db
    .insert(lessonComments)
    .values({ userId, lessonId, content, status: CommentStatus.Pending })
    .returning()
    .get();
}

export function createReply(userId: number, parentCommentId: number, content: string) {
  const parent = db
    .select()
    .from(lessonComments)
    .where(and(eq(lessonComments.id, parentCommentId), isNull(lessonComments.deletedAt)))
    .get();

  if (!parent) {
    throw new Error("Parent comment not found or deleted");
  }

  const lesson = getLessonById(parent.lessonId);
  const mod = lesson ? getModuleById(lesson.moduleId) : null;
  if (!mod || !isUserEnrolled(userId, mod.courseId)) {
    throw new Error("Not enrolled");
  }

  return db
    .insert(lessonComments)
    .values({
      userId,
      lessonId: parent.lessonId,
      content,
      status: CommentStatus.Pending,
      parentCommentId,
    })
    .returning()
    .get();
}

export function editComment(commentId: number, userId: number, newContent: string) {
  const comment = db
    .select()
    .from(lessonComments)
    .where(and(eq(lessonComments.id, commentId), isNull(lessonComments.deletedAt)))
    .get();

  if (!comment) throw new Error("Comment not found");
  if (comment.userId !== userId) throw new Error("Not authorized");

  return db
    .update(lessonComments)
    .set({
      content: newContent,
      editedAt: new Date().toISOString(),
      status: CommentStatus.Pending,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function deleteComment(commentId: number, userId: number, userRole: UserRole) {
  const comment = db
    .select()
    .from(lessonComments)
    .where(and(eq(lessonComments.id, commentId), isNull(lessonComments.deletedAt)))
    .get();

  if (!comment) throw new Error("Comment not found");

  const canDelete =
    comment.userId === userId ||
    userRole === UserRole.Instructor ||
    userRole === UserRole.Admin;

  if (!canDelete) throw new Error("Not authorized");

  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function getCommentById(id: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, id))
    .get();
}

export function moderateComment(commentId: number, status: CommentStatus) {
  return db
    .update(lessonComments)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function getPendingCommentsForCourse(courseId: number) {
  return db
    .select({
      id: lessonComments.id,
      userId: lessonComments.userId,
      content: lessonComments.content,
      status: lessonComments.status,
      createdAt: lessonComments.createdAt,
      lessonId: lessonComments.lessonId,
      lessonTitle: lessons.title,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .innerJoin(lessons, eq(lessonComments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        eq(courses.id, courseId),
        eq(lessonComments.status, CommentStatus.Pending),
        isNull(lessonComments.deletedAt)
      )
    )
    .orderBy(desc(lessonComments.createdAt))
    .all();
}
