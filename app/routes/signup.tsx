import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { redirect, data } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/signup";
import { getUserByEmail, createUser } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { setCurrentUserId, getCurrentUserId } from "~/lib/session";
import { parseFormData } from "~/lib/validation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

const signupSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required.")),
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
    { title: "Sign Up — Cadence" },
    { name: "description", content: "Create your Cadence account" },
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
  const parsed = parseFormData(formData, signupSchema);

  if (!parsed.success) {
    return data(
      {
        errors: parsed.errors,
        values: {
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
        },
      },
      { status: 400 }
    );
  }

  const { name, email } = parsed.data;

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");
  const destination =
    redirectTo && redirectTo.startsWith("/") ? redirectTo : "/courses";

  // If email already exists, silently log them in
  const existingUser = getUserByEmail(email);
  if (existingUser) {
    const cookie = await setCurrentUserId(request, existingUser.id);
    throw redirect(destination, {
      headers: { "Set-Cookie": cookie },
    });
  }

  // Create new user as student
  const newUser = createUser(name, email, UserRole.Student, null);
  const cookie = await setCurrentUserId(request, newUser.id);
  throw redirect(destination, {
    headers: { "Set-Cookie": cookie },
  });
}

export default function SignUp() {
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
          <h1 className="mt-4 text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start learning today
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form method="post" className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Name
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  defaultValue={actionData?.values?.name ?? ""}
                  aria-invalid={!!actionData?.errors?.name}
                />
                {actionData?.errors?.name && (
                  <p className="mt-1 text-sm text-destructive">
                    {actionData.errors.name}
                  </p>
                )}
              </div>

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
                    {actionData.errors.email}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to={
              redirectTo
                ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
                : "/login"
            }
            className="font-medium text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
