# Changes

---

## Course Star Ratings

**Summary:** Students can rate courses with a 1–5 star rating. Average ratings are displayed on the course list page and the course detail page. Enrolled users can submit or update their rating from the course detail sidebar.

### New Files

- **`app/services/ratingService.ts`**
  - `getCourseAverageRating(courseId)` — queries average rating and total count for a course; returns `{ average: number | null, count: number }`
  - `getUserRatingForCourse(userId, courseId)` — returns the current user's rating row for a course, if one exists
  - `upsertCourseRating(userId, courseId, rating)` — inserts a new rating or updates the existing one for the user/course pair

- **`drizzle/0003_unique_agent_brand.sql`** — generated migration that creates the `course_ratings` table and its unique index

### Modified Files

- **`app/db/schema.ts`**
  - Added `uniqueIndex` to imports from `drizzle-orm/sqlite-core`
  - Added `courseRatings` table with columns: `id`, `userId` (FK → users), `courseId` (FK → courses), `rating` (integer 1–5), `createdAt`
  - Added a unique index `course_ratings_user_course_unique` on `(userId, courseId)` to enforce one rating per user per course

- **`app/routes/courses.tsx`** (course list page)
  - Imported `Star` from `lucide-react` and `getCourseAverageRating` from `ratingService`
  - Added a `StarRating` display component (read-only filled stars)
  - In the loader, calls `getCourseAverageRating` per course and attaches `averageRating` and `ratingCount` to each course object
  - Updated the course card footer to show the star rating row (hidden when no ratings exist yet)

- **`app/routes/courses.$slug.tsx`** (course detail page)
  - Imported `Form` from `react-router`, `Star` from `lucide-react`, and `getCourseAverageRating`, `getUserRatingForCourse`, `upsertCourseRating` from `ratingService`
  - Added an `action` handler that validates the user is enrolled, reads the `rating` field from form data (must be 1–5), and calls `upsertCourseRating`
  - In the loader, fetches `averageRating`, `ratingCount`, and `userRating` (the current user's rating, only populated if enrolled) and includes them in loader data
  - Hero section: displays average rating with filled stars, numeric score, and rating count below the course description (hidden when no ratings exist)
  - Sidebar: displays an interactive 5-star widget for enrolled users using a `<Form method="post">` with one submit button per star; the user's current rating is highlighted in yellow; clicking any star submits immediately
