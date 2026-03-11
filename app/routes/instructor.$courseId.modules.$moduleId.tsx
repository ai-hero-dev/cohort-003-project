import { Link } from "react-router";
import type { Route } from "./+types/instructor.$courseId.modules.$moduleId";
import { getCourseById, getCourseWithDetails } from "~/services/courseService";
import { getModuleWithLessons } from "~/services/moduleService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { UserAvatar } from "~/components/user-avatar";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Video,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { formatDuration } from "~/lib/utils";
import * as v from "valibot";

const paramsSchema = v.object({
  courseId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  moduleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
});

export function meta({ data: loaderData }: Route.MetaArgs) {
  const moduleTitle = loaderData?.module?.title ?? "Module";
  const courseTitle = loaderData?.course?.title ?? "Course";
  return [{ title: `Preview: ${moduleTitle} — ${courseTitle} — Cadence` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to manage courses.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const parsed = v.safeParse(paramsSchema, params);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { courseId, moduleId } = parsed.output;

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view your own courses.", { status: 403 });
  }

  const courseWithDetails = getCourseWithDetails(courseId);
  if (!courseWithDetails) {
    throw data("Course not found.", { status: 404 });
  }

  const moduleWithLessons = getModuleWithLessons(moduleId);
  if (!moduleWithLessons) {
    throw data("Module not found.", { status: 404 });
  }

  if (moduleWithLessons.courseId !== courseId) {
    throw data("Module not found in this course.", { status: 404 });
  }

  const totalLessons = moduleWithLessons.lessons.length;
  const totalDuration = moduleWithLessons.lessons.reduce(
    (sum, l) => sum + (l.durationMinutes ?? 0),
    0
  );

  return {
    course: {
      id: courseWithDetails.id,
      title: courseWithDetails.title,
      slug: courseWithDetails.slug,
      instructorName: courseWithDetails.instructorName,
      instructorAvatarUrl: courseWithDetails.instructorAvatarUrl,
      instructorBio: courseWithDetails.instructorBio,
    },
    module: moduleWithLessons,
    totalLessons,
    totalDuration,
  };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <nav className="mb-6">
        <Skeleton className="h-4 w-64" />
      </nav>
      <Skeleton className="mb-2 h-9 w-2/3" />
      <Skeleton className="mb-6 h-4 w-48" />
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function InstructorModulePreview({
  loaderData,
}: Route.ComponentProps) {
  const { course, module: mod, totalLessons, totalDuration } = loaderData;

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      {/* Back link and breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to={`/instructor/${course.id}`}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {course.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{mod.title}</span>
        </nav>
        <Link to={`/courses/${course.slug}/${mod.id}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-1 size-3.5" />
            Student View
          </Button>
        </Link>
      </div>

      {/* Module title and stats */}
      <h1 className="mb-2 text-3xl font-bold">{mod.title}</h1>
      <div className="mb-6 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="size-4" />
          {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"}
        </span>
        {totalDuration > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="size-4" />
            {formatDuration(totalDuration, true, false, false)}
          </span>
        )}
      </div>

      {/* Instructor card */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={course.instructorName}
              avatarUrl={course.instructorAvatarUrl}
              className="size-10"
            />
            <div>
              <div className="font-medium">{course.instructorName}</div>
              {course.instructorBio && (
                <p className="text-sm text-muted-foreground">
                  {course.instructorBio}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lesson list */}
      <h2 className="mb-4 text-xl font-semibold">Lessons</h2>
      {mod.lessons.length === 0 ? (
        <p className="text-muted-foreground">
          No lessons have been added to this module yet.
        </p>
      ) : (
        <div className="space-y-1">
          {mod.lessons.map((lesson) => {
            const hasVideo = !!lesson.videoUrl;

            return (
              <Link
                key={lesson.id}
                to={`/instructor/${course.id}/lessons/${lesson.id}`}
                className="block rounded-md hover:bg-muted"
              >
                <div className="flex items-center gap-3 rounded-md px-3 py-3 text-sm">
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{lesson.title}</span>
                  <div className="flex items-center gap-2">
                    {hasVideo ? (
                      <Video className="size-3.5 text-muted-foreground" />
                    ) : (
                      <FileText className="size-3.5 text-muted-foreground" />
                    )}
                    {lesson.durationMinutes && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDuration(
                          lesson.durationMinutes,
                          true,
                          false,
                          false
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message =
    "An unexpected error occurred while loading this module preview.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Not authenticated";
      message =
        typeof error.data === "string"
          ? error.data
          : "You must be logged in to access this page.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to view this page.";
    } else if (error.status === 404) {
      title = "Not found";
      message =
        typeof error.data === "string"
          ? error.data
          : "The requested resource was not found.";
    } else if (error.status === 400) {
      title = "Invalid request";
      message =
        typeof error.data === "string"
          ? error.data
          : "The request was invalid.";
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
