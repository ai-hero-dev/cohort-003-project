import { Link, useFetcher, useSearchParams } from "react-router";
import { z } from "zod";
import { data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/instructor.$courseId.comments";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getCourseById } from "~/services/courseService";
import { getModerationQueueForCourse } from "~/services/commentService";
import { parseParams } from "~/lib/validation";
import { CommentStatus, UserRole } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  EyeOff,
  Flag,
  MessageSquare,
} from "lucide-react";
import { cn } from "~/lib/utils";

const paramsSchema = z.object({
  courseId: z.coerce.number().int().positive(),
});

const FILTERS = ["reported", "hidden", "all"] as const;
type Filter = (typeof FILTERS)[number];

export function meta() {
  return [{ title: "Moderate Comments — Cadence" }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { courseId } = parseParams(params, paramsSchema);

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in", { status: 401 });
  }
  const user = getUserById(currentUserId);
  if (!user) {
    throw data("Not authorized", { status: 403 });
  }

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }
  if (user.role !== UserRole.Admin && course.instructorId !== currentUserId) {
    throw data("Not authorized", { status: 403 });
  }

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("filter");
  const filter: Filter = (FILTERS as readonly string[]).includes(
    filterParam ?? ""
  )
    ? (filterParam as Filter)
    : "reported";

  const all = getModerationQueueForCourse(courseId);
  const items = all.filter((c) => {
    if (filter === "reported") return c.reportCount > 0;
    if (filter === "hidden") return c.status === CommentStatus.Hidden;
    return true;
  });

  return {
    course: { id: course.id, title: course.title, slug: course.slug },
    items,
    filter,
    counts: {
      reported: all.filter((c) => c.reportCount > 0).length,
      hidden: all.filter((c) => c.status === CommentStatus.Hidden).length,
      all: all.length,
    },
  };
}

export default function ModerationPage({ loaderData }: Route.ComponentProps) {
  const { course, items, filter, counts } = loaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          Instructor
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}`}
          className="hover:text-foreground"
        >
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Comments</span>
      </nav>

      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <MessageSquare className="size-6" />
        Moderate Comments
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {course.title}
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={filter === "reported"}
          label={`Reported (${counts.reported})`}
          onClick={() => setSearchParams({ filter: "reported" })}
        />
        <FilterChip
          active={filter === "hidden"}
          label={`Hidden (${counts.hidden})`}
          onClick={() => setSearchParams({ filter: "hidden" })}
        />
        <FilterChip
          active={filter === "all"}
          label={`All (${counts.all})`}
          onClick={() => setSearchParams({ filter: "all" })}
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No comments to show in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ModerationRow
              key={c.id}
              comment={c}
              courseSlug={course.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ModerationRow({
  comment,
  courseSlug,
}: {
  comment: {
    id: number;
    lessonId: number;
    lessonTitle: string;
    body: string;
    status: CommentStatus;
    reportCount: number;
    createdAt: string;
    authorName: string;
    deletedAt: string | null;
  };
  courseSlug: string;
}) {
  const fetcher = useFetcher({ key: `moderate-row-${comment.id}` });
  const isHidden = comment.status === CommentStatus.Hidden;

  return (
    <Card className={cn(isHidden && "bg-muted/40")}>
      <CardContent className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.authorName}
          </span>
          <span>on</span>
          <Link
            to={`/courses/${courseSlug}/lessons/${comment.lessonId}`}
            className="hover:text-foreground hover:underline"
          >
            {comment.lessonTitle}
          </Link>
          <span>·</span>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
          {comment.reportCount > 0 && (
            <span className="ml-auto flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              <Flag className="size-3" />
              {comment.reportCount}
            </span>
          )}
          {isHidden && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              Hidden
            </span>
          )}
          {comment.deletedAt && (
            <span className="rounded bg-muted px-1.5 py-0.5 italic">
              Deleted by author
            </span>
          )}
        </div>

        <p className="mb-3 whitespace-pre-wrap text-sm">{comment.body}</p>

        <fetcher.Form method="post" action="/api/lesson-comments">
          <input
            type="hidden"
            name="intent"
            value={isHidden ? "unhide" : "hide"}
          />
          <input type="hidden" name="commentId" value={comment.id} />
          <Button
            type="submit"
            size="sm"
            variant={isHidden ? "outline" : "destructive"}
            disabled={fetcher.state !== "idle"}
          >
            {isHidden ? (
              <>
                <Eye className="mr-1.5 size-3.5" />
                Unhide
              </>
            ) : (
              <>
                <EyeOff className="mr-1.5 size-3.5" />
                Hide
              </>
            )}
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Not authorized";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to moderate this course.";
    } else if (error.status === 404) {
      title = "Course not found";
      message = "That course doesn't exist or has been removed.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Link to="/instructor">
          <Button variant="outline">
            <ChevronLeft className="mr-2 size-4" />
            Back to Instructor
          </Button>
        </Link>
      </div>
    </div>
  );
}
