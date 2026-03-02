import { useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn, formatPrice } from "~/lib/utils";
import { DollarSign, Users, Star } from "lucide-react";
import type { TimePeriod, AnalyticsSummary } from "~/services/analyticsService";

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  period: TimePeriod;
}

export function AnalyticsDashboard({
  summary,
  period,
}: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handlePeriodChange(newPeriod: TimePeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    navigate(`?${params.toString()}`, { replace: true });
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
    </div>
  );
}
