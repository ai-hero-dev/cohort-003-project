import { Link, useSearchParams } from "react-router";
import type { ChartBucket, Kpis, Range } from "~/services/analyticsService";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pctChange(opts: { current: number; previous: number }): number | null {
  // Per PRD: zero-purchase windows render no % change. We treat both
  // current=0 and previous=0 as "no comparison" rather than emitting
  // -100% / +Infinity / NaN.
  if (opts.previous === 0 || opts.current === 0) return null;
  return ((opts.current - opts.previous) / opts.previous) * 100;
}

export function KpiCard(props: {
  label: string;
  value: string;
  current: number;
  previous: number;
}) {
  const pct = pctChange({ current: props.current, previous: props.previous });
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">{props.label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{props.value}</p>
        {pct === null ? (
          <p className="mt-1 text-xs text-muted-foreground">—</p>
        ) : (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              pct >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1)}% vs previous period
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCards(props: { kpis: Kpis; prevKpis: Kpis }) {
  const { kpis, prevKpis } = props;
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Revenue"
        value={formatCurrency(kpis.revenue)}
        current={kpis.revenue}
        previous={prevKpis.revenue}
      />
      <KpiCard
        label="Students"
        value={kpis.students.toString()}
        current={kpis.students}
        previous={prevKpis.students}
      />
      <KpiCard
        label="Purchases"
        value={kpis.purchases.toString()}
        current={kpis.purchases}
        previous={prevKpis.purchases}
      />
      <KpiCard
        label="Avg. order value"
        value={formatCurrency(kpis.aov)}
        current={kpis.aov}
        previous={prevKpis.aov}
      />
    </div>
  );
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "1w", label: "1 week" },
  { value: "1m", label: "1 month" },
  { value: "6m", label: "6 months" },
  { value: "all", label: "All time" },
];

export function TimeframePicker(props: { active: Range }) {
  const [searchParams] = useSearchParams();

  function buildHref(value: Range): string {
    const params = new URLSearchParams(searchParams);
    params.set("range", value);
    return `?${params.toString()}`;
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {RANGE_OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          to={buildHref(opt.value)}
          replace
          preventScrollReset
          className={cn(
            "px-3 py-1 text-sm rounded-md transition-colors",
            props.active === opt.value
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const frac = value / exp;
  let nice: number;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * exp;
}

function pickXTickIndices(count: number, max = 6): number[] {
  if (count === 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const ticks = new Set<number>();
  const step = (count - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    ticks.add(Math.round(i * step));
  }
  return Array.from(ticks).sort((a, b) => a - b);
}

export function RevenueLineChart(props: { chart: ChartBucket[] }) {
  const rawMax = props.chart.reduce((m, b) => Math.max(m, b.revenue), 0);
  const yMax = niceCeil(rawMax);
  const yTickFractions = [0, 0.25, 0.5, 0.75, 1];
  const xTickIndices = new Set(pickXTickIndices(props.chart.length));

  // SVG layout, in viewBox units.
  const W = 800;
  const H = 240;
  const PAD_L = 70;
  const PAD_R = 12;
  const PAD_T = 8;
  const PAD_B = 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = props.chart.length;
  const slotW = n > 0 ? plotW / n : 0;

  function pointX(i: number): number {
    // Place each bucket point at the centre of its slot so labels align.
    return PAD_L + i * slotW + slotW / 2;
  }

  function pointY(revenue: number): number {
    if (yMax === 0) return PAD_T + plotH;
    return PAD_T + plotH - (revenue / yMax) * plotH;
  }

  const linePath = props.chart
    .map((b, i) => `${i === 0 ? "M" : "L"} ${pointX(i)} ${pointY(b.revenue)}`)
    .join(" ");

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-4 font-semibold">Revenue over time</h2>
      {rawMax === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No revenue in this timeframe.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ maxHeight: 260 }}
        >
          {/* Gridlines + Y-axis labels */}
          {yTickFractions.map((f) => {
            const y = PAD_T + plotH * (1 - f);
            const value = yMax * f;
            return (
              <g key={f}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={f === 0 ? 0.4 : 0.15}
                  strokeDasharray={f === 0 ? undefined : "3 3"}
                  className="text-muted-foreground"
                />
                <text
                  x={PAD_L - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground"
                  fontSize="11"
                >
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          {/* Y-axis line */}
          <line
            x1={PAD_L}
            x2={PAD_L}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="currentColor"
            strokeOpacity={0.4}
            className="text-muted-foreground"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary"
          />

          {/* Points */}
          {props.chart.map((bucket, i) => (
            <circle
              key={bucket.startIso}
              cx={pointX(i)}
              cy={pointY(bucket.revenue)}
              r={3}
              className="fill-primary"
            >
              <title>{`${bucket.label}: ${formatCurrency(bucket.revenue)}`}</title>
            </circle>
          ))}

          {/* X-axis tick labels */}
          {props.chart.map((bucket, i) => {
            if (!xTickIndices.has(i)) return null;
            return (
              <text
                key={bucket.startIso}
                x={pointX(i)}
                y={PAD_T + plotH + 16}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="11"
              >
                {bucket.label}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
