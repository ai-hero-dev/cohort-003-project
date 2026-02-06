import { useState, useRef, useEffect } from "react";
import { Link, useFetcher, useBlocker } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/instructor.$courseId.lessons.$lessonId";
import { getCourseById } from "~/services/courseService";
import { getLessonById, updateLesson } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import { getQuizByLessonId } from "~/services/quizService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RichTextEditor } from "~/components/rich-text-editor";
import { AlertTriangle, ArrowLeft, ClipboardList, Save } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson?.title ?? "Edit Lesson";
  return [
    { title: `Edit: ${title} — Ralph` },
    { name: "description", content: `Edit lesson: ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to manage lessons.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId) {
    throw data("You can only edit your own courses.", { status: 403 });
  }

  const lessonId = parseInt(params.lessonId, 10);
  if (isNaN(lessonId)) {
    throw data("Invalid lesson ID.", { status: 400 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    throw data("Lesson not found.", { status: 404 });
  }

  const mod = getModuleById(lesson.moduleId);
  if (!mod || mod.courseId !== courseId) {
    throw data("Lesson not found in this course.", { status: 404 });
  }

  const quiz = getQuizByLessonId(lessonId);

  return { course, lesson, module: mod, quiz };
}

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can edit lessons.", { status: 403 });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId) {
    throw data("You can only edit your own courses.", { status: 403 });
  }

  const lessonId = parseInt(params.lessonId, 10);
  if (isNaN(lessonId)) {
    throw data("Invalid lesson ID.", { status: 400 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    throw data("Lesson not found.", { status: 404 });
  }

  const mod = getModuleById(lesson.moduleId);
  if (!mod || mod.courseId !== courseId) {
    throw data("Lesson not found in this course.", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-lesson") {
    const content = formData.get("content") as string | null;
    const videoUrl = (formData.get("videoUrl") as string)?.trim() || null;
    const durationStr = formData.get("durationMinutes") as string;
    const durationMinutes = durationStr ? parseInt(durationStr, 10) : null;

    if (durationMinutes !== null && (isNaN(durationMinutes) || durationMinutes < 0)) {
      return data({ error: "Duration must be a positive number." }, { status: 400 });
    }

    updateLesson(lessonId, null, content ?? null, videoUrl, durationMinutes);
    return { success: true };
  }

  throw data("Invalid action.", { status: 400 });
}

export default function InstructorLessonEditor({
  loaderData,
}: Route.ComponentProps) {
  const { course, lesson, module: mod, quiz } = loaderData;
  const fetcher = useFetcher();

  const [content, setContent] = useState(lesson.contentHtml ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    lesson.durationMinutes?.toString() ?? ""
  );

  const hasChanges =
    content !== (lesson.contentHtml ?? "") ||
    videoUrl !== (lesson.videoUrl ?? "") ||
    durationMinutes !== (lesson.durationMinutes?.toString() ?? "");

  const blocker = useBlocker(hasChanges);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Lesson saved.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSave() {
    fetcher.submit(
      {
        intent: "update-lesson",
        content,
        videoUrl,
        durationMinutes,
      },
      { method: "post" }
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Unsaved changes blocker dialog */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <h2 className="text-lg font-semibold">Unsaved Changes</h2>
              <p className="text-sm text-muted-foreground">
                You have unsaved changes that will be lost if you leave this
                page.
              </p>
            </CardHeader>
            <CardContent className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => blocker.reset()}>
                Stay on Page
              </Button>
              <Button
                variant="destructive"
                onClick={() => blocker.proceed()}
              >
                Leave Page
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}`}
          className="hover:text-foreground"
        >
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{lesson.title}</span>
      </nav>

      <Link
        to={`/instructor/${course.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Course Editor
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Module: {mod.title}
        </p>
      </div>

      <div className="space-y-6">
        {/* Content */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Lesson Content</h2>
            <p className="text-sm text-muted-foreground">
              Use the toolbar to format text, add headings, lists, code blocks,
              images, and links.
            </p>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing your lesson content..."
            />
          </CardContent>
        </Card>

        {/* Video URL */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Video</h2>
            <p className="text-sm text-muted-foreground">
              Paste a YouTube video URL to embed in this lesson.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="videoUrl">YouTube URL</Label>
              <Input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Duration */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Duration</h2>
            <p className="text-sm text-muted-foreground">
              Set the estimated time to complete this lesson.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 15"
                className="max-w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quiz */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Quiz</h2>
            <p className="text-sm text-muted-foreground">
              {quiz
                ? `This lesson has a quiz: "${quiz.title}"`
                : "No quiz attached to this lesson yet."}
            </p>
          </CardHeader>
          <CardContent>
            <Link
              to={`/instructor/${course.id}/lessons/${lesson.id}/quiz`}
            >
              <Button variant="outline">
                <ClipboardList className="mr-1.5 size-4" />
                {quiz ? "Edit Quiz" : "Create Quiz"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || fetcher.state !== "idle"}
          >
            <Save className="mr-1.5 size-4" />
            {fetcher.state !== "idle" ? "Saving..." : "Save Changes"}
          </Button>
          {hasChanges && (
            <span className="text-sm text-muted-foreground">
              You have unsaved changes.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the lesson editor.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Lesson not found";
      message = "The lesson you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to edit this lesson.";
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
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
