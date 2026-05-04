import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import {
  getCourseAnalytics,
  parseRange,
} from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { AlertTriangle } from "lucide-react";
import {
  KpiCards,
  RevenueLineChart,
  TimeframePicker,
  formatCurrency,
} from "~/components/analytics-ui";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.analytics?.title
    ? `${loaderData.analytics.title} — Analytics`
    : "Course Analytics";
  return [{ title: `${title} — Cadence` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const courseId = Number(params.courseId);
  if (!Number.isFinite(courseId)) {
    throw data("Invalid course id.", { status: 400 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (!user) {
    throw data("User not found.", { status: 401 });
  }

  if (user.role === UserRole.Student) {
    throw data("Only instructors and admins can access analytics.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));

  const analytics = getCourseAnalytics({ courseId, range });
  if (!analytics) {
    throw data("Course not found.", { status: 404 });
  }

  if (
    user.role !== UserRole.Admin &&
    analytics.instructorId !== currentUserId
  ) {
    throw data("You do not own this course.", { status: 403 });
  }

  return { analytics };
}

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const { analytics } = loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to="/instructor/analytics" className="hover:text-foreground">
          Analytics
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{analytics.title}</span>
      </nav>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{analytics.title}</h1>
          <p className="mt-1 text-muted-foreground">
            Course-level analytics, including per-country breakdown.
          </p>
        </div>
        <TimeframePicker active={analytics.range} />
      </div>

      <KpiCards kpis={analytics.kpis} prevKpis={analytics.prevKpis} />

      <div className="mb-8">
        <RevenueLineChart chart={analytics.chart} />
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Revenue by country</h2>
        </div>
        {analytics.byCountry.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No purchases in this timeframe.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byCountry.map((row) => (
                <tr key={row.country} className="border-t">
                  <td className="px-4 py-2">{row.country}</td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
    } else if (error.status === 403) {
      title = "Access denied";
    } else if (error.status === 404) {
      title = "Course not found";
    } else {
      title = `Error ${error.status}`;
    }
    message = typeof error.data === "string" ? error.data : error.statusText;
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
