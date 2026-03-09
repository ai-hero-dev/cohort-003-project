/**
 * Shared leveling utility for the XP system.
 * Used on both server (calculations) and client (progress bar rendering).
 *
 * Formula: XP required from level N to N+1 = round(80 * N^1.3)
 * All students start at Level 1 with 0 XP.
 */

export function xpRequiredForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.3));
}

export function getLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
} {
  let level = 1;
  let xpRemaining = totalXp;

  while (true) {
    const required = xpRequiredForLevel(level);
    if (xpRemaining < required) {
      return {
        level,
        currentLevelXp: xpRemaining,
        xpForNextLevel: required,
      };
    }
    xpRemaining -= required;
    level++;
  }
}
