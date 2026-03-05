import {
  Link,
  data,
  isRouteErrorResponse,
  useNavigate,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getAdminAnalyticsSummary,
  getAdminRevenueTimeSeries,
  type TimePeriod,
  type RevenueDataPoint,
} from "~/services/analyticsService";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn, formatPrice } from "~/lib/utils";
import {
  DollarSign,
  Users,
  Trophy,
  PackageOpen,
  AlertTriangle,
} from "lucide-react";
import { Button } from "~/components/ui/button";

const VALID_PERIODS: TimePeriod[] = ["7d", "30d", "12m", "all"];

function formatChartRevenue(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

function formatTooltipRevenue(cents: number): string {
  return formatPrice(cents);
}

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

export function meta() {
  return [
    { title: "Admin Analytics — Cadence" },
    { name: "description", content: "Platform-wide analytics dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Sign in to view analytics.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "30d";
  const period: TimePeriod = VALID_PERIODS.includes(periodParam as TimePeriod)
    ? (periodParam as TimePeriod)
    : "30d";

  const summary = getAdminAnalyticsSummary({ period });
  const timeSeries = getAdminRevenueTimeSeries({ period });

  return { summary, timeSeries, period };
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, timeSeries, period } = loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handlePeriodChange(newPeriod: TimePeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    navigate(`?${params.toString()}`, { replace: true });
  }

  const hasData =
    summary.totalRevenue > 0 ||
    summary.totalEnrollments > 0 ||
    summary.topEarningCourse !== null;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment metrics across all courses
        </p>
      </div>

      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!hasData && (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageOpen className="mx-auto mb-3 size-10 text-muted-foreground/50" />
              <h3 className="mb-1 text-lg font-semibold">
                No analytics data yet
              </h3>
              <p className="text-sm text-muted-foreground">
                There are no purchases or enrollments for this time period.
              </p>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPrice(summary.totalRevenue)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Enrollments
                  </CardTitle>
                  <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.totalEnrollments.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Earning Course
                  </CardTitle>
                  <Trophy className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {summary.topEarningCourse ? (
                    <>
                      <div className="truncate text-2xl font-bold">
                        {formatPrice(summary.topEarningCourse.revenue)}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {summary.topEarningCourse.title}
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl font-bold">N/A</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Revenue Over Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {timeSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={formatChartRevenue}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        width={60}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatTooltipRevenue(value as number),
                          "Revenue",
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No revenue data for this period.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
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
