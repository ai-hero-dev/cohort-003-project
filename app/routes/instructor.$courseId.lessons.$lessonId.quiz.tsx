import { useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/instructor.$courseId.lessons.$lessonId.quiz";
import { getCourseById } from "~/services/courseService";
import { getLessonById } from "~/services/lessonService";
import { getModuleById } from "~/services/moduleService";
import {
  getQuizByLessonId,
  getQuizWithQuestions,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  createOption,
  deleteQuestion,
} from "~/services/quizService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole, QuestionType } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  GripVertical,
  Plus,
  Save,
  Trash2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";
import { parseFormData, parseParams } from "~/lib/validation";

const quizParamsSchema = v.object({
  courseId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  lessonId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
});

const wizardDataSchema = v.object({
  title: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Quiz title is required.")
  ),
  passingScore: v.number(),
  questions: v.pipe(
    v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        type: v.enum(QuestionType),
        options: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            isCorrect: v.boolean(),
          })
        ),
      })
    ),
    v.minLength(1, "At least one question is required.")
  ),
});

const quizActionSchema = v.variant("intent", [
  v.object({
    intent: v.literal("save-quiz"),
    wizardData: v.string(),
  }),
  v.object({
    intent: v.literal("delete-quiz"),
  }),
]);

// ─── Types for wizard state ───

interface WizardOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface WizardQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: WizardOption[];
}

interface WizardState {
  title: string;
  passingScore: number;
  questions: WizardQuestion[];
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Meta ───

export function meta({ data: loaderData }: Route.MetaArgs) {
  const lessonTitle = loaderData?.lesson?.title ?? "Lesson";
  const hasQuiz = !!loaderData?.existingQuiz;
  return [
    {
      title: `${hasQuiz ? "Edit" : "Create"} Quiz: ${lessonTitle} — Cadence`,
    },
  ];
}

// ─── Loader ───

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
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

  const course = getCourseById(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
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

  // Load existing quiz if present
  const existingQuizBasic = getQuizByLessonId(lessonId);
  const existingQuiz = existingQuizBasic
    ? getQuizWithQuestions(existingQuizBasic.id)
    : null;

  return { course, lesson, module: mod, existingQuiz };
}

// ─── Action ───

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
    throw data("Only instructors and admins can manage quizzes.", {
      status: 403,
    });
  }

  const { courseId, lessonId } = parseParams(params, quizParamsSchema);

  const course = getCourseById(courseId);
  if (
    !course ||
    (course.instructorId !== currentUserId && user.role !== UserRole.Admin)
  ) {
    throw data("Course not found or not yours.", { status: 403 });
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
  const parsed = parseFormData(formData, quizActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "save-quiz") {
    let wizardData: v.InferOutput<typeof wizardDataSchema>;
    try {
      const raw = JSON.parse(parsed.data.wizardData);
      const wizardResult = v.safeParse(wizardDataSchema, raw);
      if (!wizardResult.success) {
        return data({ error: "Invalid quiz data." }, { status: 400 });
      }
      wizardData = wizardResult.output;
    } catch {
      return data({ error: "Invalid quiz data." }, { status: 400 });
    }

    // Delete existing quiz if present
    const existingQuiz = getQuizByLessonId(lessonId);
    if (existingQuiz) {
      deleteQuiz(existingQuiz.id);
    }

    // Create the quiz
    const quiz = createQuiz(
      lessonId,
      wizardData.title.trim(),
      wizardData.passingScore / 100
    );

    // Create questions and options
    for (let qi = 0; qi < wizardData.questions.length; qi++) {
      const q = wizardData.questions[qi];
      const question = createQuestion(quiz.id, q.text.trim(), q.type, qi + 1);

      for (const opt of q.options) {
        createOption(question.id, opt.text.trim(), opt.isCorrect);
      }
    }

    return { success: true };
  }

  if (intent === "delete-quiz") {
    const existingQuiz = getQuizByLessonId(lessonId);
    if (existingQuiz) {
      deleteQuiz(existingQuiz.id);
    }
    return { success: true, deleted: true };
  }

  throw data("Invalid action.", { status: 400 });
}

