import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.lesson-comments";
import { getCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import {
  createComment,
  editComment,
  softDeleteComment,
  reportComment,
  setCommentVisibility,
} from "~/services/commentService";
import { db } from "~/db";
import { lessonComments, lessons, modules, courses } from "~/db/schema";
import { eq } from "drizzle-orm";

const createSchema = z.object({
  intent: z.literal("create"),
  lessonId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});

const replySchema = z.object({
  intent: z.literal("reply"),
  lessonId: z.coerce.number().int().positive(),
  parentId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});

const editSchema = z.object({
  intent: z.literal("edit"),
  commentId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});

const deleteSchema = z.object({
  intent: z.literal("delete"),
  commentId: z.coerce.number().int().positive(),
});

const reportSchema = z.object({
  intent: z.literal("report"),
  commentId: z.coerce.number().int().positive(),
});

const hideSchema = z.object({
  intent: z.literal("hide"),
  commentId: z.coerce.number().int().positive(),
});

const unhideSchema = z.object({
  intent: z.literal("unhide"),
  commentId: z.coerce.number().int().positive(),
});

const schema = z.discriminatedUnion("intent", [
  createSchema,
  replySchema,
  editSchema,
  deleteSchema,
  reportSchema,
  hideSchema,
  unhideSchema,
]);

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, schema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }
  const input = parsed.data;

  try {
    switch (input.intent) {
      case "create":
      case "reply": {
        await requireCanPostOnLesson(currentUserId, input.lessonId);
        createComment(
          currentUserId,
          input.lessonId,
          input.body,
          input.intent === "reply" ? input.parentId : null
        );
        return { ok: true };
      }
      case "edit": {
        editComment(currentUserId, input.commentId, input.body);
        return { ok: true };
      }
      case "delete": {
        softDeleteComment(currentUserId, input.commentId);
        return { ok: true };
      }
      case "report": {
        await requireCanPostOnComment(currentUserId, input.commentId);
        reportComment(currentUserId, input.commentId);
        return { ok: true };
      }
      case "hide": {
        setCommentVisibility(currentUserId, input.commentId, true);
        return { ok: true };
      }
      case "unhide": {
        setCommentVisibility(currentUserId, input.commentId, false);
        return { ok: true };
      }
    }
  } catch (err) {
    throw toHttp(err);
  }
}

// ─── Helpers ───

async function requireCanPostOnLesson(userId: number, lessonId: number) {
  const lesson = getLessonById(lessonId);
  if (!lesson) {
    throw data("Lesson not found", { status: 404 });
  }
  const mod = getModuleById(lesson.moduleId);
  if (!mod) {
    throw data("Module not found", { status: 404 });
  }
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, mod.courseId))
    .get();
  if (!course) {
    throw data("Course not found", { status: 404 });
  }
  if (course.instructorId === userId) return;
  if (!isUserEnrolled(userId, course.id)) {
    throw data("You must be enrolled to comment", { status: 403 });
  }
}

async function requireCanPostOnComment(userId: number, commentId: number) {
  const row = db
    .select({
      courseId: courses.id,
      instructorId: courses.instructorId,
    })
    .from(lessonComments)
    .innerJoin(lessons, eq(lessons.id, lessonComments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(lessonComments.id, commentId))
    .get();

  if (!row) {
    throw data("Comment not found", { status: 404 });
  }
  if (row.instructorId === userId) return;
  if (!isUserEnrolled(userId, row.courseId)) {
    throw data("You must be enrolled to report", { status: 403 });
  }
}

function toHttp(err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  // Service throws "Not authorized" for permission failures.
  const status = /Not authorized/i.test(msg) ? 403 : 400;
  return data(msg, { status });
}
