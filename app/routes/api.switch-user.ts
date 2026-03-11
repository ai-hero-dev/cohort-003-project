import { redirect } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/api.switch-user";
import { setCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";

const switchUserSchema = v.object({
  userId: v.pipe(
    v.unknown(),
    v.transform(Number),
    v.integer(),
    v.minValue(1, "Invalid user ID")
  ),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = parseFormData(formData, switchUserSchema);

  if (!parsed.success) {
    throw new Response("Invalid user ID", { status: 400 });
  }

  const cookie = await setCurrentUserId(request, parsed.data.userId);

  return redirect(new URL(request.url).searchParams.get("redirectTo") ?? "/", {
    headers: { "Set-Cookie": cookie },
  });
}
