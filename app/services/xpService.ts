import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { xpEvents } from "~/db/schema";

export function awardXp(
  userId: number,
  amount: number,
  sourceType: string,
  sourceId: number
) {
  const existing = db
    .select()
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        eq(xpEvents.sourceType, sourceType),
        eq(xpEvents.sourceId, sourceId)
      )
    )
    .get();

  if (existing) {
    return null;
  }

  return db
    .insert(xpEvents)
    .values({ userId, amount, sourceType, sourceId })
    .returning()
    .get();
}

export function getTotalXp(userId: number): number {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .get();

  return result?.total ?? 0;
}

export function getXpEvents(userId: number) {
  return db.select().from(xpEvents).where(eq(xpEvents.userId, userId)).all();
}
