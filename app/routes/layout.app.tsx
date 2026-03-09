import { Outlet } from "react-router";
import type { Route } from "./+types/layout.app";
import { Sidebar } from "~/components/sidebar";
import { DevUI } from "~/components/dev-ui";
import { Toaster } from "sonner";
import { getAllUsers, getUserById } from "~/services/userService";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import {
  getRecentlyProgressedCourses,
  calculateProgress,
  getCompletedLessonCount,
  getTotalLessonCount,
} from "~/services/progressService";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { isTeamAdmin } from "~/services/teamService";
import {
  getNotifications,
  getUnreadCount,
} from "~/services/notificationService";
import { UserRole } from "~/db/schema";
import { getTotalXp } from "~/services/xpService";
import { getLevelFromXp } from "~/lib/leveling";
import { getStreakData } from "~/services/streakService";

export async function loader({ request }: Route.LoaderArgs) {
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  const recentCourses = currentUserId
    ? getRecentlyProgressedCourses(currentUserId).map((course) => {
        const completedLessons = getCompletedLessonCount(
          currentUserId,
          course.courseId
        );
        const totalLessons = getTotalLessonCount(course.courseId);
        const progress = calculateProgress(
          currentUserId,
          course.courseId,
          false,
          false
        );
        return {
          courseId: course.courseId,
          title: course.courseTitle,
          slug: course.courseSlug,
          coverImageUrl: course.coverImageUrl,
          completedLessons,
          totalLessons,
          progress,
        };
      })
    : [];

  const isStudent = currentUser?.role === UserRole.Student;
  const gamification =
    isStudent && currentUserId
      ? (() => {
          const totalXp = getTotalXp(currentUserId);
          const levelInfo = getLevelFromXp(totalXp);
          const streak = getStreakData(currentUserId);
          return { ...levelInfo, totalXp, ...streak };
        })()
      : null;

  const isInstructor = currentUser?.role === UserRole.Instructor;
  const userIsTeamAdmin = currentUserId ? isTeamAdmin(currentUserId) : false;
  const showNotifications = (isInstructor || userIsTeamAdmin) && currentUserId;
  const notifications = showNotifications
    ? getNotifications(currentUserId, 5, 0)
    : [];
  const notificationUnreadCount = showNotifications
    ? getUnreadCount(currentUserId)
    : 0;

  return {
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          avatarUrl: currentUser.avatarUrl ?? null,
        }
      : null,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
    isTeamAdmin: userIsTeamAdmin,
    notifications,
    notificationUnreadCount,
    gamification,
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const {
    users,
    currentUser,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries,
    isTeamAdmin: userIsTeamAdmin,
    notifications,
    notificationUnreadCount,
    gamification,
  } = loaderData;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentUser={currentUser}
        recentCourses={recentCourses}
        isTeamAdmin={userIsTeamAdmin}
        notifications={notifications}
        notificationUnreadCount={notificationUnreadCount}
        gamification={gamification}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
