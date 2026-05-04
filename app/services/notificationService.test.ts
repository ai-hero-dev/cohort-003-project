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

import {
  createNotification,
  getNotifications,
  getNotificationById,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

function createUser(name: string, email: string) {
  return testDb
    .insert(schema.users)
    .values({ name, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("inserts a notification with all fields and isRead=false by default", () => {
      const n = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Test User enrolled in Test Course",
        "/instructor/1/students"
      );

      expect(n.recipientUserId).toBe(base.instructor.id);
      expect(n.type).toBe(schema.NotificationType.Enrollment);
      expect(n.title).toBe("New Enrollment");
      expect(n.message).toBe("Test User enrolled in Test Course");
      expect(n.linkUrl).toBe("/instructor/1/students");
      expect(n.isRead).toBe(false);
      expect(n.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered by most recent first", () => {
      const a = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "First",
        "msg a",
        "/a"
      );
      const b = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Second",
        "msg b",
        "/b"
      );

      const list = getNotifications(base.instructor.id, 10, 0);
      expect(list).toHaveLength(2);
      // Newer (higher id) comes first.
      expect(list[0].id).toBe(b.id);
      expect(list[1].id).toBe(a.id);
    });

    it("respects limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(
          base.instructor.id,
          schema.NotificationType.Enrollment,
          `Title ${i}`,
          `msg ${i}`,
          `/n/${i}`
        );
      }

      const page1 = getNotifications(base.instructor.id, 2, 0);
      const page2 = getNotifications(base.instructor.id, 2, 2);
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it("scopes to the recipient user", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other-instructor@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Mine",
        "for me",
        "/me"
      );
      createNotification(
        otherInstructor.id,
        schema.NotificationType.Enrollment,
        "Theirs",
        "for them",
        "/them"
      );

      const mine = getNotifications(base.instructor.id, 10, 0);
      expect(mine).toHaveLength(1);
      expect(mine[0].title).toBe("Mine");
    });
  });

  describe("getNotificationById", () => {
    it("returns the notification when it exists", () => {
      const n = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "T",
        "M",
        "/x"
      );
      expect(getNotificationById(n.id)?.id).toBe(n.id);
    });

    it("returns undefined for an unknown id", () => {
      expect(getNotificationById(99999)).toBeUndefined();
    });
  });

  describe("getUnreadCount", () => {
    it("counts only unread notifications for the given user", () => {
      const a = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "A",
        "a",
        "/a"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "B",
        "b",
        "/b"
      );
      markAsRead(a.id);

      expect(getUnreadCount(base.instructor.id)).toBe(1);
    });

    it("returns 0 when the user has no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not count another user's unread notifications", () => {
      const otherUser = createUser("Other", "other@example.com");
      createNotification(
        otherUser.id,
        schema.NotificationType.Enrollment,
        "T",
        "m",
        "/x"
      );
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a single notification as read", () => {
      const n = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "T",
        "m",
        "/x"
      );
      markAsRead(n.id);
      expect(getNotificationById(n.id)?.isRead).toBe(true);
    });

    it("does not affect other notifications", () => {
      const a = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "A",
        "a",
        "/a"
      );
      const b = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "B",
        "b",
        "/b"
      );

      markAsRead(a.id);
      expect(getNotificationById(a.id)?.isRead).toBe(true);
      expect(getNotificationById(b.id)?.isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks every notification belonging to the user as read", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "A",
        "a",
        "/a"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "B",
        "b",
        "/b"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("leaves another user's notifications untouched", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other-instructor@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      createNotification(
        otherInstructor.id,
        schema.NotificationType.Enrollment,
        "Theirs",
        "t",
        "/t"
      );
      markAllAsRead(base.instructor.id);
      expect(getUnreadCount(otherInstructor.id)).toBe(1);
    });
  });
});
