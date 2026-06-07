import { data } from "react-router";
import type { Route } from "./+types/api.course-rating";
import { getCurrentUserId } from "~/lib/session";
import { upsertCourseRating } from "~/services/ratingService";
import { isUserEnrolled } from "~/services/enrollmentService";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    throw data("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const courseId = Number(body.courseId);
  const rating = Number(body.rating);

  if (!courseId || isNaN(courseId)) {
    throw data("Invalid courseId", { status: 400 });
  }

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw data("Rating must be an integer between 1 and 5", { status: 400 });
  }

  if (!isUserEnrolled(userId, courseId)) {
    throw data("You must be enrolled to rate this course", { status: 403 });
  }

  const result = upsertCourseRating(userId, courseId, rating);
  return data({ ok: true, rating: result });
}
