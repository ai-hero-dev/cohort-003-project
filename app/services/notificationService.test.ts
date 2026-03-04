import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { NotificationType } from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const notification = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "New Enrollment",
        "Test User enrolled in Test Course",
        `/instructor/${base.course.id}/students`
      );

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe(
        `/instructor/${base.course.id}/students`
      );
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered newest first", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "First notification",
        "/instructor/1/students"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "Second notification",
        "/instructor/1/students"
      );

      const results = getNotifications(base.instructor.id, 10, 0);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Second");
      expect(results[1].title).toBe("First");
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(
          base.instructor.id,
          NotificationType.Enrollment,
          `Notification ${i}`,
          `Message ${i}`,
          "/instructor/1/students"
        );
      }

      const results = getNotifications(base.instructor.id, 3, 0);
      expect(results).toHaveLength(3);
    });

    it("respects offset parameter", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(
          base.instructor.id,
          NotificationType.Enrollment,
          `Notification ${i}`,
          `Message ${i}`,
          "/instructor/1/students"
        );
      }

      const results = getNotifications(base.instructor.id, 10, 3);
      expect(results).toHaveLength(2);
    });

    it("returns empty array when user has no notifications", () => {
      const results = getNotifications(base.user.id, 10, 0);
      expect(results).toHaveLength(0);
    });

    it("only returns notifications for the specified user", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "For Instructor",
        "Instructor notification",
        "/instructor/1/students"
      );
      createNotification(
        base.user.id,
        NotificationType.Enrollment,
        "For User",
        "User notification",
        "/instructor/1/students"
      );

      const instructorNotifs = getNotifications(base.instructor.id, 10, 0);
      expect(instructorNotifs).toHaveLength(1);
      expect(instructorNotifs[0].title).toBe("For Instructor");

      const userNotifs = getNotifications(base.user.id, 10, 0);
      expect(userNotifs).toHaveLength(1);
      expect(userNotifs[0].title).toBe("For User");
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Unread 1",
        "Message",
        "/instructor/1/students"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Unread 2",
        "Message",
        "/instructor/1/students"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Read",
        "Message",
        "/instructor/1/students"
      );
      markAsRead(n.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      expect(getUnreadCount(base.user.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const n = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Test",
        "Message",
        "/instructor/1/students"
      );

      const updated = markAsRead(n.id);
      expect(updated!.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const n1 = createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "Message",
        "/instructor/1/students"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "Message",
        "/instructor/1/students"
      );

      markAsRead(n1.id);

      expect(getUnreadCount(base.instructor.id)).toBe(1);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for a user", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "First",
        "Message",
        "/instructor/1/students"
      );
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Second",
        "Message",
        "/instructor/1/students"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect other users' notifications", () => {
      createNotification(
        base.instructor.id,
        NotificationType.Enrollment,
        "Instructor",
        "Message",
        "/instructor/1/students"
      );
      createNotification(
        base.user.id,
        NotificationType.Enrollment,
        "User",
        "Message",
        "/instructor/1/students"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
      expect(getUnreadCount(base.user.id)).toBe(1);
    });
  });
});
