import { Link } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { buildCourseQuery, getLessonCountForCourse } from "~/services/courseService";
import { getAllCategories } from "~/services/categoryService";
import { CourseStatus } from "~/db/schema";
import { BookOpen, GraduationCap, Users, ArrowRight, User, Moon, Sun } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { DevUI } from "~/components/dev-ui";
import { getAllUsers, getUserById } from "~/services/userService";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { getAverageRatingsForCourses } from "~/services/ratingService";
import { StarRatingDisplay } from "~/components/star-rating";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Cadence — Learn at your own pace" },
    { name: "description", content: "A modern course platform for developers. Browse courses, track your progress, and learn at your own pace." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const courses = buildCourseQuery(null, null, CourseStatus.Published, "newest", 50, 0);
  const featured = courses.slice(0, 3).map((course) => ({
    ...course,
    lessonCount: getLessonCountForCourse(course.id),
  }));
  const featuredIds = featured.map((c) => c.id);
  const ratingsMap = getAverageRatingsForCourses(featuredIds);

  const featuredWithRatings = featured.map((course) => {
    const rating = ratingsMap.get(course.id);
    return {
      ...course,
      ratingAverage: rating?.average ?? 0,
      ratingCount: rating?.count ?? 0,
    };
  });

  const categories = getAllCategories();
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  return {
    featuredCourses: featuredWithRatings,
    totalCourses: courses.length,
    totalCategories: categories.length,
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      : null,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featuredCourses, totalCourses, totalCategories, users, currentUser, devCountry, countryTierInfo, countries } = loaderData;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cadence-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Cadence
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/courses"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Courses
            </Link>
            <button
              onClick={toggleDarkMode}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {currentUser ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Log In
                </Link>
                <Button asChild size="sm">
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Learn to code,
          <br />
          <span className="text-muted-foreground">at your own pace</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Structured courses built by experienced instructors. Track your progress,
          take quizzes, and build real-world skills.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/courses">
              Browse Courses
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border bg-muted/50 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="size-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalCourses}</p>
            <p className="text-sm text-muted-foreground">Available Courses</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="size-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalCategories}</p>
            <p className="text-sm text-muted-foreground">Categories</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="size-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">Self-paced</p>
            <p className="text-sm text-muted-foreground">Learn on your schedule</p>
          </div>
        </div>
      </section>

      {featuredCourses.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Featured Courses</h2>
              <p className="mt-2 text-muted-foreground">
                Start learning with our most popular courses
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/courses">
                View all
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <Link key={course.id} to={`/courses/${course.slug}`} className="group">
                <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
                  <CourseImage
                    src={course.coverImageUrl}
                    alt={course.title}
                    className="aspect-video w-full object-cover"
                  />
                  <CardHeader>
                    <h3 className="font-semibold leading-snug group-hover:text-primary">
                      {course.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {course.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {course.instructorName ?? "Instructor"}
                    </span>
                    <div className="flex items-center gap-3">
                      <StarRatingDisplay average={course.ratingAverage} count={course.ratingCount} />
                      <span className="flex items-center gap-1">
                        <BookOpen className="size-3" />
                        {course.lessonCount} lessons
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          Cadence
        </div>
      </footer>

      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
    </div>
  );
}
