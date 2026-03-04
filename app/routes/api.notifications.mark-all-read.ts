import { data } from "react-router";
import type { Route } from "./+types/api.notifications.mark-all-read";
import { getCurrentUserId } from "~/lib/session";
import { markAllAsRead } from "~/services/notificationService";

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  markAllAsRead(currentUserId);

  return { success: true };
}
