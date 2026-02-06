import { useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/admin.courses";
import {
  getAllCourses,
  getLessonCountForCourse,
  updateCourseStatus,
} from "~/services/courseService";
import { getEnrollmentCountForCourse } from "~/services/enrollmentService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole, CourseStatus } from "~/db/schema";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle, BookOpen, Users } from "lucide-react";
import { data, isRouteErrorResponse, Link } from "react-router";

export function meta() {
  return [
    { title: "Manage Courses — Ralph" },
    { name: "description", content: "Manage all platform courses" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to manage courses.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", {
      status: 403,
    });
  }

  const allCourses = getAllCourses();

  const coursesWithDetails = allCourses.map((course) => ({
    ...course,
    lessonCount: getLessonCountForCourse(course.id),
    enrollmentCount: getEnrollmentCountForCourse(course.id),
  }));

  return { courses: coursesWithDetails };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can manage courses.", { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-status") {
    const courseId = parseInt(formData.get("courseId") as string, 10);
    const status = formData.get("status") as CourseStatus;
    if (isNaN(courseId)) {
      return data({ error: "Invalid course ID." }, { status: 400 });
    }
    if (
      !status ||
      ![CourseStatus.Draft, CourseStatus.Published, CourseStatus.Archived].includes(status)
    ) {
      return data({ error: "Invalid status." }, { status: 400 });
    }
    updateCourseStatus(courseId, status);
    return { success: true };
  }

  throw data("Invalid action.", { status: 400 });
}

function statusBadge(status: string) {
  switch (status) {
    case CourseStatus.Published:
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Published
        </span>
      );
    case CourseStatus.Draft:
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Draft
        </span>
      );
    case CourseStatus.Archived:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
          Archived
        </span>
      );
    default:
      return null;
  }
}

function CourseRow({
  course,
}: {
  course: {
    id: number;
    title: string;
    slug: string;
    status: string;
    instructorId: number;
    createdAt: string;
    lessonCount: number;
    enrollmentCount: number;
  };
}) {
  const statusFetcher = useFetcher();

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data?.success) {
      toast.success("Course status updated.");
    }
    if (statusFetcher.state === "idle" && statusFetcher.data?.error) {
      toast.error(statusFetcher.data.error);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  function handleStatusChange(newStatus: string) {
    statusFetcher.submit(
      { intent: "update-status", courseId: String(course.id), status: newStatus },
      { method: "post" }
    );
  }

  const formattedDate = new Date(course.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <div>
          <span className="text-sm font-medium">{course.title}</span>
          <p className="text-xs text-muted-foreground">{course.slug}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <Select value={course.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CourseStatus.Draft}>Draft</SelectItem>
            <SelectItem value={CourseStatus.Published}>Published</SelectItem>
            <SelectItem value={CourseStatus.Archived}>Archived</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BookOpen className="size-3.5" />
          {course.lessonCount}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-3.5" />
          {course.enrollmentCount}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formattedDate}
      </td>
    </tr>
  );
}

function CourseRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <Skeleton className="mb-1 h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </td>
      <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
    </tr>
  );
}

export function HydrateFallback() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <Skeleton className="mb-4 h-5 w-28" />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Course</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lessons</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Students</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <CourseRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCourses({ loaderData }: Route.ComponentProps) {
  const { courses } = loaderData;

  return (
    <div className="p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Manage Courses</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Manage Courses</h1>
        <p className="mt-1 text-muted-foreground">
          View all courses and manage their status
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="size-4" />
        <span>
          {courses.length} {courses.length === 1 ? "course" : "courses"} total
        </span>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">No courses found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Lessons
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Students
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading course management.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "Only admins can access this page.";
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
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
