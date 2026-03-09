import { describe, it, expect } from "vitest";
import { xpRequiredForLevel, getLevelFromXp } from "./leveling";

describe("leveling", () => {
  describe("xpRequiredForLevel", () => {
    it("requires 80 XP for level 1 → 2", () => {
      expect(xpRequiredForLevel(1)).toBe(80);
    });

    it("requires ~197 XP for level 2 → 3", () => {
      expect(xpRequiredForLevel(2)).toBe(Math.round(80 * Math.pow(2, 1.3)));
    });

    it("increases with higher levels", () => {
      const level5 = xpRequiredForLevel(5);
      const level10 = xpRequiredForLevel(10);
      expect(level10).toBeGreaterThan(level5);
    });
  });

  describe("getLevelFromXp", () => {
    it("returns level 1 with 0 XP", () => {
      const result = getLevelFromXp(0);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
      expect(result.xpForNextLevel).toBe(80);
    });

    it("returns level 1 with 79 XP", () => {
      const result = getLevelFromXp(79);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(79);
    });

    it("returns level 2 with exactly 80 XP", () => {
      const result = getLevelFromXp(80);
      expect(result.level).toBe(2);
      expect(result.currentLevelXp).toBe(0);
    });

    it("returns level 2 with 100 XP", () => {
      const result = getLevelFromXp(100);
      expect(result.level).toBe(2);
      expect(result.currentLevelXp).toBe(20);
    });

    it("handles large XP values", () => {
      const result = getLevelFromXp(10000);
      expect(result.level).toBeGreaterThan(5);
    });

    it("progress within level is correct", () => {
      const result = getLevelFromXp(40);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(40);
      expect(result.xpForNextLevel).toBe(80);
    });
  });
});
