import { eq, and, desc } from "drizzle-orm";
import { db } from "~/db";
import { streakActivities } from "~/db/schema";

/**
 * Returns today's date as a UTC "YYYY-MM-DD" string.
 */
export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Records a streak activity for the user on the given UTC date.
 * If an entry already exists for this user+date, it's a no-op (returns null).
 */
export function recordStreakActivity(
  userId: number,
  date: string = getUtcDateString()
) {
  const existing = db
    .select()
    .from(streakActivities)
    .where(
      and(eq(streakActivities.userId, userId), eq(streakActivities.date, date))
    )
    .get();

  if (existing) {
    return null;
  }

  return db.insert(streakActivities).values({ userId, date }).returning().get();
}

/**
 * Gets all unique activity dates for a user, sorted descending (most recent first).
 */
function getActivityDates(userId: number): string[] {
  const rows = db
    .select({ date: streakActivities.date })
    .from(streakActivities)
    .where(eq(streakActivities.userId, userId))
    .orderBy(desc(streakActivities.date))
    .all();

  return rows.map((r) => r.date);
}

/**
 * Adds one day to a "YYYY-MM-DD" date string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates the current streak count.
 * A streak is consecutive UTC days ending at today or yesterday.
 */
export function getCurrentStreak(
  userId: number,
  today: string = getUtcDateString()
): number {
  const dates = getActivityDates(userId);
  if (dates.length === 0) return 0;

  const mostRecent = dates[0];

  // Streak only counts if most recent activity is today or yesterday
  if (mostRecent !== today && mostRecent !== addDays(today, -1)) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const expected = addDays(dates[i - 1], -1);
    if (dates[i] === expected) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates the longest streak ever for a user.
 */
export function getLongestStreak(userId: number): number {
  const dates = getActivityDates(userId);
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const expected = addDays(dates[i - 1], -1);
    if (dates[i] === expected) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

/**
 * Gets all streak data for a user in one call.
 */
export function getStreakData(
  userId: number,
  today: string = getUtcDateString()
) {
  return {
    currentStreak: getCurrentStreak(userId, today),
    longestStreak: getLongestStreak(userId),
  };
}
