import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { redirect, data } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/login";
import { getUserByEmail } from "~/services/userService";
import { setCurrentUserId, getCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";

const loginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.minLength(1, "Email is required."),
    v.email("Please enter a valid email address.")
  ),
});

export function meta() {
  return [
    { title: "Log In — Cadence" },
    { name: "description", content: "Log in to your Cadence account" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (currentUserId) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirectTo");
    const destination =
      redirectTo && redirectTo.startsWith("/") ? redirectTo : "/courses";
    throw redirect(destination);
  }
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = parseFormData(formData, loginSchema);

  if (!parsed.success) {
    return data(
      {
        errors: parsed.errors,
        values: { email: String(formData.get("email") ?? "") },
      },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  const user = getUserByEmail(email);
  if (!user) {
    return data(
      {
        errors: { email: "No account found with that email." },
        values: { email },
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");
  const destination =
    redirectTo && redirectTo.startsWith("/") ? redirectTo : "/courses";

  const cookie = await setCurrentUserId(request, user.id);
  throw redirect(destination, {
    headers: { "Set-Cookie": cookie },
  });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            Cadence
          </Link>
          <h1 className="mt-4 text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log in to continue learning
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form method="post" className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  defaultValue={actionData?.values?.email ?? ""}
                  aria-invalid={!!actionData?.errors?.email}
                />
                {actionData?.errors?.email && (
                  <p className="mt-1 text-sm text-destructive">
                    {actionData.errors.email}{" "}
                    {actionData.errors.email.includes("No account") && (
                      <Link
                        to={
                          redirectTo
                            ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
                            : "/signup"
                        }
                        className="font-medium text-primary hover:underline"
                      >
                        Sign up instead
                      </Link>
                    )}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Log In"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to={
              redirectTo
                ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
                : "/signup"
            }
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
