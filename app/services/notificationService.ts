import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "~/db";
import { notifications, NotificationType } from "~/db/schema";

// ─── Notification Service ───
// In-app notifications addressed to a single recipient user. Generic schema
// (type/title/message/linkUrl) so future event types slot in without
// migrations.
// Uses positional parameters (project convention).

export function createNotification(
  recipientUserId: number,
  type: NotificationType,
  title: string,
  message: string,
  linkUrl: string
) {
  return db
    .insert(notifications)
    .values({ recipientUserId, type, title, message, linkUrl })
    .returning()
    .get();
}

export function getNotifications(userId: number, limit: number, offset: number) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getNotificationById(notificationId: number) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .get();
}

export function getUnreadCount(userId: number): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, false)
      )
    )
    .get();
  return result?.count ?? 0;
}

export function markAsRead(notificationId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId))
    .returning()
    .get();
}

export function markAllAsRead(userId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientUserId, userId))
    .returning()
    .all();
}
