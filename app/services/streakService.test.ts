import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  recordStreakActivity,
  getCurrentStreak,
  getLongestStreak,
  getStreakData,
  getUtcDateString,
} from "./streakService";

describe("streakService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getUtcDateString", () => {
    it("formats a date as YYYY-MM-DD", () => {
      const date = new Date("2026-03-09T15:30:00Z");
      expect(getUtcDateString(date)).toBe("2026-03-09");
    });
  });

  describe("recordStreakActivity", () => {
    it("records a streak activity for a user", () => {
      const result = recordStreakActivity(base.user.id, "2026-03-09");
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(base.user.id);
      expect(result!.date).toBe("2026-03-09");
    });

    it("prevents duplicate entries for same user+date", () => {
      recordStreakActivity(base.user.id, "2026-03-09");
      const duplicate = recordStreakActivity(base.user.id, "2026-03-09");
      expect(duplicate).toBeNull();
    });

    it("allows same date for different users", () => {
      const r1 = recordStreakActivity(base.user.id, "2026-03-09");
      const r2 = recordStreakActivity(base.instructor.id, "2026-03-09");
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
    });

    it("allows different dates for the same user", () => {
      const r1 = recordStreakActivity(base.user.id, "2026-03-09");
      const r2 = recordStreakActivity(base.user.id, "2026-03-10");
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
    });
  });

  describe("getCurrentStreak", () => {
    it("returns 0 for a user with no activity", () => {
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(0);
    });

    it("returns 1 when only today has activity", () => {
      recordStreakActivity(base.user.id, "2026-03-09");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(1);
    });

    it("returns 1 when only yesterday has activity", () => {
      recordStreakActivity(base.user.id, "2026-03-08");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(1);
    });

    it("counts consecutive days ending today", () => {
      recordStreakActivity(base.user.id, "2026-03-07");
      recordStreakActivity(base.user.id, "2026-03-08");
      recordStreakActivity(base.user.id, "2026-03-09");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(3);
    });

    it("counts consecutive days ending yesterday", () => {
      recordStreakActivity(base.user.id, "2026-03-07");
      recordStreakActivity(base.user.id, "2026-03-08");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(2);
    });

    it("resets when a day is missed", () => {
      recordStreakActivity(base.user.id, "2026-03-06");
      // gap on 2026-03-07
      recordStreakActivity(base.user.id, "2026-03-08");
      recordStreakActivity(base.user.id, "2026-03-09");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(2);
    });

    it("returns 0 when last activity was two or more days ago", () => {
      recordStreakActivity(base.user.id, "2026-03-06");
      expect(getCurrentStreak(base.user.id, "2026-03-09")).toBe(0);
    });
  });

  describe("getLongestStreak", () => {
    it("returns 0 for a user with no activity", () => {
      expect(getLongestStreak(base.user.id)).toBe(0);
    });

    it("returns 1 for a single activity", () => {
      recordStreakActivity(base.user.id, "2026-03-09");
      expect(getLongestStreak(base.user.id)).toBe(1);
    });

    it("finds the longest consecutive run", () => {
      // First streak: 3 days
      recordStreakActivity(base.user.id, "2026-03-01");
      recordStreakActivity(base.user.id, "2026-03-02");
      recordStreakActivity(base.user.id, "2026-03-03");
      // gap
      // Second streak: 2 days
      recordStreakActivity(base.user.id, "2026-03-08");
      recordStreakActivity(base.user.id, "2026-03-09");

      expect(getLongestStreak(base.user.id)).toBe(3);
    });

    it("preserves longest streak after reset", () => {
      // Build a 5-day streak
      recordStreakActivity(base.user.id, "2026-02-01");
      recordStreakActivity(base.user.id, "2026-02-02");
      recordStreakActivity(base.user.id, "2026-02-03");
      recordStreakActivity(base.user.id, "2026-02-04");
      recordStreakActivity(base.user.id, "2026-02-05");
      // gap, then a shorter streak
      recordStreakActivity(base.user.id, "2026-03-09");

      expect(getLongestStreak(base.user.id)).toBe(5);
    });
  });

  describe("getStreakData", () => {
    it("returns both current and longest streak", () => {
      // Old 3-day streak
      recordStreakActivity(base.user.id, "2026-03-01");
      recordStreakActivity(base.user.id, "2026-03-02");
      recordStreakActivity(base.user.id, "2026-03-03");
      // Current 2-day streak
      recordStreakActivity(base.user.id, "2026-03-08");
      recordStreakActivity(base.user.id, "2026-03-09");

      const data = getStreakData(base.user.id, "2026-03-09");
      expect(data.currentStreak).toBe(2);
      expect(data.longestStreak).toBe(3);
    });

    it("returns zeros for inactive user", () => {
      const data = getStreakData(base.user.id, "2026-03-09");
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(0);
    });
  });
});
