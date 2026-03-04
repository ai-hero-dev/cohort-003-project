# Plan: In-App Notifications for Instructors (Enrollment Events)

> Source PRD: `prd/in-app-notifications.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: New `notifications` table in `app/db/schema.ts` with a `NotificationType` enum (starting with `"enrollment"`). Fields: `id`, `recipientUserId` (FK → users), `type`, `title`, `message`, `linkUrl`, `isRead` (boolean, default false), `createdAt`.
- **Service**: New `notificationService.ts` using positional parameters and direct Drizzle queries (matching existing service conventions).
- **Routes**: `POST /api/notifications/mark-read` (single notification), `POST /api/notifications/mark-all-read` (all for current user). Registered in `app/routes.ts`.
- **Data flow**: `layout.app.tsx` loader fetches unread count + 5 most recent notifications for instructor users. Data flows through `Sidebar` → `NotificationBell` component.
- **Visibility**: Bell icon renders only for users with role `"instructor"`.

---

## Phase 1: In-App Enrollment Notifications

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12

### What to build

A complete in-app notification system for instructors. When a student enrolls in a course, the course's instructor receives a notification visible via a bell icon in the sidebar.

The bell icon shows an unread count badge. Clicking it opens a dropdown with the 5 most recent notifications. Each notification displays a title, message (e.g., "John Doe enrolled in React Fundamentals"), and relative timestamp, with visual distinction between read and unread. Clicking a notification marks it as read and navigates to the course's student list. A "Mark all as read" button clears all unread notifications at once.

The notification is created as a side effect of enrollment — when `enrollUser()` succeeds, the service looks up the course's instructor and the enrolling student's name, then creates a notification record.

Two API routes handle read-state mutations: one for marking a single notification as read, one for marking all as read. Both require an authenticated session and validate that the notification belongs to the current user.

The bell icon and dropdown are only visible to instructors. Students and admins do not see the notification UI.

### Acceptance criteria

- [ ] `notifications` table exists with all specified columns and a `NotificationType` enum
- [ ] `notificationService` supports: `createNotification`, `getNotifications` (with limit/offset, ordered newest first), `getUnreadCount`, `markAsRead`, `markAllAsRead`
- [ ] Enrolling a student creates a notification for the course's instructor with type `"enrollment"`, title `"New Enrollment"`, message `"{studentName} enrolled in {courseTitle}"`, and linkUrl `/instructor/{courseId}/students`
- [ ] Bell icon appears in the sidebar header for instructor users only
- [ ] Bell icon shows a red unread count badge when count > 0; badge is hidden when count is 0
- [ ] Clicking the bell opens a dropdown showing the 5 most recent notifications
- [ ] Unread notifications are visually distinct from read notifications in the dropdown
- [ ] Clicking a notification marks it as read (via fetcher, no full page reload) and navigates to its `linkUrl`
- [ ] "Mark all as read" button in the dropdown marks all notifications as read and updates the badge count
- [ ] Dropdown shows "No notifications" message when the user has no notifications
- [ ] Students and admins do not see the bell icon
- [ ] `notificationService` has tests covering: create, get (ordering/limit/offset), unread count, mark as read, mark all as read, user-scoping
- [ ] Enrollment-to-notification integration is tested: enrolling a student produces a notification for the instructor with correct fields