// ─── Step Indicators ───

const STEPS = [
  { label: "Settings", number: 1 },
  { label: "Questions", number: 2 },
  { label: "Answers", number: 3 },
  { label: "Review", number: 4 },
];

function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <button
            type="button"
            onClick={() => onStepClick(step.number)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              step.number === currentStep
                ? "bg-primary text-primary-foreground"
                : step.number < currentStep
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step.number < currentStep ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Circle className="size-4" />
            )}
            {step.label}
          </button>
          {i < STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ─── Component ───

export default function QuizBuilderWizard({
  loaderData,
}: Route.ComponentProps) {
  const { course, lesson, module: mod, existingQuiz } = loaderData;
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Initialize wizard state from existing quiz or defaults
  const [wizard, setWizard] = useState<WizardState>(() => {
    if (existingQuiz) {
      return {
        title: existingQuiz.title,
        passingScore: Math.round(existingQuiz.passingScore * 100),
        questions: existingQuiz.questions.map((q) => ({
          id: generateId(),
          text: q.questionText,
          type: q.questionType as QuestionType,
          options: q.options.map((o) => ({
            id: generateId(),
            text: o.optionText,
            isCorrect: o.isCorrect,
          })),
        })),
      };
    }
    return {
      title: "",
      passingScore: 70,
      questions: [],
    };
  });

  const isEditing = !!existingQuiz;

  // Toast on success
  const fetcherData = fetcher.data as
    | { success?: boolean; deleted?: boolean; error?: string }
    | undefined;

  if (fetcher.state === "idle" && fetcherData?.success) {
    if (fetcherData.deleted) {
      toast.success("Quiz deleted.");
      navigate(`/instructor/${course.id}/lessons/${lesson.id}`);
    } else {
      toast.success("Quiz saved.");
      navigate(`/instructor/${course.id}/lessons/${lesson.id}`);
    }
  }

  // ─── Step 1: Settings ───
  function renderStep1() {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Quiz Settings</h2>
          <p className="text-sm text-muted-foreground">
            Set the quiz title and passing score.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quizTitle">Quiz Title</Label>
            <Input
              id="quizTitle"
              value={wizard.title}
              onChange={(e) =>
                setWizard((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g. Module 1 Quiz"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passingScore">Passing Score (%)</Label>
            <Input
              id="passingScore"
              type="number"
              min={0}
              max={100}
              value={wizard.passingScore}
              onChange={(e) =>
                setWizard((prev) => ({
                  ...prev,
                  passingScore: parseInt(e.target.value, 10) || 0,
                }))
              }
              className="max-w-32"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Step 2: Questions ───
  function addQuestion() {
    setWizard((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: generateId(),
          text: "",
          type: QuestionType.MultipleChoice,
          options: [
            { id: generateId(), text: "", isCorrect: true },
            { id: generateId(), text: "", isCorrect: false },
          ],
        },
      ],
    }));
  }

  function removeQuestion(questionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }));
  }

  function updateQuestion(
    questionId: string,
    updates: Partial<WizardQuestion>
  ) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        const updated = { ...q, ...updates };
        // When switching to TrueFalse, reset options to True/False
        if (
          updates.type === QuestionType.TrueFalse &&
          q.type !== QuestionType.TrueFalse
        ) {
          updated.options = [
            { id: generateId(), text: "True", isCorrect: true },
            { id: generateId(), text: "False", isCorrect: false },
          ];
        }
        // When switching to MultipleChoice from TrueFalse, add blank options
        if (
          updates.type === QuestionType.MultipleChoice &&
          q.type !== QuestionType.MultipleChoice
        ) {
          updated.options = [
            { id: generateId(), text: "", isCorrect: true },
            { id: generateId(), text: "", isCorrect: false },
          ];
        }
        return updated;
      }),
    }));
  }

  function handleQuestionDragEnd(result: DropResult) {
    if (!result.destination) return;
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;
    if (fromIndex === toIndex) return;

    setWizard((prev) => {
      const reordered = [...prev.questions];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return { ...prev, questions: reordered };
    });
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="text-sm text-muted-foreground">
              Add questions to your quiz. Drag to reorder. You&apos;ll set
              answer options in the next step.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {wizard.questions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No questions added yet. Click &quot;Add Question&quot; to get
                started.
              </p>
            )}

            <DragDropContext onDragEnd={handleQuestionDragEnd}>
              <Droppable droppableId="quiz-questions" type="question">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-4"
                  >
                    {wizard.questions.map((q, idx) => (
                      <Draggable key={q.id} draggableId={q.id} index={idx}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`flex items-start gap-3 rounded-lg border p-4 ${
                              snapshot.isDragging
                                ? "bg-muted shadow-lg ring-2 ring-primary/20"
                                : ""
                            }`}
                          >
                            <div
                              {...dragProvided.dragHandleProps}
                              className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
                            >
                              <GripVertical className="size-4" />
                            </div>
                            <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-3">
                              <Input
                                value={q.text}
                                onChange={(e) =>
                                  updateQuestion(q.id, {
                                    text: e.target.value,
                                  })
                                }
                                placeholder="Enter question text..."
                              />
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">
                                  Type:
                                </Label>
                                <Select
                                  value={q.type}
                                  onValueChange={(val) =>
                                    updateQuestion(q.id, {
                                      type: val as QuestionType,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-48">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value={QuestionType.MultipleChoice}
                                    >
                                      Multiple Choice
                                    </SelectItem>
                                    <SelectItem value={QuestionType.TrueFalse}>
                                      True / False
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(q.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-1.5 size-4" />
              Add Question
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step 3: Answers ───
  function addOption(questionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [
                ...q.options,
                { id: generateId(), text: "", isCorrect: false },
              ],
            }
          : q
      ),
    }));
  }

  function removeOption(questionId: string, optionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q
      ),
    }));
  }

  function updateOption(
    questionId: string,
    optionId: string,
    updates: Partial<WizardOption>
  ) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          options: q.options.map((o) => {
            if (o.id !== optionId) return o;
            return { ...o, ...updates };
          }),
        };
      }),
    }));
  }

  function setCorrectOption(questionId: string, optionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          options: q.options.map((o) => ({
            ...o,
            isCorrect: o.id === optionId,
          })),
        };
      }),
    }));
  }

  function renderStep3() {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Answer Options</h2>
            <p className="text-sm text-muted-foreground">
              Set answer options for each question and mark the correct answer.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {wizard.questions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Go back and add questions first.
              </p>
            )}

            {wizard.questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="font-medium">
                    {q.text || "(No question text)"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {q.type === QuestionType.TrueFalse
                      ? "True/False"
                      : "Multiple Choice"}
                  </span>
                </div>

                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOption(q.id, opt.id)}
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          opt.isCorrect
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-muted-foreground/30 hover:border-green-500/50"
                        }`}
                      >
                        {opt.isCorrect && <Check className="size-3" />}
                      </button>
                      {q.type === QuestionType.TrueFalse ? (
                        <span className="text-sm">{opt.text}</span>
                      ) : (
                        <Input
                          value={opt.text}
                          onChange={(e) =>
                            updateOption(q.id, opt.id, {
                              text: e.target.value,
                            })
                          }
                          placeholder="Enter option text..."
                          className="flex-1"
                        />
                      )}
                      {q.type === QuestionType.MultipleChoice &&
                        q.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(q.id, opt.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                    </div>
                  ))}
                </div>

                {q.type === QuestionType.MultipleChoice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addOption(q.id)}
                    className="mt-2"
                  >
                    <Plus className="mr-1 size-3" />
                    Add Option
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step 4: Review ───
  function renderStep4() {
    const validationErrors: string[] = [];
    if (!wizard.title.trim()) validationErrors.push("Quiz title is required.");
    if (wizard.questions.length === 0)
      validationErrors.push("At least one question is required.");
    for (const q of wizard.questions) {
      if (!q.text.trim())
        validationErrors.push(
          `Question ${wizard.questions.indexOf(q) + 1} has no text.`
        );
      if (q.options.length < 2)
        validationErrors.push(
          `Question ${wizard.questions.indexOf(q) + 1} needs at least 2 options.`
        );
      if (!q.options.some((o) => o.isCorrect))
        validationErrors.push(
          `Question ${wizard.questions.indexOf(q) + 1} has no correct answer.`
        );
      for (const opt of q.options) {
        if (!opt.text.trim())
          validationErrors.push(
            `Question ${wizard.questions.indexOf(q) + 1} has an empty option.`
          );
      }
    }

    const isValid = validationErrors.length === 0;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Review Quiz</h2>
            <p className="text-sm text-muted-foreground">
              Review your quiz before saving.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quiz summary */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Title:</span>{" "}
                  {wizard.title || "(empty)"}
                </div>
                <div>
                  <span className="font-medium">Passing Score:</span>{" "}
                  {wizard.passingScore}%
                </div>
                <div>
                  <span className="font-medium">Questions:</span>{" "}
                  {wizard.questions.length}
                </div>
              </div>
            </div>

            {/* Questions review */}
            {wizard.questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="font-medium">
                    {q.text || "(No question text)"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {q.type === QuestionType.TrueFalse
                      ? "True/False"
                      : "Multiple Choice"}
                  </span>
                </div>
                <div className="ml-8 space-y-1">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      {opt.isCorrect ? (
                        <CheckCircle2 className="size-4 text-green-500" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground/40" />
                      )}
                      <span
                        className={
                          opt.isCorrect ? "font-medium text-green-700" : ""
                        }
                      >
                        {opt.text || "(empty)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="mb-2 text-sm font-medium text-destructive">
                  Please fix these issues before saving:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Button
                disabled={!isValid || fetcher.state !== "idle"}
                onClick={() => {
                  fetcher.submit(
                    {
                      intent: "save-quiz",
                      wizardData: JSON.stringify(wizard),
                    },
                    { method: "post" }
                  );
                }}
              >
                <Save className="mr-1.5 size-4" />
                {fetcher.state !== "idle"
                  ? "Saving..."
                  : isEditing
                    ? "Update Quiz"
                    : "Create Quiz"}
              </Button>

              {fetcherData?.error && (
                <span className="text-sm text-destructive">
                  {fetcherData.error}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Navigation ───
  function canGoNext() {
    if (step === 1) return wizard.title.trim().length > 0;
    if (step === 2) return wizard.questions.length > 0;
    if (step === 3) return true;
    return false;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/instructor/${course.id}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}/lessons/${lesson.id}`}
          className="hover:text-foreground"
        >
          {lesson.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">
          {isEditing ? "Edit Quiz" : "Create Quiz"}
        </span>
      </nav>

      <Link
        to={`/instructor/${course.id}/lessons/${lesson.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Lesson Editor
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Quiz" : "Create Quiz"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lesson: {lesson.title}
          </p>
        </div>
        {isEditing && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to delete this quiz? All student attempts will be lost."
                )
              ) {
                fetcher.submit({ intent: "delete-quiz" }, { method: "post" });
              }
            }}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete Quiz
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} onStepClick={setStep} />

      {/* Step content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}

      {/* Step navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Previous
        </Button>
        {step < 4 && (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
            Next
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the quiz builder.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Not found";
      message = "The quiz, lesson, or course you're looking for doesn't exist.";
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
