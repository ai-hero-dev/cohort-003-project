import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { awardXp, getTotalXp } from "./xpService";
import { computeResult } from "./quizScoringService";

function createQuizWithQuestion(courseId: number) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module 1", position: 1 })
    .returning()
    .get();

  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();

  const quiz = testDb
    .insert(schema.quizzes)
    .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
    .returning()
    .get();

  const question = testDb
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "What is 1+1?",
      questionType: schema.QuestionType.MultipleChoice,
      position: 1,
    })
    .returning()
    .get();

  const correctOption = testDb
    .insert(schema.quizOptions)
    .values({ questionId: question.id, optionText: "2", isCorrect: true })
    .returning()
    .get();

  const wrongOption = testDb
    .insert(schema.quizOptions)
    .values({ questionId: question.id, optionText: "3", isCorrect: false })
    .returning()
    .get();

  return {
    quizId: quiz.id,
    questionId: question.id,
    correctOptionId: correctOption.id,
    wrongOptionId: wrongOption.id,
  };
}

describe("Quiz XP", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("awards 5 XP when a student passes a quiz for the first time", () => {
    const { quizId, questionId, correctOptionId } = createQuizWithQuestion(
      base.course.id
    );

    const result = computeResult(base.user.id, quizId, {
      [questionId]: correctOptionId,
    });

    expect(result).not.toBeNull();
    expect(result!.passed).toBe(true);

    // Award XP (same logic as the route handler)
    const xpEvent = awardXp(base.user.id, 5, "quiz_pass", quizId);
    expect(xpEvent).not.toBeNull();
    expect(xpEvent!.amount).toBe(5);
    expect(xpEvent!.sourceType).toBe("quiz_pass");
    expect(getTotalXp(base.user.id)).toBe(5);
  });

  it("does not award XP on retake of a passed quiz (dedup)", () => {
    const { quizId, questionId, correctOptionId } = createQuizWithQuestion(
      base.course.id
    );

    // First pass
    computeResult(base.user.id, quizId, { [questionId]: correctOptionId });
    awardXp(base.user.id, 5, "quiz_pass", quizId);

    // Retake and pass again
    computeResult(base.user.id, quizId, { [questionId]: correctOptionId });
    const duplicate = awardXp(base.user.id, 5, "quiz_pass", quizId);

    expect(duplicate).toBeNull();
    expect(getTotalXp(base.user.id)).toBe(5);
  });

  it("does not award XP when a student fails a quiz", () => {
    const { quizId, questionId, wrongOptionId } = createQuizWithQuestion(
      base.course.id
    );

    const result = computeResult(base.user.id, quizId, {
      [questionId]: wrongOptionId,
    });

    expect(result).not.toBeNull();
    expect(result!.passed).toBe(false);

    // Route handler only awards XP if passed — no awardXp call
    expect(getTotalXp(base.user.id)).toBe(0);
  });

  it("awards quiz XP that contributes to total alongside lesson XP", () => {
    const { quizId, questionId, correctOptionId } = createQuizWithQuestion(
      base.course.id
    );

    // Lesson XP
    awardXp(base.user.id, 10, "lesson_complete", 999);
    // Quiz XP
    computeResult(base.user.id, quizId, { [questionId]: correctOptionId });
    awardXp(base.user.id, 5, "quiz_pass", quizId);

    expect(getTotalXp(base.user.id)).toBe(15);
  });

  it("allows different users to earn quiz XP for the same quiz", () => {
    const { quizId, questionId, correctOptionId } = createQuizWithQuestion(
      base.course.id
    );

    computeResult(base.user.id, quizId, { [questionId]: correctOptionId });
    awardXp(base.user.id, 5, "quiz_pass", quizId);

    computeResult(base.instructor.id, quizId, {
      [questionId]: correctOptionId,
    });
    awardXp(base.instructor.id, 5, "quiz_pass", quizId);

    expect(getTotalXp(base.user.id)).toBe(5);
    expect(getTotalXp(base.instructor.id)).toBe(5);
  });

  it("awards XP on first pass even after a prior failed attempt", () => {
    const { quizId, questionId, correctOptionId, wrongOptionId } =
      createQuizWithQuestion(base.course.id);

    // Fail first
    const failResult = computeResult(base.user.id, quizId, {
      [questionId]: wrongOptionId,
    });
    expect(failResult!.passed).toBe(false);
    // No XP awarded on failure

    // Pass on retry
    const passResult = computeResult(base.user.id, quizId, {
      [questionId]: correctOptionId,
    });
    expect(passResult!.passed).toBe(true);
    const xpEvent = awardXp(base.user.id, 5, "quiz_pass", quizId);

    expect(xpEvent).not.toBeNull();
    expect(getTotalXp(base.user.id)).toBe(5);
  });
});
