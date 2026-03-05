import { NavLink, Form } from "react-router";
import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";
import { UserAvatar } from "~/components/user-avatar";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  Shield,
  Tag,
  Users,
  UsersRound,
  Moon,
  Sun,
  LogOut,
  Settings,
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";

interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
}

interface RecentCourse {
  courseId: number;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  completedLessons: number;
  totalLessons: number;
  progress: number;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface SidebarProps {
  currentUser: CurrentUser | null;
  recentCourses?: RecentCourse[];
  isTeamAdmin?: boolean;
  notifications?: NotificationItem[];
  notificationUnreadCount?: number;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: UserRole[] | "all";
}

const navItems: NavItem[] = [
  {
    label: "Browse Courses",
    to: "/courses",
    icon: <BookOpen className="size-4" />,
    roles: "all",
  },
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="size-4" />,
    roles: [UserRole.Student],
  },
  {
    label: "My Courses",
    to: "/instructor",
    icon: <GraduationCap className="size-4" />,
    roles: [UserRole.Instructor],
  },
  {
    label: "Analytics",
    to: "/instructor/analytics",
    icon: <BarChart3 className="size-4" />,
    roles: [UserRole.Instructor],
  },
  {
    label: "Analytics",
    to: "/admin/analytics",
    icon: <BarChart3 className="size-4" />,
    roles: [UserRole.Admin],
  },
  {
    label: "Manage Users",
    to: "/admin/users",
    icon: <Users className="size-4" />,
    roles: [UserRole.Admin],
  },
  {
    label: "Manage Courses",
    to: "/admin/courses",
    icon: <Shield className="size-4" />,
    roles: [UserRole.Admin],
  },
  {
    label: "Categories",
    to: "/admin/categories",
    icon: <Tag className="size-4" />,
    roles: [UserRole.Admin],
  },
];

function isVisible(item: NavItem, role: UserRole | null): boolean {
  if (item.roles === "all") return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export function Sidebar({
  currentUser,
  recentCourses = [],
  isTeamAdmin = false,
  notifications = [],
  notificationUnreadCount = 0,
}: SidebarProps) {
  const currentUserRole = currentUser?.role ?? null;
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
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <NavLink to="/" className="text-lg font-bold tracking-tight">
          Cadence
        </NavLink>
        {(currentUser?.role === UserRole.Instructor || isTeamAdmin) && (
          <NotificationBell
            notifications={notifications}
            unreadCount={notificationUnreadCount}
          />
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((item) => isVisible(item, currentUserRole))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        {isTeamAdmin && (
          <NavLink
            to="/team"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <UsersRound className="size-4" />
            Team
          </NavLink>
        )}
      </nav>

      {recentCourses.length > 0 && (
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Recent Courses
          </div>
          <div className="space-y-1">
            {recentCourses.map((course) => (
              <NavLink
                key={course.courseId}
                to={`/courses/${course.slug}`}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-3 py-2 transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <div className="truncate text-sm font-medium">
                  {course.title}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-sidebar-accent">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-sidebar-foreground/50">
                    {course.progress}%
                  </span>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <button
          onClick={toggleDarkMode}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        {currentUser && (
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <UserAvatar
              name={currentUser.name}
              avatarUrl={currentUser.avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {currentUser.name}
              </div>
              <div className="truncate text-xs capitalize text-sidebar-foreground/50">
                {currentUser.role}
              </div>
            </div>
            <NavLink
              to="/settings"
              title="Settings"
              className="rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Settings className="size-4" />
            </NavLink>
            <Form method="post" action="/api/logout">
              <button
                type="submit"
                title="Sign out"
                className="rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </Form>
          </div>
        )}
      </div>
    </aside>
  );
}
