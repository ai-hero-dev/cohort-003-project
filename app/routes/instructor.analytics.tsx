import { useState } from "react";
import {
  Link,
  data,
  isRouteErrorResponse,
  useNavigate,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById, getUsersByRole } from "~/services/userService";
import {
  getInstructorAnalytics,
  getPlatformAnalytics,
  parseRange,
  type PerCourseRow,
} from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import {
  KpiCards,
  RevenueLineChart,
  TimeframePicker,
  formatCurrency,
} from "~/components/analytics-ui";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Revenue and student analytics" },
  ];
}

const PLATFORM_VALUE = "platform";

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
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
  const instructorIdParam = url.searchParams.get("instructorId");

  if (user.role === UserRole.Admin) {
    const instructors = getUsersByRole(UserRole.Instructor);
    const scopedInstructorId = instructorIdParam
      ? Number(instructorIdParam)
      : null;

    if (scopedInstructorId !== null && Number.isFinite(scopedInstructorId)) {
      const scopedUser = getUserById(scopedInstructorId);
      if (!scopedUser || scopedUser.role !== UserRole.Instructor) {
        throw data("Instructor not found.", { status: 404 });
      }
      const analytics = getInstructorAnalytics({
        instructorId: scopedInstructorId,
        range,
      });
      return {
        analytics,
        viewer: "admin" as const,
        instructors: instructors.map((i) => ({ id: i.id, name: i.name })),
        scope: { kind: "instructor" as const, instructorId: scopedInstructorId, name: scopedUser.name },
        hasPublishedCourses: analytics.perCourse.length > 0,
      };
    }

    const analytics = getPlatformAnalytics({ range });
    return {
      analytics,
      viewer: "admin" as const,
      instructors: instructors.map((i) => ({ id: i.id, name: i.name })),
      scope: { kind: "platform" as const },
      hasPublishedCourses: analytics.perCourse.length > 0,
    };
  }

  // Instructor
  const analytics = getInstructorAnalytics({
    instructorId: currentUserId,
    range,
  });
  return {
    analytics,
    viewer: "instructor" as const,
    instructors: [] as { id: number; name: string }[],
    scope: { kind: "instructor" as const, instructorId: currentUserId, name: user.name },
    hasPublishedCourses: analytics.perCourse.length > 0,
  };
}

type SortKey = "title" | "revenue" | "students" | "purchases" | "aov";
type SortDir = "asc" | "desc";

function sortRows(opts: {
  rows: PerCourseRow[];
  key: SortKey;
  dir: SortDir;
}): PerCourseRow[] {
  const { rows, key, dir } = opts;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number;
    const bn = bv as number;
    return dir === "asc" ? an - bn : bn - an;
  });
  return copy;
}

function SortHeader(props: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !props.active ? ArrowUpDown : props.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-4 py-2 font-medium ${props.align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={props.onClick}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {props.label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}

function InstructorPicker(props: {
  instructors: { id: number; name: string }[];
  value: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === PLATFORM_VALUE) {
      params.delete("instructorId");
    } else {
      params.set("instructorId", value);
    }
    const qs = params.toString();
    navigate(qs ? `?${qs}` : "?", { replace: true, preventScrollReset: true });
  }

  return (
    <Select value={props.value} onValueChange={handleChange}>
      <SelectTrigger className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PLATFORM_VALUE}>Platform-wide</SelectItem>
        {props.instructors.map((i) => (
          <SelectItem key={i.id} value={i.id.toString()}>
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { analytics, viewer, instructors, scope, hasPublishedCourses } = loaderData;
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();

  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  }

  const sorted = sortRows({ rows: analytics.perCourse, key: sortKey, dir: sortDir });

  const heading =
    scope.kind === "platform"
      ? "Platform Analytics"
      : viewer === "admin"
        ? `Analytics — ${scope.name}`
        : "Analytics";

  const subhead =
    scope.kind === "platform"
      ? "Combined revenue and student activity across every published course."
      : "Revenue and student activity across published courses.";

  const pickerValue =
    scope.kind === "platform"
      ? PLATFORM_VALUE
      : scope.instructorId.toString();

  // Empty state: instructor (not admin) with no published courses.
  const showEmptyState =
    viewer === "instructor" && !hasPublishedCourses;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        {viewer === "instructor" ? (
          <>
            <Link to="/instructor" className="hover:text-foreground">
              My Courses
            </Link>
            <span className="mx-2">/</span>
          </>
        ) : null}
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{heading}</h1>
          <p className="mt-1 text-muted-foreground">{subhead}</p>
        </div>
        <div className="flex items-center gap-3">
          {viewer === "admin" ? (
            <InstructorPicker instructors={instructors} value={pickerValue} />
          ) : null}
          <TimeframePicker active={analytics.range} />
        </div>
      </div>

      {showEmptyState ? (
        <div className="rounded-lg border bg-muted/30 p-12 text-center">
          <h2 className="text-lg font-semibold">No analytics yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Publish a course to start seeing revenue and student data here.
          </p>
          <Link to="/instructor/new" className="mt-4 inline-block">
            <Button>
              <Plus className="mr-2 size-4" />
              Create your first course
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <KpiCards kpis={analytics.kpis} prevKpis={analytics.prevKpis} />

          <div className="mb-8">
            <RevenueLineChart chart={analytics.chart} />
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Per-course breakdown</h2>
            </div>
            {sorted.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No published courses in this scope.
              </div>
            ) : (
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <tr>
                      <SortHeader
                        label="Course"
                        active={sortKey === "title"}
                        dir={sortDir}
                        onClick={() => toggleSort("title")}
                      />
                      <SortHeader
                        label="Revenue"
                        align="right"
                        active={sortKey === "revenue"}
                        dir={sortDir}
                        onClick={() => toggleSort("revenue")}
                      />
                      <SortHeader
                        label="Students"
                        align="right"
                        active={sortKey === "students"}
                        dir={sortDir}
                        onClick={() => toggleSort("students")}
                      />
                      <SortHeader
                        label="Purchases"
                        align="right"
                        active={sortKey === "purchases"}
                        dir={sortDir}
                        onClick={() => toggleSort("purchases")}
                      />
                      <SortHeader
                        label="AOV"
                        align="right"
                        active={sortKey === "aov"}
                        dir={sortDir}
                        onClick={() => toggleSort("aov")}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.courseId} className="border-t">
                        <td className="px-4 py-2">
                          <Link
                            to={`/instructor/${row.courseId}/analytics${queryString ? `?${queryString}` : ""}`}
                            className="text-primary hover:underline"
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="px-4 py-2 text-right">{row.students}</td>
                        <td className="px-4 py-2 text-right">{row.purchases}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(row.aov)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
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
          : "Please select a user from the DevUI panel.";
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
      </div>
    </div>
  );
}
