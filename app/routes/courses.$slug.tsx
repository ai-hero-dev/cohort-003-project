import { useEffect, useState } from "react";
import { Link, useSearchParams, useFetcher } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/courses.$slug";
import {
  getCourseBySlug,
  getCourseWithDetails,
  getLessonCountForCourse,
} from "~/services/courseService";
import { isUserEnrolled } from "~/services/enrollmentService";
import {
  calculateProgress,
  getLessonProgressForCourse,
  getNextIncompleteLesson,
} from "~/services/progressService";
import { getCurrentUserId } from "~/lib/session";
import { LessonProgressStatus } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContentNoShift,
} from "~/components/ui/tabs";
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  PlayCircle,
  Star,
  Users,
} from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";
import { formatDuration, formatPrice } from "~/lib/utils";
import { parseFormData } from "~/lib/validation";
import { renderMarkdown } from "~/lib/markdown.server";
import { resolveCountry } from "~/lib/country.server";
import { calculatePppPrice, getCountryTierInfo } from "~/lib/ppp";
import {
  getAverageRating,
  getUserRating,
  rateCourse,
} from "~/services/ratingService";
import { getBookmarkedLessonIds } from "~/services/bookmarkService";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} — Cadence` },
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
  let nextLessonId: number | null = null;
  let userRating: number | null = null;
  let bookmarkedLessonIds: number[] = [];

  if (currentUserId) {
    enrolled = isUserEnrolled(currentUserId, course.id);

    if (enrolled) {
      progress = calculateProgress(currentUserId, course.id, false, false);

      const progressRecords = getLessonProgressForCourse(
        currentUserId,
        course.id
      );
      for (const record of progressRecords) {
        lessonProgressMap[record.lessonId] = record.status;
      }

      const nextLesson = getNextIncompleteLesson(currentUserId, course.id);
      nextLessonId = nextLesson?.id ?? null;

      const existingRating = getUserRating(currentUserId, course.id);
      userRating = existingRating?.rating ?? null;

      bookmarkedLessonIds = getBookmarkedLessonIds({
        userId: currentUserId,
        courseId: course.id,
      });
    }
  }

  const { average: averageRating, count: ratingCount } = getAverageRating(
    course.id
  );

  // Render sales copy from Markdown to HTML server-side
  const salesCopyHtml = courseWithDetails.salesCopy
    ? await renderMarkdown(courseWithDetails.salesCopy)
    : null;

  const country = await resolveCountry(request);
  const pppPrice = courseWithDetails.pppEnabled
    ? calculatePppPrice(courseWithDetails.price, country)
    : courseWithDetails.price;
  const tierInfo = getCountryTierInfo(country);

  return {
    course: courseWithDetails,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    averageRating,
    ratingCount,
    userRating,
    bookmarkedLessonIds,
  };
}

const rateActionSchema = v.variant("intent", [
  v.object({
    intent: v.literal("rate-course"),
    rating: v.pipe(
      v.unknown(),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(5)
    ),
  }),
]);

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Sign in required", { status: 401 });
  }

  const course = getCourseBySlug(params.slug);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  if (!isUserEnrolled(currentUserId, course.id)) {
    throw data("You must be enrolled to rate this course", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, rateActionSchema);

  if (!parsed.success) {
    throw data("Invalid rating", { status: 400 });
  }

  rateCourse(currentUserId, course.id, parsed.data.rating);
  return { success: true };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
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
  const {
    course,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    averageRating,
    ratingCount,
    userRating,
    bookmarkedLessonIds,
  } = loaderData;
  const bookmarkedSet = new Set(bookmarkedLessonIds);
  const isInstructor = currentUserId === course.instructorId;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("already_enrolled") === "1") {
      toast.info("You're already enrolled in this course.");
      setSearchParams(
        (prev) => {
          prev.delete("already_enrolled");
          return prev;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const totalDuration = course.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  const pppPriceLabel = formatPrice(pppPrice);
  const isDiscounted = pppPrice < course.price;

  const selfPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase`)}`;

  const teamPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase?mode=team`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase?mode=team`)}`;

  const priceDisplay = (
    <div className="mb-3 text-center">
      {isDiscounted ? (
        <>
          <div className="text-sm text-muted-foreground line-through">
            {formatPrice(course.price)}
          </div>
          <div className="text-2xl font-bold">{pppPriceLabel}</div>
          <div className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {tierInfo.label} — PPP discount
          </div>
        </>
      ) : (
        <div className="text-2xl font-bold">{pppPriceLabel}</div>
      )}
    </div>
  );

  const enrollButton = (
    <Tabs defaultValue="self">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="self" className="flex-1 text-xs">
          Buy for Myself
        </TabsTrigger>
        <TabsTrigger value="team" className="flex-1 text-xs">
          Buy for Team
        </TabsTrigger>
      </TabsList>
      <TabsContentNoShift>
        <TabsContent value="self" forceMount>
          {priceDisplay}
          <Link to={selfPurchaseLink}>
            <Button size="lg" className="w-full">
              Enroll Now — {pppPriceLabel}
            </Button>
          </Link>
        </TabsContent>
        <TabsContent value="team" forceMount>
          {priceDisplay}
          <Link to={teamPurchaseLink}>
            <Button size="lg" variant="outline" className="w-full">
              Buy for Your Team
            </Button>
          </Link>
        </TabsContent>
      </TabsContentNoShift>
    </Tabs>
  );

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      {/* Hero section */}
      <div className="mb-8">
        <div className="mb-6 aspect-video max-h-64 overflow-hidden rounded-lg">
          <CourseImage
            src={course.coverImageUrl}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-2 text-sm font-medium text-primary">
          {course.categoryName}
        </div>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h1 className="text-4xl font-bold">{course.title}</h1>
          {currentUserId === course.instructorId && (
            <Link to={`/instructor/${course.id}`}>
              <Button variant="outline" size="sm" className="shrink-0">
                <Pencil className="mr-1.5 size-3.5" />
                Edit Course
              </Button>
            </Link>
          )}
        </div>
        <p className="mb-4 text-lg text-muted-foreground">
          {course.description}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UserAvatar
              name={course.instructorName}
              avatarUrl={course.instructorAvatarUrl}
              className="size-5"
            />
            {course.instructorName}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-4" />
            {lessonCount} lessons
          </span>
          {totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatDuration(totalDuration, true, false, false)} total
            </span>
          )}
          {averageRating !== null && (
            <span className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-4 ${
                    i < Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
              <span className="ml-0.5 font-medium text-foreground">
                {averageRating}
              </span>
              <span>({ratingCount})</span>
            </span>
          )}
        </div>
      </div>

      {/* Two-column: sales copy left, sidebar right */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column: sales copy + course content */}
        <div className="lg:col-span-2">
          {salesCopyHtml ? (
            <div
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: salesCopyHtml }}
            />
          ) : (
            <p className="text-muted-foreground">{course.description}</p>
          )}

          {/* Bottom CTA */}
          {!enrolled && !isInstructor && (
            <div className="mt-8 rounded-lg border bg-muted/50 p-6">
              <h3 className="mb-2 text-lg font-semibold">
                Ready to get started?
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Join this course and start learning today.
              </p>
              {enrollButton}
            </div>
          )}

          <div className="mt-8">
            <CourseContent
              course={course}
              enrolled={enrolled}
              isInstructor={isInstructor}
              lessonProgressMap={lessonProgressMap}
              bookmarkedLessonIds={bookmarkedSet}
            />
          </div>
        </div>

        {/* Right column: progress/enrollment card */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {isInstructor
                  ? "Your Course"
                  : enrolled
                    ? "Your Progress"
                    : "Get Started"}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInstructor ? (
                <Link to={`/instructor/${course.id}`}>
                  <Button className="w-full">
                    <Pencil className="mr-2 size-4" />
                    Manage Course
                  </Button>
                </Link>
              ) : enrolled ? (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{progress}% complete</span>
                  </div>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {course.modules.length > 0 &&
                    (() => {
                      const targetLessonId =
                        nextLessonId ?? course.modules[0].lessons[0]?.id;
                      return targetLessonId ? (
                        <Link
                          to={`/courses/${course.slug}/lessons/${targetLessonId}`}
                        >
                          <Button className="w-full">
                            <PlayCircle className="mr-2 size-4" />
                            {progress > 0
                              ? "Continue Learning"
                              : "Start Course"}
                          </Button>
                        </Link>
                      ) : null;
                    })()}
                  <Link to={teamPurchaseLink}>
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 size-4" />
                      Buy More Seats
                    </Button>
                  </Link>
                  {!isInstructor && (
                    <RatingWidget
                      courseSlug={course.slug}
                      userRating={userRating}
                    />
                  )}
                </>
              ) : (
                enrollButton
              )}
              <div className="space-y-2 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>{lessonCount} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <span>
                    {formatDuration(totalDuration, true, false, false)} total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={course.instructorName}
                    avatarUrl={course.instructorAvatarUrl}
                    className="size-5"
                  />
                  <span>Taught by {course.instructorName}</span>
                </div>
                {course.instructorBio && (
                  <p className="mt-2 text-xs leading-relaxed">
                    {course.instructorBio}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RatingWidget({
  courseSlug,
  userRating,
}: {
  courseSlug: string;
  userRating: number | null;
}) {
  const fetcher = useFetcher();
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const optimisticRating = fetcher.formData
    ? Number(fetcher.formData.get("rating"))
    : userRating;
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Rating saved!");
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="border-t pt-4">
      <p className="mb-2 text-sm font-medium">Rate this course</p>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          const isFilled =
            hoveredStar !== null
              ? starValue <= hoveredStar
              : optimisticRating !== null && starValue <= optimisticRating;

          return (
            <fetcher.Form
              key={i}
              method="post"
              action={`/courses/${courseSlug}`}
            >
              <input type="hidden" name="intent" value="rate-course" />
              <input type="hidden" name="rating" value={starValue} />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-50"
                onMouseEnter={() => setHoveredStar(starValue)}
                onMouseLeave={() => setHoveredStar(null)}
              >
                <Star
                  className={`size-6 transition-colors ${
                    isFilled
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30 hover:text-amber-300"
                  }`}
                />
              </button>
            </fetcher.Form>
          );
        })}
      </div>
      {optimisticRating !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Your rating: {optimisticRating}/5
        </p>
      )}
    </div>
  );
}

