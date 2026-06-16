import { eq, and, desc } from "drizzle-orm";
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
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
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
        eq(lessonComments.status, CommentStatus.Pending)
      )
    )
    .orderBy(desc(lessonComments.createdAt))
    .all();
}
