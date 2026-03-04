# In-App Notifications for Instructors (Enrollment Events)

## Problem Statement

Instructors on the Cadence platform have no way to know when new students enroll in their courses. They must manually check their student lists or analytics dashboard to discover new enrollments. This creates a disconnected experience where instructors miss the opportunity to engage with new students promptly.

## Solution

Add an in-app notification system that alerts instructors when a student enrolls in one of their courses. Notifications appear via a bell icon with an unread count badge in the sidebar. Clicking the bell opens a dropdown showing the 5 most recent notifications. Each notification links to the relevant course's student list page. Instructors can mark notifications as read individually or mark all as read.

The system is designed with a generic notification schema so it can be extended to other event types (new comments, quiz completions, ratings, etc.) in the future, but only enrollment notifications are implemented in this phase.

## User Stories

1. As an instructor, I want to see a bell icon in the sidebar with an unread count badge, so that I know at a glance whether I have new notifications.
2. As an instructor, I want to click the bell icon to see a dropdown of my 5 most recent notifications, so that I can quickly review what's new.
3. As an instructor, I want to receive a notification when a student enrolls in one of my courses, so that I can stay informed about new enrollments without checking manually.
4. As an instructor, I want each enrollment notification to show the student's name and course title (e.g., "John Doe enrolled in Your Course Name"), so that I know who enrolled and in which course.
5. As an instructor, I want to click on an enrollment notification to navigate to the course's student list page, so that I can see the full list of enrolled students.
6. As an instructor, I want unread notifications to be visually distinct from read notifications, so that I can tell which ones are new.
7. As an instructor, I want to click on a notification to mark it as read, so that I can track which notifications I've already seen.
8. As an instructor, I want a "Mark all as read" button in the notification dropdown, so that I can clear all unread notifications at once.
9. As an instructor, I want the unread count badge to update when I navigate between pages, so that it reflects the current state without needing a full page refresh.
10. As an instructor, I want the notification dropdown to show a message like "No notifications" when I have no notifications, so that the empty state is clear.
11. As a student, I do not want to see the notification bell icon, so that the UI is not cluttered with features irrelevant to my role.
12. As an admin, I do not want to see the notification bell icon (for now), so that the feature is scoped to instructors only.

## Implementation Decisions

### Database Schema

- A new `notifications` table with a generic schema:
  - `id` (primary key, auto-increment)
  - `recipientUserId` (foreign key to users — the user who receives the notification)
  - `type` (enum string — e.g., "enrollment". Designed for extensibility to other types)
  - `title` (short summary, e.g., "New Enrollment")
  - `message` (full notification text, e.g., "John Doe enrolled in React Fundamentals")
  - `linkUrl` (where clicking the notification navigates, e.g., `/instructor/5/students`)
  - `isRead` (boolean, default false)
  - `createdAt` (auto-timestamp)
- A new `NotificationType` enum in the schema starting with `"enrollment"` and extensible for future types.

### Service Layer

- A new `notificationService.ts` following the existing service pattern (positional parameters, direct Drizzle queries):
  - `createNotification(recipientUserId, type, title, message, linkUrl)` — creates a notification record
  - `getNotifications(userId, limit, offset)` — returns notifications for a user, ordered by most recent first
  - `getUnreadCount(userId)` — returns the count of unread notifications for a user
  - `markAsRead(notificationId)` — marks a single notification as read
  - `markAllAsRead(userId)` — marks all of a user's notifications as read

### Enrollment Integration

- After a successful enrollment in `enrollmentService.enrollUser()`, create a notification for the course's instructor:
  - Look up the course to get the `instructorId`
  - Look up the enrolling user to get their name
  - Call `createNotification()` with:
    - `recipientUserId`: the course's `instructorId`
    - `type`: `"enrollment"`
    - `title`: `"New Enrollment"`
    - `message`: `"{studentName} enrolled in {courseTitle}"`
    - `linkUrl`: `/instructor/{courseId}/students`

### API Routes

- `POST /api/notifications/mark-read` — marks a single notification as read (accepts `notificationId` in request body)
- `POST /api/notifications/mark-all-read` — marks all notifications as read for the current user

### UI Components

- A `NotificationBell` component added to the sidebar, visible only to instructors:
  - Bell icon (from Lucide) with a red badge showing unread count (hidden when count is 0)
  - Positioned in the sidebar header area, next to the "Cadence" logo
  - Clicking opens a dropdown (positioned to the right of the sidebar)
  - Dropdown shows the 5 most recent notifications
  - Each notification shows: title, message, time ago, and read/unread indicator
  - Clicking a notification marks it as read (via fetcher) and navigates to the `linkUrl`
  - "Mark all as read" button at the bottom of the dropdown
  - Empty state: "No notifications" message

### Data Flow

- The `layout.app.tsx` loader fetches the unread count and recent notifications for the current user (if they are an instructor)
- This data is passed to the `Sidebar` component, which renders the `NotificationBell`
- Mark-as-read actions use React Router's `useFetcher` to call the API routes without full page reloads
- Notification data refreshes on each page navigation (standard React Router loader behavior)

## Testing Decisions

### What makes a good test

Tests should verify external behavior (inputs and outputs of the service functions), not implementation details like specific SQL queries or internal state. Tests should use the existing in-memory SQLite test database pattern established in the codebase.

### Modules to test

- **`notificationService.ts`** — full test coverage:
  - Creating notifications with all fields
  - Retrieving notifications for a user (ordering, limit, offset)
  - Getting unread count
  - Marking individual notifications as read
  - Marking all notifications as read
  - Ensuring notifications are user-scoped (user A can't see user B's notifications)
- **Enrollment-to-notification integration** — test that `enrollUser()` creates a notification for the instructor:
  - Enroll a student and verify a notification was created for the course's instructor
  - Verify the notification has the correct type, title, message, and linkUrl

### Prior art

- Follow the same patterns as `enrollmentService.test.ts` and `progressService.test.ts`: use the test setup from `app/test/setup.ts`, mock `~/db`, seed data in `beforeEach`, and test service functions directly.

## Out of Scope

- Email, SMS, or push notifications — this is in-app only
- Real-time delivery (WebSockets, SSE, polling) — notifications load on page navigation
- Notification preferences/settings (e.g., opt-out of certain notification types)
- Notifications for students or admins
- Notification types beyond enrollment (comments, ratings, quiz completions) — the schema supports them but they are not implemented
- Dedicated full notifications page (`/notifications`) — only the dropdown for now
- Notification deletion or archiving
- Batch/digest notifications (e.g., "5 students enrolled today")

## Further Notes

- The notification system is intentionally generic (type enum, title/message/linkUrl) to make it straightforward to add new notification types in the future without schema changes.
- The bell icon should only render for instructors to keep the student and admin UIs clean.
- Since notifications are loaded in the layout loader, they will be fetched on every page navigation. For the current scale (single-instructor courses, SQLite), this is fine. If performance becomes a concern, caching or a dedicated notification count endpoint could be added later.
- The `sendEmail` parameter stub in `enrollmentService.enrollUser()` remains untouched — email notifications are a separate concern for a future PRD.
