import { useState, useRef, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Route } from "./+types/instructor.$courseId";
import {
  getCourseById,
  getCourseWithDetails,
  updateCourse,
  updateCourseStatus,
  updateCourseSalesCopy,
  updateCoursePrice,
  updateCoursePppEnabled,
  getLessonCountForCourse,
} from "~/services/courseService";
import {
  createModule,
  updateModuleTitle,
  deleteModule,
  getModuleById,
  reorderModules,
} from "~/services/moduleService";
import {
  createLesson,
  updateLessonTitle,
  deleteLesson,
  getLessonById,
  reorderLessons,
  moveLessonToModule,
} from "~/services/lessonService";
import {
  getEnrollmentCountForCourse,
  getCourseEnrolledStudents,
} from "~/services/enrollmentService";
import { calculateProgress } from "~/services/progressService";
import { getQuizByLessonId, getBestAttempt } from "~/services/quizService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { CourseStatus, UserRole } from "~/db/schema";
import { formatDuration, formatPrice } from "~/lib/utils";
import { MonacoMarkdownEditor } from "~/components/monaco-markdown-editor";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  FileEdit,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
  AlertTriangle,
  Award,
  Globe,
  FileText,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";
import { parseFormData, parseParams } from "~/lib/validation";

const courseEditorParamsSchema = v.object({
  courseId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
});

