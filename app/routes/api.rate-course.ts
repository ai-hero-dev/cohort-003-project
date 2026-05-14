import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.rate-course";
import { getCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { submitRating, getRatingForUser } from "~/services/ratingService";

const rateCourseSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, rateCourseSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { courseId, rating } = parsed.data;

  if (!isUserEnrolled(currentUserId, courseId)) {
    throw data("Not enrolled in this course", { status: 403 });
  }

  if (getRatingForUser(currentUserId, courseId)) {
    throw data("Already rated", { status: 400 });
  }

  submitRating(currentUserId, courseId, rating);

  return { ok: true };
}
