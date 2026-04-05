import { useState } from "react";
import { Form, useLocation } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { UserRole } from "~/db/schema";
import { ChevronDown, ChevronUp, Globe } from "lucide-react";

interface DevUser {
  id: number;
  name: string;
  role: UserRole;
}

interface DevUIProps {
  users: DevUser[];
  currentUser: DevUser | null;
  devCountry: string | null;
  countryTierInfo: { tier: number; discount: number; label: string };
  countries: { code: string; name: string }[];
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  instructor:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  student:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        roleBadgeColors[role] ?? "bg-muted text-muted-foreground"
      )}
    >
      {role}
    </span>
  );
}

export function DevUI({ users, currentUser, devCountry, countryTierInfo, countries }: DevUIProps) {
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMinimized(false)}
          className="bg-background/80 backdrop-blur-sm border-dashed shadow-lg"
        >
          DevUI
          <ChevronUp className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border border-dashed bg-background/90 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-dashed px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          DevUI
        </span>
        <div className="flex gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setMinimized(true)}
          >
            <ChevronDown className="size-3" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-2 text-xs text-muted-foreground">Current user</div>
        {currentUser ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium">{currentUser.name}</span>
            <RoleBadge role={currentUser.role} />
          </div>
        ) : (
          <div className="mb-3 text-sm text-muted-foreground italic">
            No user selected
          </div>
        )}

        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setOpen(!open)}
          >
            Switch user
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                open && "rotate-180"
              )}
            />
          </Button>

          {open && (
            <div className="absolute bottom-full mb-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
              {users.map((user) => (
                <Form
                  key={user.id}
                  method="post"
                  action={`/api/switch-user?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
                  onSubmit={() => setOpen(false)}
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                      currentUser?.id === user.id && "bg-accent"
                    )}
                  >
                    <span className="flex-1 truncate">{user.name}</span>
                    <RoleBadge role={user.role} />
                  </button>
                </Form>
              ))}
            </div>
          )}
        </div>

        {/* Country Override (PPP) */}
        <div className="mt-3 border-t border-dashed pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="size-3" />
            PPP Country
          </div>
          <Form
            method="post"
            action={`/api/set-dev-country?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
          >
            <select
              name="country"
              defaultValue={devCountry ?? ""}
              onChange={(e) => e.target.form?.requestSubmit()}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Auto-detect</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </Form>
          {devCountry && (
            <div className="mt-1.5 text-xs text-muted-foreground">
              Tier {countryTierInfo.tier} — {countryTierInfo.label}
              {countryTierInfo.discount > 0 && (
                <span className="ml-1 font-medium text-green-600">
                  ({Math.round(countryTierInfo.discount * 100)}% discount)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
