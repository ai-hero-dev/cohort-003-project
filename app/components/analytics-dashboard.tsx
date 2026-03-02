import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
  Star,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  PackageOpen,
} from "lucide-react";
import type {
  TimePeriod,
  AnalyticsSummary,
  RevenueDataPoint,
  CourseAnalytics,
} from "~/services/analyticsService";

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  timeSeries: RevenueDataPoint[];
  courseBreakdown: CourseAnalytics[];
  period: TimePeriod;
}

type SortField = keyof Pick<
  CourseAnalytics,
  | "revenue"
  | "salesCount"
  | "enrollmentCount"
  | "averageRating"
  | "ratingCount"
  | "listPrice"
  | "title"
>;
type SortDirection = "asc" | "desc";

function formatChartRevenue(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

function formatTooltipRevenue(cents: number): string {
  return formatPrice(cents);
}

export function AnalyticsDashboard({
  summary,
  timeSeries,
  courseBreakdown,
  period,
}: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handlePeriodChange(newPeriod: TimePeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    navigate(`?${params.toString()}`, { replace: true });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  const sortedCourses = [...courseBreakdown].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    // Handle null averageRating — sort nulls last
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline size-3" />
    ) : (
      <ArrowDown className="ml-1 inline size-3" />
    );
  }

  return (
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

      {/* Empty state: no courses */}
      {courseBreakdown.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageOpen className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">
              No analytics data yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Publish a course to start tracking revenue, enrollments, and
              ratings.
            </p>
          </CardContent>
        </Card>
      )}

      {courseBreakdown.length > 0 && (
        <>
          {/* Summary Cards */}
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
                  Average Rating
                </CardTitle>
                <Star className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageRating !== null
                    ? `${summary.averageRating.toFixed(1)} / 5`
                    : "N/A"}
                </div>
                {summary.ratingCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    from {summary.ratingCount}{" "}
                    {summary.ratingCount === 1 ? "rating" : "ratings"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
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

          {/* Per-Course Table */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Course Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium">
                        <button
                          onClick={() => handleSort("title")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Course
                          <SortIcon field="title" />
                        </button>
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        <button
                          onClick={() => handleSort("listPrice")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          List Price
                          <SortIcon field="listPrice" />
                        </button>
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        <button
                          onClick={() => handleSort("revenue")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Revenue
                          <SortIcon field="revenue" />
                        </button>
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        <button
                          onClick={() => handleSort("salesCount")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Sales
                          <SortIcon field="salesCount" />
                        </button>
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        <button
                          onClick={() => handleSort("enrollmentCount")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Enrollments
                          <SortIcon field="enrollmentCount" />
                        </button>
                      </th>
                      <th className="pb-3 pr-4 text-right font-medium">
                        <button
                          onClick={() => handleSort("averageRating")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Avg Rating
                          <SortIcon field="averageRating" />
                        </button>
                      </th>
                      <th className="pb-3 text-right font-medium">
                        <button
                          onClick={() => handleSort("ratingCount")}
                          className="inline-flex items-center hover:text-foreground"
                        >
                          Ratings
                          <SortIcon field="ratingCount" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCourses.map((course) => (
                      <tr
                        key={course.courseId}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {course.title}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatPrice(course.listPrice)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatPrice(course.revenue)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {course.salesCount.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {course.enrollmentCount.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {course.averageRating !== null
                            ? course.averageRating.toFixed(1)
                            : "N/A"}
                        </td>
                        <td className="py-3 text-right">
                          {course.ratingCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
