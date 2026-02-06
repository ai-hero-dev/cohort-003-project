import { useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/courses.$slug";
import { getCourseBySlug, getCourseWithDetails, getLessonCountForCourse } from "~/services/courseService";
import { isUserEnrolled, enrollUser } from "~/services/enrollmentService";
import { calculateProgress, getLessonProgressForCourse } from "~/services/progressService";
import { getCurrentUserId } from "~/lib/session";
import { LessonProgressStatus } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, BookOpen, CheckCircle2, Circle, Clock, PlayCircle, User } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { formatDuration } from "~/lib/utils";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} — Ralph` },
    { name: "description", content: loaderData?.course?.description ?? "" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(course.id);
  const currentUserId = await getCurrentUserId(request);

  let enrolled = false;
  let progress = 0;
  let lessonProgressMap: Record<number, string> = {};

  if (currentUserId) {
    enrolled = isUserEnrolled(currentUserId, course.id);

    if (enrolled) {
      progress = calculateProgress(currentUserId, course.id, false, false);

      const progressRecords = getLessonProgressForCourse(currentUserId, course.id);
      for (const record of progressRecords) {
        lessonProgressMap[record.lessonId] = record.status;
      }
    }
  }

  return {
    course: courseWithDetails,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    currentUserId,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in to enroll", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "enroll") {
    enrollUser(currentUserId, course.id, false, false);
    return { success: true };
  }

  throw data("Invalid action", { status: 400 });
}

export function HydrateFallback() {
  return (
    <div className="p-6 lg:p-8">
      <nav className="mb-6">
        <Skeleton className="h-4 w-48" />
      </nav>
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-6 aspect-video rounded-lg" />
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="mb-3 h-9 w-3/4" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-4 h-4 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CourseDetail({ loaderData }: Route.ComponentProps) {
  const { course, lessonCount, enrolled, progress, lessonProgressMap, currentUserId } = loaderData;
  const fetcher = useFetcher();
  const isEnrolling = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Successfully enrolled in this course!");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      {/* Course Header */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {course.coverImageUrl && (
            <div className="mb-6 aspect-video overflow-hidden rounded-lg">
              <img
                src={course.coverImageUrl}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="mb-2 text-sm font-medium text-primary">
            {course.categoryName}
          </div>
          <h1 className="mb-3 text-3xl font-bold">{course.title}</h1>
          <p className="mb-4 text-muted-foreground">{course.description}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-4" />
              {course.instructorName}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="size-4" />
              {lessonCount} lessons
            </span>
          </div>
        </div>

        {/* Enrollment Card */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {enrolled ? "Your Progress" : "Get Started"}
              </h2>
            </CardHeader>
            <CardContent>
              {enrolled ? (
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{progress}% complete</span>
                  </div>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {course.modules.length > 0 && (
                    <Link
                      to={`/courses/${course.slug}/lessons/${
                        course.modules[0].lessons[0]?.id ?? ""
                      }`}
                    >
                      <Button className="w-full">
                        <PlayCircle className="mr-2 size-4" />
                        {progress > 0 ? "Continue Learning" : "Start Course"}
                      </Button>
                    </Link>
                  )}
                </div>
              ) : currentUserId ? (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="enroll" />
                  <Button className="w-full" disabled={isEnrolling}>
                    {isEnrolling ? "Enrolling..." : "Enroll Now"}
                  </Button>
                </fetcher.Form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a user from the DevUI panel to enroll.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course Structure */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Course Content</h2>
        {course.modules.length === 0 ? (
          <p className="text-muted-foreground">
            No content has been added to this course yet.
          </p>
        ) : (
          <div className="space-y-4">
            {course.modules.map((mod) => (
              <Card key={mod.id}>
                <CardHeader>
                  <h3 className="font-semibold">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {mod.lessons.length} lessons
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {mod.lessons.map((lesson) => {
                      const status = lessonProgressMap[lesson.id];
                      const isCompleted = status === LessonProgressStatus.Completed;
                      const isInProgress = status === LessonProgressStatus.InProgress;

                      return (
                        <li key={lesson.id}>
                          {enrolled ? (
                            <Link
                              to={`/courses/${course.slug}/lessons/${lesson.id}`}
                              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                              ) : isInProgress ? (
                                <PlayCircle className="size-4 shrink-0 text-blue-500" />
                              ) : (
                                <Circle className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="flex-1">{lesson.title}</span>
                              {lesson.durationMinutes && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="size-3" />
                                  {formatDuration(lesson.durationMinutes, true, false, false)}
                                </span>
                              )}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-3 py-2 text-sm">
                              <Circle className="size-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1">{lesson.title}</span>
                              {lesson.durationMinutes && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="size-3" />
                                  {formatDuration(lesson.durationMinutes, true, false, false)}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this course.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message = "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
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
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
