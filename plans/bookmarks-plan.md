# Lesson Bookmarks Feature

## Context

Students enrolled in a course need to bookmark lessons for later reference. Bookmarks are private to each student, persist until manually removed (even after lesson completion), and are inline-only (no dedicated bookmarks page).

## Design Decisions

- **Toggle location:** Only on the lesson page itself (metadata row alongside duration + GitHub link)
- **Display in lists:** Passive indicator only (no toggle) in curriculum sidebar and course detail page
- **Icon position in lists:** Far right, after duration: `[status] [title] ... [duration] [bookmark]`
- **Empty state:** No icon shown for unbookmarked lessons — icon only appears when bookmarked
- **Module indicator:** Single `Bookmark` icon on collapsed module header if any child is bookmarked (no count)

## 1. Database Schema

**File:** `app/db/schema.ts`

Add a `lessonBookmarks` table:

- `id` (integer, PK, auto-increment)
- `userId` (integer, FK → users.id, NOT NULL)
- `lessonId` (integer, FK → lessons.id, NOT NULL)
- `createdAt` (text, NOT NULL, default now)

**Migration:** `drizzle/0005_*.sql` — generated via `pnpm drizzle-kit generate`

## 2. Bookmark Service

**New file:** `app/services/bookmarkService.ts`

Follow the `ratingService.ts` pattern (`app/services/ratingService.ts`):

- `toggleBookmark(userId, lessonId)` — checks if bookmark exists; if yes, deletes it; if no, inserts it. Returns `{ bookmarked: boolean }`
- `isLessonBookmarked(userId, lessonId)` — returns boolean (used on the lesson page for current lesson)
- `getBookmarkedLessonIds(userId, courseId)` — returns `number[]` of all bookmarked lesson IDs in a course (joins `lessonBookmarks` → `lessons` → `modules` to filter by course). Used in loaders to batch-load.

## 3. Route Changes — Lesson Viewer (`courses.$slug.lessons.$lessonId.tsx`)

**Loader** (inside `if (enrolled)` block, ~line 169):

- Call `getBookmarkedLessonIds(currentUserId, course.id)` → return as `bookmarkedLessonIds: number[]`
- Call `isLessonBookmarked(currentUserId, lessonId)` → return as `isBookmarked: boolean`

**Action** (~line 357, add new intent block):

- `"toggle-bookmark"` intent — verify enrollment, call `toggleBookmark(currentUserId, lessonId)`, return `{ success: true, bookmarked: boolean }`

**Lesson page UI** (metadata row, ~line 604):

- After the GitHub button, add a bookmark toggle button using `useFetcher`
- `Bookmark` icon from lucide-react, `size-4`, filled amber when bookmarked, outline muted when not
- Button variant `outline` size `sm` to match the GitHub button style

**CurriculumSidebar** (~line 775):

- Accept `bookmarkedLessonIds` prop (as `Set<number>`)
- **Lesson row:** If bookmarked, show filled `Bookmark` icon (`size-3.5 text-amber-500`) at the far right of the lesson link (after title)
- **Module header:** If any lesson in the module is bookmarked (check against the Set), show `Bookmark` icon (`size-3.5 text-amber-500`) inline after the module title text, before the chevron or after it

## 4. Route Changes — Course Detail (`courses.$slug.tsx`)

**Loader** (inside `if (enrolled)` block, ~line 87):

- Call `getBookmarkedLessonIds(currentUserId, course.id)` → return as `bookmarkedLessonIds: number[]`

**No action changes needed** — toggling only happens on the lesson page.

**CourseContent component** (~line 598):

- Accept `bookmarkedLessonIds` prop
- **Lesson row** (enrolled view, ~line 681): If bookmarked, show filled `Bookmark` icon (`size-4 text-amber-500`) at far right, after duration
- **Module CardHeader** (~line 631): If any lesson in the module is bookmarked, show `Bookmark` icon (`size-3.5 text-amber-500`) inline near the module title

## Files to Modify/Create

| File                                             | Action                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `app/db/schema.ts`                               | Add `lessonBookmarks` table                                     |
| `app/services/bookmarkService.ts`                | **New** — toggle, check, batch query                            |
| `app/routes/courses.$slug.lessons.$lessonId.tsx` | Loader + action + metadata bookmark button + sidebar indicators |
| `app/routes/courses.$slug.tsx`                   | Loader + CourseContent bookmark indicators                      |

## Verification

1. Run `pnpm drizzle-kit generate` to create migration, then `pnpm drizzle-kit migrate` to apply
2. Log in as an enrolled student, navigate to a lesson
3. Verify bookmark button appears in the metadata row (outline state)
4. Click to bookmark — icon fills amber, page revalidates
5. Go back to course detail page — bookmarked lesson shows filled bookmark icon at far right
6. Collapse the module — bookmark icon appears on module header
7. Open curriculum sidebar on another lesson — same bookmark indicators visible
8. Return to bookmarked lesson, click to unbookmark — icon reverts everywhere
9. Verify non-enrolled users don't see any bookmark UI
