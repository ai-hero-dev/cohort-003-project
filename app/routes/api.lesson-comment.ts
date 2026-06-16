import { data } from "react-router";
import type { Route } from "./+types/api.lesson-comment";
import { getCurrentUserId } from "~/lib/session";
import { createComment } from "~/services/commentService";
import { isUserEnrolled } from "~/services/enrollmentService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const lessonId = Number(body.lessonId);
  const content = String(body.content ?? "").trim();

  if (!lessonId || isNaN(lessonId)) {
    throw data("Invalid lessonId", { status: 400 });
  }

  if (!content || content.length > 2000) {
    throw data("Comment must be between 1 and 2000 characters", { status: 400 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    throw data("Lesson not found", { status: 404 });
  }

  const mod = getModuleById(lesson.moduleId);
  if (!mod) {
    throw data("Module not found", { status: 404 });
  }

  if (!isUserEnrolled(userId, mod.courseId)) {
    throw data("You must be enrolled to comment", { status: 403 });
  }

  const comment = createComment(userId, lessonId, content);
  return data({ ok: true, comment });
}
