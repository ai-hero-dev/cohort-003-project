import { redirect } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/api.set-dev-country";
import { setDevCountry } from "~/lib/session";
import { parseFormData } from "~/lib/validation";

const setDevCountrySchema = v.object({
  country: v.pipe(
    v.union([v.pipe(v.string(), v.length(2)), v.literal("")]),
    v.transform((val) => val || null)
  ),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = parseFormData(formData, setDevCountrySchema);

  const country = parsed.success ? parsed.data.country : null;

  const cookie = await setDevCountry(request, country);

  return redirect(new URL(request.url).searchParams.get("redirectTo") ?? "/", {
    headers: { "Set-Cookie": cookie },
  });
}
