import { data } from "react-router";
import type { Route } from "./+types/api.moderate-comment";
import { getCurrentUserId } from "~/lib/session";
import { getCommentById, moderateComment } from "~/services/commentService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { getCourseById } from "~/services/courseService";
import { getUserById } from "~/services/userService";
import { CommentStatus, UserRole } from "~/db/schema";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Unauthorized", { status: 401 });
  }

  const user = getUserById(userId);
  if (!user) {
    throw data("User not found", { status: 401 });
  }

  const body = await request.json();
  const commentId = Number(body.commentId);
  const status = body.status as string;

  if (!commentId || isNaN(commentId)) {
    throw data("Invalid commentId", { status: 400 });
  }

  if (status !== CommentStatus.Approved && status !== CommentStatus.Rejected) {
    throw data("Status must be 'approved' or 'rejected'", { status: 400 });
  }

  const comment = getCommentById(commentId);
  if (!comment) {
    throw data("Comment not found", { status: 404 });
  }

  if (user.role !== UserRole.Admin) {
    const lesson = getLessonById(comment.lessonId);
    const mod = lesson ? getModuleById(lesson.moduleId) : null;
    const course = mod ? getCourseById(mod.courseId) : null;

    if (!course || course.instructorId !== userId) {
      throw data("Only the course instructor or an admin can moderate comments", { status: 403 });
    }
  }

  const updated = moderateComment(commentId, status as CommentStatus);
  return data({ ok: true, comment: updated });
}
