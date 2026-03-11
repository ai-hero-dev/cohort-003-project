import { Link, useFetcher, redirect, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import type { Route } from "./+types/courses.$slug.purchase";
import {
  getCourseBySlug,
  getCourseWithDetails,
  getLessonCountForCourse,
} from "~/services/courseService";
import {
  isUserEnrolled,
  enrollUser,
  getEnrollmentCountForCourse,
} from "~/services/enrollmentService";
import { getCurrentUserId } from "~/lib/session";
import { CourseStatus } from "~/db/schema";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContentNoShift,
} from "~/components/ui/tabs";
import { BookOpen, Clock, Users, ArrowLeft, Minus, Plus } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { data } from "react-router";
import { formatDuration, formatPrice } from "~/lib/utils";
import { resolveCountry } from "~/lib/country.server";
import { calculatePppPrice, getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { createPurchase, createTeamPurchase } from "~/services/purchaseService";
import { parseFormData, parseParams } from "~/lib/validation";

const purchaseParamsSchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1)),
});

const purchaseActionSchema = v.variant("intent", [
  v.object({ intent: v.literal("confirm-purchase") }),
  v.object({
    intent: v.literal("confirm-team-purchase"),
    quantity: v.pipe(
      v.unknown(),
      v.transform(Number),
      v.integer(),
      v.minValue(1)
    ),
  }),
]);

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Purchase";
  return [
    { title: `Confirm Purchase: ${title} — Cadence` },
    { name: "description", content: `Confirm your enrollment in ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.status !== CourseStatus.Published) {
    throw data("Course not found.", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw redirect(
      `/signup?redirectTo=${encodeURIComponent(`/courses/${slug}/purchase`)}`
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  const enrolled = isUserEnrolled(currentUserId, course.id);

  if (enrolled && mode !== "team") {
    throw redirect(`/courses/${slug}?already_enrolled=1`);
  }

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(course.id);
  const enrollmentCount = getEnrollmentCountForCourse(course.id);

  const totalDuration = courseWithDetails.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  const country = await resolveCountry(request);
  const pppPrice = courseWithDetails.pppEnabled
    ? calculatePppPrice(courseWithDetails.price, country)
    : courseWithDetails.price;
  const tierInfo = getCountryTierInfo(country);
  const countryName = country
    ? (COUNTRIES.find((c) => c.code === country)?.name ?? country)
    : null;

  return {
    course: courseWithDetails,
    lessonCount,
    enrollmentCount,
    totalDuration,
    pppPrice,
    tierInfo,
    country,
    countryName,
    isEnrolled: enrolled,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { slug } = parseParams(params, purchaseParamsSchema);
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, purchaseActionSchema);

  if (!parsed.success) {
    throw data("Invalid action.", { status: 400 });
  }

  const country = await resolveCountry(request);
  const pppPrice = course.pppEnabled
    ? calculatePppPrice(course.price, country)
    : course.price;

  if (parsed.data.intent === "confirm-purchase") {
    if (isUserEnrolled(currentUserId, course.id)) {
      throw redirect(`/courses/${slug}`);
    }
    createPurchase(currentUserId, course.id, pppPrice, country);
    enrollUser(currentUserId, course.id, false, false);
    throw redirect(`/courses/${slug}/welcome`);
  }

  // Team purchase — user does NOT get enrolled themselves
  const { quantity } = parsed.data;
  const totalPrice = pppPrice * quantity;
  createTeamPurchase(currentUserId, course.id, totalPrice, country, quantity);
  throw redirect(`/team`);
}

export default function PurchaseConfirmation({
  loaderData,
}: Route.ComponentProps) {
  const {
    course,
    lessonCount,
    enrollmentCount,
    totalDuration,
    pppPrice,
    tierInfo,
    countryName,
    isEnrolled,
  } = loaderData;
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [searchParams] = useSearchParams();
  const defaultMode =
    isEnrolled || searchParams.get("mode") === "team" ? "team" : "self";
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  const isDiscounted = pppPrice < course.price;
  const teamTotal = pppPrice * quantity;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      {/* Back link */}
      <Link
        to={`/courses/${course.slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to course
      </Link>

      <h1 className="mb-2 text-2xl font-bold">Confirm Your Purchase</h1>
      <p className="mb-8 text-muted-foreground">
        Review the details below before enrolling.
      </p>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover image */}
            <div className="w-full shrink-0 overflow-hidden rounded-lg sm:w-48">
              <CourseImage
                src={course.coverImageUrl}
                alt={course.title}
                className="aspect-video h-full w-full object-cover sm:aspect-auto"
              />
            </div>

            {/* Course info */}
            <div className="flex-1">
              <h2 className="mb-1 text-xl font-semibold">{course.title}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {course.description}
              </p>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserAvatar
                  name={course.instructorName}
                  avatarUrl={course.instructorAvatarUrl}
                  className="size-6"
                />
                <span>Taught by {course.instructorName}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-6 border-t pt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <BookOpen className="size-4" />
              {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4" />
              {formatDuration(totalDuration, true, false, false)} total
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              {enrollmentCount} {enrollmentCount === 1 ? "student" : "students"}{" "}
              enrolled
            </span>
          </div>

          {/* Purchase tabs */}
          <div className="mt-6 border-t pt-6">
            {isDiscounted && countryName && (
              <div className="mb-4 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <p className="text-sm text-green-800 dark:text-green-300">
                  PPP discount applied for {countryName} — {tierInfo.label}
                </p>
              </div>
            )}

            <Tabs defaultValue={defaultMode}>
              {!isEnrolled && (
                <TabsList className="mb-6 w-full">
                  <TabsTrigger value="self" className="flex-1">
                    Buy for Myself
                  </TabsTrigger>
                  <TabsTrigger value="team" className="flex-1">
                    Buy for Your Team
                  </TabsTrigger>
                </TabsList>
              )}

              <TabsContentNoShift>
                {/* Buy for Myself */}
                {!isEnrolled && (
                  <TabsContent value="self" forceMount>
                    <div className="flex items-center justify-between">
                      <div>
                        {isDiscounted ? (
                          <>
                            <span className="text-sm text-muted-foreground">
                              Original price
                            </span>
                            <div className="text-lg text-muted-foreground line-through">
                              {formatPrice(course.price)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Your price
                            </span>
                            <div className="text-3xl font-bold">
                              {formatPrice(pppPrice)}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-muted-foreground">
                              Total
                            </span>
                            <div className="text-3xl font-bold">
                              {formatPrice(pppPrice)}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Link to={`/courses/${course.slug}`}>
                          <Button variant="outline">Go Back</Button>
                        </Link>
                        <fetcher.Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="confirm-purchase"
                          />
                          <Button size="lg" disabled={isSubmitting}>
                            {isSubmitting
                              ? "Processing..."
                              : "Confirm Purchase"}
                          </Button>
                        </fetcher.Form>
                      </div>
                    </div>
                  </TabsContent>
                )}

                {/* Buy for Your Team */}
                <TabsContent value="team" forceMount>
                  <div className="space-y-6">
                    {/* Quantity selector */}
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Seats</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-10 text-center text-lg font-semibold">
                          {quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => setQuantity((q) => q + 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(pppPrice)} &times; {quantity}{" "}
                        {quantity === 1 ? "seat" : "seats"}
                      </div>
                      <div className="text-3xl font-bold">
                        {formatPrice(teamTotal)}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      You&apos;ll receive {quantity} unique coupon{" "}
                      {quantity === 1 ? "link" : "links"} to share with your
                      team members. Each link grants one person access to this
                      course.
                    </p>

                    <div className="flex items-center gap-3">
                      <Link to={`/courses/${course.slug}`}>
                        <Button variant="outline">Go Back</Button>
                      </Link>
                      <fetcher.Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="confirm-team-purchase"
                        />
                        <input type="hidden" name="quantity" value={quantity} />
                        <Button size="lg" disabled={isSubmitting}>
                          {isSubmitting
                            ? "Processing..."
                            : `Buy ${quantity} ${quantity === 1 ? "Seat" : "Seats"}`}
                        </Button>
                      </fetcher.Form>
                    </div>
                  </div>
                </TabsContent>
              </TabsContentNoShift>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