const courseEditorActionSchema = v.variant("intent", [
  v.object({
    intent: v.literal("update-title"),
    title: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Title cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("update-description"),
    description: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Description cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("update-status"),
    status: v.enum(CourseStatus),
  }),
  v.object({ intent: v.literal("update-price"), price: v.string() }),
  v.object({ intent: v.literal("update-ppp-enabled"), pppEnabled: v.string() }),
  v.object({
    intent: v.literal("add-module"),
    title: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Module title cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("rename-module"),
    moduleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    title: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Module title cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("delete-module"),
    moduleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  }),
  v.object({
    intent: v.literal("add-lesson"),
    moduleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    title: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Lesson title cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("rename-lesson"),
    lessonId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    title: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Lesson title cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("reorder-modules"),
    moduleIds: v.pipe(v.string(), v.minLength(1, "Missing module IDs.")),
  }),
  v.object({
    intent: v.literal("reorder-lessons"),
    moduleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    lessonIds: v.pipe(v.string(), v.minLength(1, "Missing lesson IDs.")),
  }),
  v.object({
    intent: v.literal("move-lesson"),
    lessonId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    targetModuleId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    targetPosition: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  }),
  v.object({
    intent: v.literal("delete-lesson"),
    lessonId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  }),
  v.object({
    intent: v.literal("update-sales-copy"),
    salesCopy: v.optional(v.string()),
  }),
]);

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Edit Course";
  return [
    { title: `Edit: ${title} — Cadence` },
    { name: "description", content: `Edit course: ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to manage courses.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseWithDetails(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only edit your own courses.", { status: 403 });
  }

  const lessonCount = getLessonCountForCourse(courseId);
  const enrollmentCount = getEnrollmentCountForCourse(courseId);

  // Student roster data
  const enrolledStudents = getCourseEnrolledStudents(courseId);

  // Gather all lessons from the course modules and find which have quizzes
  const allCourseLessons = course.modules.flatMap((mod) => mod.lessons);
  const lessonQuizzes: {
    lessonId: number;
    lessonTitle: string;
    quizId: number;
    quizTitle: string;
  }[] = [];
  for (const lesson of allCourseLessons) {
    const quiz = getQuizByLessonId(lesson.id);
    if (quiz) {
      lessonQuizzes.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        quizId: quiz.id,
        quizTitle: quiz.title,
      });
    }
  }

  const students = enrolledStudents.map((enrollment) => {
    const studentUser = getUserById(enrollment.userId);
    const progress = calculateProgress(
      enrollment.userId,
      courseId,
      false,
      false
    );

    const quizScores = lessonQuizzes.map((lq) => {
      const bestAttempt = getBestAttempt(enrollment.userId, lq.quizId);
      return {
        quizId: lq.quizId,
        quizTitle: lq.quizTitle,
        lessonTitle: lq.lessonTitle,
        bestScore: bestAttempt?.score ?? null,
        passed: bestAttempt?.passed ?? null,
      };
    });

    return {
      userId: enrollment.userId,
      name: studentUser?.name ?? "Unknown",
      email: studentUser?.email ?? "",
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progress,
      quizScores,
    };
  });

  const quizCount = lessonQuizzes.length;

  return { course, lessonCount, enrollmentCount, students, quizCount };
}

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can edit courses.", {
      status: 403,
    });
  }

  const { courseId } = parseParams(params, courseEditorParamsSchema);

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only edit your own courses.", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, courseEditorActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "update-title") {
    updateCourse(courseId, parsed.data.title, course.description);
    return { success: true, field: "title" };
  }

  if (intent === "update-description") {
    updateCourse(courseId, course.title, parsed.data.description);
    return { success: true, field: "description" };
  }

  if (intent === "update-status") {
    updateCourseStatus(courseId, parsed.data.status);
    return { success: true, field: "status" };
  }

  if (intent === "update-price") {
    const priceDollars = parseFloat(parsed.data.price);
    if (isNaN(priceDollars) || priceDollars < 0) {
      return data(
        { error: "Price must be a non-negative number." },
        { status: 400 }
      );
    }
    if (priceDollars > 9999.99) {
      return data({ error: "Price cannot exceed $9,999.99." }, { status: 400 });
    }
    const priceCents = Math.round(priceDollars * 100);
    updateCoursePrice(courseId, priceCents);
    return { success: true, field: "price" };
  }

  if (intent === "update-ppp-enabled") {
    const pppEnabled = parsed.data.pppEnabled === "true";
    updateCoursePppEnabled(courseId, pppEnabled);
    return { success: true, field: "ppp-enabled" };
  }

  if (intent === "add-module") {
    createModule(courseId, parsed.data.title, null);
    return { success: true, field: "module" };
  }

  if (intent === "rename-module") {
    const { moduleId, title } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    updateModuleTitle(moduleId, title);
    return { success: true, field: "module" };
  }

  if (intent === "delete-module") {
    const { moduleId } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    deleteModule(moduleId);
    return { success: true, field: "module" };
  }

  if (intent === "add-lesson") {
    const { moduleId, title } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    createLesson(moduleId, title, null, null, null, null);
    return { success: true, field: "lesson" };
  }

  if (intent === "rename-lesson") {
    const { lessonId, title } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    updateLessonTitle(lessonId, title);
    return { success: true, field: "lesson" };
  }

  if (intent === "reorder-modules") {
    const moduleIds: number[] = JSON.parse(parsed.data.moduleIds);
    reorderModules(courseId, moduleIds);
    return { success: true, field: "module-reorder" };
  }

  if (intent === "reorder-lessons") {
    const { moduleId, lessonIds: lessonIdsJson } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    const lessonIds: number[] = JSON.parse(lessonIdsJson);
    reorderLessons(moduleId, lessonIds);
    return { success: true, field: "lesson-reorder" };
  }

  if (intent === "move-lesson") {
    const { lessonId, targetModuleId, targetPosition } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const sourceMod = getModuleById(lesson.moduleId);
    if (!sourceMod || sourceMod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    const targetMod = getModuleById(targetModuleId);
    if (!targetMod || targetMod.courseId !== courseId) {
      return data(
        { error: "Target module not found in this course." },
        { status: 404 }
      );
    }
    moveLessonToModule(lessonId, targetModuleId, targetPosition);
    return { success: true, field: "lesson-move" };
  }

  if (intent === "delete-lesson") {
    const { lessonId } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    deleteLesson(lessonId);
    return { success: true, field: "lesson" };
  }

  if (intent === "update-sales-copy") {
    updateCourseSalesCopy(courseId, parsed.data.salesCopy || null);
    return { success: true, field: "sales-copy" };
  }

  throw data("Invalid action.", { status: 400 });
}

function InlineEditableTitle({
  value,
  courseId,
}: {
  value: string;
  courseId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Title saved.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  // Update local state when server responds with new data
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "update-title", title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-3xl font-bold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left hover:bg-muted"
    >
      <h1 className="flex-1 text-3xl font-bold">{value}</h1>
      <Pencil className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function InlineEditableDescription({
  value,
  courseId,
}: {
  value: string;
  courseId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Description saved.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "update-description", description: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <div>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={3}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Press Ctrl+Enter to save, Escape to cancel
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left hover:bg-muted"
    >
      <p className="flex-1 text-sm text-muted-foreground">{value}</p>
      <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function InlineEditableModuleTitle({
  value,
  moduleId,
}: {
  value: string;
  moduleId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "rename-module", moduleId: String(moduleId), title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-base font-semibold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
    >
      <h3 className="font-semibold">{value}</h3>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function DeleteModuleButton({
  moduleId,
  moduleTitle,
}: {
  moduleId: number;
  moduleTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Module deleted.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">
          Delete "{moduleTitle}"?
        </span>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            fetcher.submit(
              { intent: "delete-module", moduleId: String(moduleId) },
              { method: "post" }
            );
            setConfirming(false);
          }}
        >
          Confirm
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function AddModuleForm() {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Reset form after successful submission
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setTitle("");
      setIsAdding(false);
      toast.success("Module added.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    fetcher.submit(
      { intent: "add-module", title: trimmed },
      { method: "post" }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setTitle("");
      setIsAdding(false);
    }
  }

  if (!isAdding) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="mt-4"
      >
        <Plus className="mr-1.5 size-4" />
        Add Module
      </Button>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Module title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="max-w-xs"
      />
      <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTitle("");
          setIsAdding(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

function InlineEditableLessonTitle({
  value,
  lessonId,
}: {
  value: string;
  lessonId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "rename-lesson", lessonId: String(lessonId), title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex-1">{value}</span>
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function DeleteLessonButton({
  lessonId,
  lessonTitle,
}: {
  lessonId: number;
  lessonTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Lesson deleted.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">Delete?</span>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 text-xs"
          onClick={() => {
            fetcher.submit(
              { intent: "delete-lesson", lessonId: String(lessonId) },
              { method: "post" }
            );
            setConfirming(false);
          }}
        >
          Confirm
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function AddLessonForm({ moduleId }: { moduleId: number }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setTitle("");
      setIsAdding(false);
      toast.success("Lesson added.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    fetcher.submit(
      { intent: "add-lesson", moduleId: String(moduleId), title: trimmed },
      { method: "post" }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setTitle("");
      setIsAdding(false);
    }
  }

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="mt-2 text-muted-foreground"
      >
        <Plus className="mr-1 size-3.5" />
        Add Lesson
      </Button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Lesson title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="max-w-xs text-sm"
      />
      <Button
        size="sm"
        className="h-8"
        onClick={handleSubmit}
        disabled={!title.trim()}
      >
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => {
          setTitle("");
          setIsAdding(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

function statusBadgeColor(status: string) {
  switch (status) {
    case CourseStatus.Published:
      return "text-green-800 dark:text-green-400";
    case CourseStatus.Draft:
      return "text-yellow-800 dark:text-yellow-400";
    case CourseStatus.Archived:
      return "text-gray-800 dark:text-gray-400";
    default:
      return "";
  }
}

export default function InstructorCourseEditor({
  loaderData,
}: Route.ComponentProps) {
  const { course, lessonCount, enrollmentCount, students, quizCount } =
    loaderData;
  const statusFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const lessonReorderFetcher = useFetcher();
  const salesCopyFetcher = useFetcher();
  const priceFetcher = useFetcher();
  const pppFetcher = useFetcher();

  const [salesCopy, setSalesCopy] = useState(course.salesCopy ?? "");
  const salesCopyHasChanges = salesCopy !== (course.salesCopy ?? "");

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data?.success) {
      toast.success("Course status updated.");
    }
    if (statusFetcher.state === "idle" && statusFetcher.data?.error) {
      toast.error(statusFetcher.data.error);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  useEffect(() => {
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.success) {
      toast.success("Modules reordered.");
    }
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.error) {
      toast.error(reorderFetcher.data.error);
    }
  }, [reorderFetcher.state, reorderFetcher.data]);

  useEffect(() => {
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.success
    ) {
      toast.success("Lessons reordered.");
    }
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.error
    ) {
      toast.error(lessonReorderFetcher.data.error);
    }
  }, [lessonReorderFetcher.state, lessonReorderFetcher.data]);

  useEffect(() => {
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.success) {
      toast.success("Sales copy saved.");
    }
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.error) {
      toast.error(salesCopyFetcher.data.error);
    }
  }, [salesCopyFetcher.state, salesCopyFetcher.data]);

  useEffect(() => {
    if (priceFetcher.state === "idle" && priceFetcher.data?.success) {
      toast.success("Price updated.");
    }
    if (priceFetcher.state === "idle" && priceFetcher.data?.error) {
      toast.error(priceFetcher.data.error);
    }
  }, [priceFetcher.state, priceFetcher.data]);

  useEffect(() => {
    if (pppFetcher.state === "idle" && pppFetcher.data?.success) {
      toast.success("PPP setting updated.");
    }
    if (pppFetcher.state === "idle" && pppFetcher.data?.error) {
      toast.error(pppFetcher.data.error);
    }
  }, [pppFetcher.state, pppFetcher.data]);

  function handleSalesCopySave() {
    salesCopyFetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  function handleStatusChange(newStatus: string) {
    statusFetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (
      result.source.droppableId === result.destination.droppableId &&
      result.source.index === result.destination.index
    ) {
      return;
    }

    if (result.type === "module") {
      const reordered = Array.from(course.modules);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      const moduleIds = reordered.map((m) => m.id);
      reorderFetcher.submit(
        { intent: "reorder-modules", moduleIds: JSON.stringify(moduleIds) },
        { method: "post" }
      );
    } else if (result.type === "lesson") {
      const sourceModuleId = parseInt(
        result.source.droppableId.replace("lessons-", ""),
        10
      );
      const destModuleId = parseInt(
        result.destination.droppableId.replace("lessons-", ""),
        10
      );

      if (sourceModuleId === destModuleId) {
        // Reorder within the same module
        const mod = course.modules.find((m) => m.id === sourceModuleId);
        if (!mod) return;

        const reordered = Array.from(mod.lessons);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        const lessonIds = reordered.map((l) => l.id);
        lessonReorderFetcher.submit(
          {
            intent: "reorder-lessons",
            moduleId: String(sourceModuleId),
            lessonIds: JSON.stringify(lessonIds),
          },
          { method: "post" }
        );
      } else {
        // Move lesson to a different module
        const sourceMod = course.modules.find((m) => m.id === sourceModuleId);
        if (!sourceMod) return;

        const lesson = sourceMod.lessons[result.source.index];
        if (!lesson) return;

        // Target position is 1-based (destination index + 1)
        const targetPosition = result.destination.index + 1;

        lessonReorderFetcher.submit(
          {
            intent: "move-lesson",
            lessonId: String(lesson.id),
            targetModuleId: String(destModuleId),
            targetPosition: String(targetPosition),
          },
          { method: "post" }
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      <Link
        to="/instructor"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to My Courses
      </Link>

      {/* Course Header with inline editing */}
      <div className="mb-8">
        <InlineEditableTitle value={course.title} courseId={course.id} />
        <div className="mt-2">
          <InlineEditableDescription
            value={course.description}
            courseId={course.id}
          />
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 px-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" />
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {enrollmentCount} {enrollmentCount === 1 ? "student" : "students"}
          </span>
          <span className="text-xs text-muted-foreground">
            Slug: /courses/{course.slug}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">
            <BookOpen className="size-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="sales-copy">
            <FileText className="size-4" />
            Sales Copy
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="size-4" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          {course.modules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No modules yet. Add your first module to start building
                  content.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="modules" type="module">
                {(provided) => (
                  <div
                    className="space-y-4"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {course.modules.map((mod, index) => (
                      <Draggable
                        key={mod.id}
                        draggableId={String(mod.id)}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                          >
                            <Card
                              className={
                                snapshot.isDragging
                                  ? "shadow-lg ring-2 ring-primary/50"
                                  : ""
                              }
                            >
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    >
                                      <GripVertical className="size-5" />
                                    </div>
                                    <div className="flex-1">
                                      <InlineEditableModuleTitle
                                        value={mod.title}
                                        moduleId={mod.id}
                                      />
                                      <p className="mt-1 px-2 text-sm text-muted-foreground">
                                        {mod.lessons.length}{" "}
                                        {mod.lessons.length === 1
                                          ? "lesson"
                                          : "lessons"}
                                      </p>
                                    </div>
                                  </div>
                                  <DeleteModuleButton
                                    moduleId={mod.id}
                                    moduleTitle={mod.title}
                                  />
                                </div>
                              </CardHeader>
                              <CardContent>
                                {mod.lessons.length === 0 ? (
                                  <p className="px-3 py-2 text-sm text-muted-foreground">
                                    No lessons yet.
                                  </p>
                                ) : (
                                  <Droppable
                                    droppableId={`lessons-${mod.id}`}
                                    type="lesson"
                                  >
                                    {(lessonDropProvided) => (
                                      <ul
                                        className="space-y-1"
                                        ref={lessonDropProvided.innerRef}
                                        {...lessonDropProvided.droppableProps}
                                      >
                                        {mod.lessons.map(
                                          (lesson, lessonIndex) => (
                                            <Draggable
                                              key={lesson.id}
                                              draggableId={`lesson-${lesson.id}`}
                                              index={lessonIndex}
                                            >
                                              {(
                                                lessonProvided,
                                                lessonSnapshot
                                              ) => (
                                                <li
                                                  ref={lessonProvided.innerRef}
                                                  {...lessonProvided.draggableProps}
                                                >
                                                  <div
                                                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm${
                                                      lessonSnapshot.isDragging
                                                        ? " bg-muted shadow-md ring-1 ring-primary/30"
                                                        : ""
                                                    }`}
                                                  >
                                                    <div
                                                      {...lessonProvided.dragHandleProps}
                                                      className="cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    >
                                                      <GripVertical className="size-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                      <InlineEditableLessonTitle
                                                        value={lesson.title}
                                                        lessonId={lesson.id}
                                                      />
                                                    </div>
                                                    {lesson.durationMinutes && (
                                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Clock className="size-3" />
                                                        {formatDuration(
                                                          lesson.durationMinutes,
                                                          true,
                                                          false,
                                                          false
                                                        )}
                                                      </span>
                                                    )}
                                                    <Link
                                                      to={`/courses/${course.slug}/lessons/${lesson.id}`}
                                                      title="View lesson"
                                                    >
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                      >
                                                        <Eye className="size-3.5" />
                                                      </Button>
                                                    </Link>
                                                    <Link
                                                      to={`/instructor/${course.id}/lessons/${lesson.id}`}
                                                      title="Edit lesson"
                                                    >
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                      >
                                                        <FileEdit className="size-3.5" />
                                                      </Button>
                                                    </Link>
                                                    <DeleteLessonButton
                                                      lessonId={lesson.id}
                                                      lessonTitle={lesson.title}
                                                    />
                                                  </div>
                                                </li>
                                              )}
                                            </Draggable>
                                          )
                                        )}
                                        {lessonDropProvided.placeholder}
                                      </ul>
                                    )}
                                  </Droppable>
                                )}
                                <AddLessonForm moduleId={mod.id} />
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
          <AddModuleForm />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Course Status</h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Select
                    value={course.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CourseStatus.Draft}>Draft</SelectItem>
                      <SelectItem value={CourseStatus.Published}>
                        Published
                      </SelectItem>
                      <SelectItem value={CourseStatus.Archived}>
                        Archived
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Pricing</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Price:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        max="9999.99"
                        step="0.01"
                        defaultValue={(course.price / 100).toFixed(2)}
                        className="w-28"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (
                            !isNaN(val) &&
                            val >= 0 &&
                            Math.round(val * 100) !== course.price
                          ) {
                            priceFetcher.submit(
                              { intent: "update-price", price: e.target.value },
                              { method: "post" }
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    title="Purchasing Power Parity: applies location-based discounts for students in lower-income countries"
                  >
                    <Globe className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">PPP:</span>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        course.pppEnabled ? "bg-primary" : "bg-muted"
                      }`}
                      onClick={() => {
                        pppFetcher.submit(
                          {
                            intent: "update-ppp-enabled",
                            pppEnabled: String(!course.pppEnabled),
                          },
                          { method: "post" }
                        );
                      }}
                    >
                      <span
                        className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                          course.pppEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {course.pppEnabled ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Links</h2>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/courses/${course.slug}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="mr-1.5 size-4" />
                      View Public Page
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Copy Tab */}
        <TabsContent value="sales-copy" className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Sales Copy</h2>
              <p className="text-sm text-muted-foreground">
                Write the course sales copy in Markdown. This is shown on the
                public course page. Press Ctrl+S to format and save.
              </p>
            </CardHeader>
            <CardContent>
              <MonacoMarkdownEditor
                value={salesCopy}
                onChange={setSalesCopy}
                onSave={handleSalesCopySave}
              />
              <div className="mt-4 flex items-center gap-4">
                <Button
                  onClick={handleSalesCopySave}
                  disabled={
                    !salesCopyHasChanges || salesCopyFetcher.state !== "idle"
                  }
                >
                  <Save className="mr-1.5 size-4" />
                  {salesCopyFetcher.state !== "idle"
                    ? "Saving..."
                    : "Save Sales Copy"}
                </Button>
                {salesCopyHasChanges && (
                  <span className="text-sm text-muted-foreground">
                    You have unsaved changes.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              {students.length} {students.length === 1 ? "student" : "students"}{" "}
              enrolled
            </span>
            {quizCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Award className="size-4" />
                {quizCount} {quizCount === 1 ? "quiz" : "quizzes"}
              </span>
            )}
          </div>

          {students.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No students enrolled in this course yet.
                </p>
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
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Enrolled
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Progress
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        {quizCount > 0 && (
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Quiz Scores
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const enrolledDate = new Date(
                          student.enrolledAt
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <tr
                            key={student.userId}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {student.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {student.email}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {enrolledDate}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted">
                                  <div
                                    className="h-2 rounded-full bg-primary transition-all"
                                    style={{ width: `${student.progress}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">
                                  {student.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {student.completedAt ? (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  Completed
                                </span>
                              ) : student.progress > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  In Progress
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                                  Not Started
                                </span>
                              )}
                            </td>
                            {quizCount > 0 && (
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {student.quizScores.map((qs) => (
                                    <div
                                      key={qs.quizId}
                                      className="flex items-center gap-1"
                                      title={`${qs.quizTitle} (${qs.lessonTitle})`}
                                    >
                                      {qs.bestScore === null ? (
                                        <span className="text-xs text-muted-foreground">
                                          —
                                        </span>
                                      ) : qs.passed ? (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                          {Math.round(qs.bestScore * 100)}%
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                          {Math.round(qs.bestScore * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the course editor.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
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
          : "You don't have permission to edit this course.";
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
