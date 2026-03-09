# Student Gamification: XP, Levels & Streaks

## Problem Statement

Students on the platform lack motivation signals beyond simple lesson completion checkmarks. There's no sense of progression, momentum, or reward for consistent engagement. Students who complete lessons regularly have no visible indicator of their dedication, and there's nothing encouraging them to come back day after day.

## Solution

Introduce a lightweight gamification layer for students consisting of three interconnected features:

1. **XP (Experience Points)** — Students earn XP by completing lessons (10 XP each) and passing quizzes for the first time (5 XP each). XP is global across all courses.

2. **Levels** — XP feeds into an infinite leveling system with a light exponential curve. All students start at Level 1. Reaching Level 2 requires 80 XP (roughly 8 lessons). Higher levels require progressively more XP, creating a sense of long-term progression.

3. **Streaks** — Students build streaks by completing at least one lesson per UTC day. The UI shows both the current streak and the student's longest streak ever. There is no grace mechanism — miss a day and the streak resets.

These indicators are sprinkled throughout the existing UI (sidebar, dashboard, module completion toasts) rather than living on a dedicated page. XP, level, and streak data are private to each student and not visible to other students.

## User Stories

1. As a student, I want to earn XP when I complete a lesson, so that I feel rewarded for my effort.
2. As a student, I want to earn XP when I pass a quiz for the first time, so that quizzes feel worth engaging with.
3. As a student, I want to see my current XP total, so that I can track my overall progress.
4. As a student, I want to see my current level, so that I have a clear sense of how far I've come.
5. As a student, I want to see a progress bar toward my next level, so that I know how close I am to leveling up.
6. As a student, I want my level and XP to be visible in the sidebar at all times, so that I'm always aware of my progression.
7. As a student, I want to see my current streak count in the sidebar, so that I'm motivated to keep it going.
8. As a student, I want to see my longest-ever streak, so that I have a record to beat.
9. As a student, I want the streak section to always be visible in the sidebar (even at 0 days), so that I'm reminded to start or maintain a streak.
10. As a student, I want to see a toast notification when I complete a module showing the total XP earned across that module's lessons, so that module completion feels like a milestone.
11. As a student, I want to see a summary of my XP, level, and streak on my dashboard, so that I get an overview when I first log in.
12. As a student, I want my streak to be based on completing at least one lesson per UTC day, so that the rules are clear and consistent.
13. As a student, I want completing multiple lessons in one day to count as a single streak day, so that the system rewards consistency over cramming.
14. As a student, I want my streak to reset if I miss a day, so that the streak feels meaningful and urgent.
15. As a student, I want quiz XP to only be awarded on my first attempt, so that the system can't be gamed by retaking quizzes.
16. As a student, I want my XP and level to be private, so that I don't feel compared to other students.
17. As a student, I want the leveling curve to feel achievable early on but increasingly challenging, so that early levels feel rewarding and later levels feel prestigious.

## Implementation Decisions

### XP Awards

- Completing a lesson awards **10 XP** (flat, regardless of lesson duration or content).
- Passing a quiz for the first time awards **5 XP**. Retaking a quiz does not award additional XP.
- XP is global — it accumulates across all enrolled courses into a single total.

### Leveling System

- All students start at **Level 1** with 0 XP.
- The XP required to advance from level N to level N+1 is calculated as: `round(80 * N^1.3)`.
  - Level 1→2: 80 XP
  - Level 2→3: ~197 XP
  - Level 3→4: ~345 XP
  - Level 5→6: ~720 XP
  - Level 10→11: ~1,596 XP
- Levels scale infinitely — there is no cap.
- The level is derived from total XP (not stored separately), so it's always consistent.

### Streak System

- A streak day is recorded when a student completes at least one lesson in a UTC day.
- Multiple completions in a single UTC day count as one streak day.
- The streak resets to 0 if a full UTC day passes with no lesson completion.
- Both **current streak** and **longest streak** are tracked.
- Streaks are based on UTC, with no timezone localization and no grace/freeze mechanism.

### Database Changes

- New `xp_events` table to record each XP award (userId, amount, source type, source ID, timestamp). This serves as an audit log and prevents duplicate awards.
- New `streak_activities` table to record lesson completion dates per user (one row per user per UTC day). Used to calculate current and longest streaks.

### UI Placement

- **Sidebar**: Always-visible section showing Level (e.g., "Level 4"), XP progress bar to next level, and streak count with a flame/streak icon. Streak shows even at 0 days.
- **Dashboard**: Summary card(s) showing current XP, level, progress to next level, current streak, and longest streak.
- **Module completion toast**: When a student completes the last lesson in a module, a toast shows the total XP earned across that module (e.g., "Module complete! +40 XP earned").
- No XP/level display on individual lesson completion — only on module completion.

### What Does NOT Award XP

- Logging in
- Watching a video without marking the lesson complete
- Commenting on a lesson
- Bookmarking a lesson
- Rating a course
- Enrolling in a course

## Out of Scope

- **Badges**: No badge system in this iteration.
- **Leaderboards or public profiles**: XP and level are private to each student.
- **Streak grace/freeze**: No mechanism to preserve a streak when missing a day.
- **XP weighted by lesson duration**: All lessons award the same flat XP.
- **Instructor/admin gamification**: This feature is student-only.
- **Custom XP events**: Instructors/admins cannot create custom XP awards.
- **XP for activities other than lesson completion and first quiz pass**.
- **Timezone-localized streaks**: Streaks are UTC-only.

## Further Notes

- The leveling formula `round(80 * N^1.3)` should be defined as a shared utility so it can be used on both server (for calculations) and client (for progress bar rendering).
- Streak calculation should be efficient — consider storing current streak and longest streak as denormalized fields on the user or a separate stats row, updated on each lesson completion, rather than recalculating from the full activity log every time.
- Existing lesson completion and quiz attempt flows need to be extended to also record XP events and streak activity as side effects.
