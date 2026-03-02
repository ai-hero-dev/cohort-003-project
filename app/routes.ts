import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/layout.app.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("courses", "routes/courses.tsx"),
    route("courses/:slug", "routes/courses.$slug.tsx"),
    route("courses/:slug/:moduleId", "routes/courses.$slug.$moduleId.tsx"),
    route("courses/:slug/purchase", "routes/courses.$slug.purchase.tsx"),
    route("courses/:slug/welcome", "routes/courses.$slug.welcome.tsx"),
    route(
      "courses/:slug/lessons/:lessonId",
      "routes/courses.$slug.lessons.$lessonId.tsx"
    ),
    route("instructor", "routes/instructor.tsx"),
    route("instructor/analytics", "routes/instructor.analytics.tsx"),
    route("instructor/new", "routes/instructor.new.tsx"),
    route("instructor/:courseId", "routes/instructor.$courseId.tsx"),
    route(
      "instructor/:courseId/lessons/:lessonId",
      "routes/instructor.$courseId.lessons.$lessonId.tsx"
    ),
    route(
      "instructor/:courseId/lessons/:lessonId/quiz",
      "routes/instructor.$courseId.lessons.$lessonId.quiz.tsx"
    ),
    route(
      "instructor/:courseId/modules/:moduleId",
      "routes/instructor.$courseId.modules.$moduleId.tsx"
    ),
    route(
      "instructor/:courseId/students",
      "routes/instructor.$courseId.students.tsx"
    ),
    route("admin/users", "routes/admin.users.tsx"),
    route("admin/courses", "routes/admin.courses.tsx"),
    route("admin/categories", "routes/admin.categories.tsx"),
    route("settings", "routes/settings.tsx"),
    route("team", "routes/team.tsx"),
    route("redeem/:code", "routes/redeem.$code.tsx"),
  ]),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("api/switch-user", "routes/api.switch-user.ts"),
  route("api/logout", "routes/api.logout.ts"),
  route("api/video-tracking", "routes/api.video-tracking.ts"),
  route("api/set-dev-country", "routes/api.set-dev-country.ts"),
] satisfies RouteConfig;
