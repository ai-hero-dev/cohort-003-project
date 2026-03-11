import { useState, useEffect } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { toast } from "sonner";
import * as v from "valibot";
import type { Route } from "./+types/instructor.new";
import { createCourse, getCourseBySlug } from "~/services/courseService";
import {
  getAllCategories,
  slugify as generateSlug,
} from "~/services/categoryService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { parseFormData } from "~/lib/validation";
import { UserRole } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

const newCourseSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required.")),
  description: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Description is required.")
  ),
  categoryId: v.pipe(v.string(), v.minLength(1, "Category is required.")),
  coverImageUrl: v.optional(v.pipe(v.string(), v.trim())),
});

export function meta() {
  return [
    { title: "New Course — Cadence" },
    { name: "description", content: "Create a new course" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to create a course.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can create courses.", {
      status: 403,
    });
  }

  const categories = getAllCategories();

  return { categories };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in to create a course.", { status: 401 });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can create courses.", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, newCourseSchema);

  if (!parsed.success) {
    return data({ errors: parsed.errors }, { status: 400 });
  }

  const { title, description, categoryId, coverImageUrl } = parsed.data;

  const slug = generateSlug(title);

  const existingCourse = getCourseBySlug(slug);
  if (existingCourse) {
    return data(
      {
        errors: {
          title: "A course with a similar title already exists.",
        } as Record<string, string>,
      },
      { status: 400 }
    );
  }

  const course = createCourse(
    title,
    slug,
    description,
    currentUserId,
    parseInt(categoryId, 10),
    coverImageUrl || null
  );

  throw redirect(`/courses/${course.slug}`);
}

export default function InstructorNewCourse({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { categories } = loaderData;
  const errors = actionData?.errors;
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.errors) {
      const firstError = Object.values(fetcher.data.errors)[0];
      if (firstError) {
        toast.error(firstError as string);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">New Course</span>
      </nav>

      <div className="mb-8">
        <Link
          to="/instructor"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to My Courses
        </Link>
        <h1 className="text-3xl font-bold">Create New Course</h1>
        <p className="mt-1 text-muted-foreground">
          Fill in the details below to create a new course. It will be saved as
          a draft.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <h2 className="text-lg font-semibold">Course Details</h2>
        </CardHeader>
        <CardContent>
          <fetcher.Form method="post" className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Introduction to TypeScript"
                aria-invalid={errors?.title ? true : undefined}
              />
              {errors?.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The URL slug will be auto-generated from the title.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what students will learn in this course..."
                rows={4}
                aria-invalid={errors?.description ? true : undefined}
              />
              {errors?.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <input type="hidden" name="categoryId" value={selectedCategory} />
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger
                  className="w-full"
                  aria-invalid={errors?.categoryId ? true : undefined}
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId}</p>
              )}
            </div>

            {/* Cover Image URL */}
            <div className="space-y-2">
              <Label htmlFor="coverImageUrl">
                Cover Image URL{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="coverImageUrl"
                name="coverImageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Course"}
              </Button>
              <Link to="/instructor">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </fetcher.Form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