function CourseContent({
  course,
  enrolled,
  isInstructor,
  lessonProgressMap,
  bookmarkedLessonIds,
}: {
  course: {
    id: number;
    slug: string;
    modules: Array<{
      id: number;
      title: string;
      lessons: Array<{
        id: number;
        title: string;
        durationMinutes: number | null;
      }>;
    }>;
  };
  enrolled: boolean;
  isInstructor: boolean;
  lessonProgressMap: Record<number, string>;
  bookmarkedLessonIds: Set<number>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Course Content</h2>
      {course.modules.length === 0 ? (
        <p className="text-muted-foreground">
          No content has been added to this course yet.
        </p>
      ) : (
        <div className="space-y-4">
          {course.modules.map((mod) => {
            const hasBookmark = mod.lessons.some((l) =>
              bookmarkedLessonIds.has(l.id)
            );

            return (
              <Card key={mod.id}>
                <CardHeader>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Link
                      to={`/courses/${course.slug}/${mod.id}`}
                      className="hover:underline"
                    >
                      {mod.title}
                    </Link>
                    {hasBookmark && (
                      <Bookmark className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {mod.lessons.length} lessons
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {mod.lessons.map((lesson) => {
                      const status = lessonProgressMap[lesson.id];
                      const isCompleted =
                        status === LessonProgressStatus.Completed;
                      const isLessonInProgress =
                        status === LessonProgressStatus.InProgress;

                      if (isInstructor) {
                        return (
                          <li key={lesson.id}>
                            <Link
                              to={`/instructor/${course.id}/lessons/${lesson.id}`}
                              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                            >
                              <Pencil className="size-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1">{lesson.title}</span>
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
                            </Link>
                          </li>
                        );
                      }

                      return (
                        <li key={lesson.id}>
                          {enrolled ? (
                            <Link
                              to={`/courses/${course.slug}/lessons/${lesson.id}`}
                              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                              ) : isLessonInProgress ? (
                                <PlayCircle className="size-4 shrink-0 text-blue-500" />
                              ) : (
                                <Circle className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="flex-1">{lesson.title}</span>
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
                              {bookmarkedLessonIds.has(lesson.id) && (
                                <Bookmark className="size-4 shrink-0 fill-amber-500 text-amber-500" />
                              )}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-3 py-2 text-sm">
                              <Circle className="size-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1">{lesson.title}</span>
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
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this course.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
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
