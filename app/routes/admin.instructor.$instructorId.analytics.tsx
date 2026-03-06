import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.instructor.$instructorId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getAnalyticsSummary,
  getRevenueTimeSeries,
  getPerCourseBreakdown,
  type TimePeriod,
} from "~/services/analyticsService";
import { AnalyticsDashboard } from "~/components/analytics-dashboard";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

const VALID_PERIODS: TimePeriod[] = ["7d", "30d", "12m", "all"];

export function meta() {
  return [
    { title: "Instructor Analytics — Cadence" },
    { name: "description", content: "View instructor course analytics" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Sign in to view analytics.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const instructorId = Number(params.instructorId);

  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    throw data("Invalid instructor ID.", { status: 400 });
  }

  const instructor = getUserById(instructorId);

  if (!instructor) {
    throw data("Instructor not found.", { status: 404 });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "12m";
  const period: TimePeriod = VALID_PERIODS.includes(periodParam as TimePeriod)
    ? (periodParam as TimePeriod)
    : "12m";

  const summary = getAnalyticsSummary({ instructorId, period });
  const timeSeries = getRevenueTimeSeries({ instructorId, period });
  const courseBreakdown = getPerCourseBreakdown({ instructorId, period });

  return {
    summary,
    timeSeries,
    courseBreakdown,
    period,
    instructorName: instructor.name,
  };
}

export default function AdminInstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { summary, timeSeries, courseBreakdown, period, instructorName } =
    loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/admin/users" className="hover:text-foreground">
          Manage Users
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{instructorName} — Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{instructorName} — Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue, enrollments, and ratings for this instructor
        </p>
      </div>

      <AnalyticsDashboard
        summary={summary}
        timeSeries={timeSeries}
        courseBreakdown={courseBreakdown}
        period={period}
      />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please sign in to view analytics.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to access this page.";
    } else if (error.status === 404) {
      title = "Not found";
      message =
        typeof error.data === "string"
          ? error.data
          : "The requested instructor was not found.";
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
          <Link to="/admin/users">
            <Button variant="outline">Manage Users</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
