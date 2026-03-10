import { useEffect, useMemo, useState } from "react";
import * as Ably from "ably";
import {
  AblyProvider,
  ChannelProvider,
  usePresence,
  usePresenceListener,
} from "ably/react";
import type { Route } from "./+types/dev.presence";
import { getCurrentUserId } from "~/lib/session";
import { getUserById, getAllUsers } from "~/services/userService";

// --- Server loader ---

export async function loader({ request }: Route.LoaderArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not found", { status: 404 });
  }

  const userId = await getCurrentUserId(request);
  const user = userId ? getUserById(userId) : null;
  const users = getAllUsers();

  return {
    currentUser: user ? { id: user.id, name: user.name } : null,
    hasAblyKey: !!process.env.ABLY_API_KEY,
    users: users.map((u) => ({ id: u.id, name: u.name })),
  };
}

// --- Presence indicator component (the reusable asset) ---

/**
 * PresenceIndicator — drop-in component that shows who else is viewing
 * the same channel. Requires AblyProvider and ChannelProvider ancestors.
 *
 * Usage:
 *   <AblyProvider client={ablyClient}>
 *     <ChannelProvider channelName={`lesson:${lessonId}`}>
 *       <PresenceIndicator
 *         channelName={`lesson:${lessonId}`}
 *         currentUser={{ id: user.id, name: user.name }}
 *       />
 *     </ChannelProvider>
 *   </AblyProvider>
 */
export function PresenceIndicator({
  channelName,
  currentUser,
}: {
  channelName: string;
  currentUser: { id: number; name: string };
}) {
  usePresence<{ name: string }>(channelName, {
    name: currentUser.name,
  });

  const { presenceData } = usePresenceListener<{ name: string }>(channelName);

  const others = presenceData.filter(
    (member) => member.clientId !== String(currentUser.id)
  );

  if (others.length === 0) return null;

  return <PresencePill members={others} />;
}

function PresencePill({
  members,
}: {
  members: Array<{ data?: { name: string } }>;
}) {
  const MAX_NAMED = 2;
  const named = members
    .slice(0, MAX_NAMED)
    .map((m) => m.data?.name ?? "Someone");
  const remaining = members.length - named.length;

  let text: string;
  if (remaining === 0) {
    text =
      named.join(" and ") + (named.length === 1 ? " is" : " are") + " here";
  } else {
    text =
      named.join(", ") +
      ` and ${remaining} other${remaining === 1 ? "" : "s"} ${remaining === 1 ? "is" : "are"} here`;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      {text}
    </div>
  );
}

// --- Ably client factory ---

export function createAblyClient(userId: string) {
  return new Ably.Realtime({
    authUrl: "/api/ably-auth",
    clientId: userId,
    transportParams: { remainPresentFor: "5000" },
  });
}

// --- Dev prototype page ---

export default function DevPresencePage({ loaderData }: Route.ComponentProps) {
  const { currentUser, hasAblyKey } = loaderData;

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-border bg-card p-8 text-card-foreground">
          <h1 className="mb-2 text-lg font-semibold">Not logged in</h1>
          <p className="text-sm text-muted-foreground">
            Log in first, then come back to this page.
          </p>
        </div>
      </div>
    );
  }

  if (!hasAblyKey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-border bg-card p-8 text-card-foreground">
          <h1 className="mb-2 text-lg font-semibold">ABLY_API_KEY not set</h1>
          <p className="text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1">ABLY_API_KEY</code> to
            your <code className="rounded bg-muted px-1">.env</code> file. Get a
            key from{" "}
            <a
              href="https://ably.com/accounts"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              ably.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <PresenceDemo currentUser={currentUser} />;
}

function PresenceDemo({
  currentUser,
}: {
  currentUser: { id: number; name: string };
}) {
  const [channelName, setChannelName] = useState("lesson:demo-1");
  const [connected, setConnected] = useState(false);

  const client = useMemo(
    () => createAblyClient(String(currentUser.id)),
    [currentUser.id]
  );

  useEffect(() => {
    const onStateChange = (stateChange: Ably.ConnectionStateChange) => {
      setConnected(stateChange.current === "connected");
    };
    client.connection.on(onStateChange);
    return () => {
      client.connection.off(onStateChange);
      client.close();
    };
  }, [client]);

  return (
    <AblyProvider client={client}>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-card-foreground">
          <div>
            <h1 className="text-lg font-semibold">Presence Prototype</h1>
            <p className="text-sm text-muted-foreground">
              Logged in as <strong>{currentUser.name}</strong>
            </p>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            {connected ? "Connected to Ably" : "Connecting..."}
          </div>

          {/* Channel selector */}
          <div className="space-y-2">
            <label htmlFor="channel" className="text-sm font-medium">
              Channel
            </label>
            <div className="flex gap-2">
              {["lesson:demo-1", "lesson:demo-2", "lesson:demo-3"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelName(ch)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    channelName === ch
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {ch.split(":")[1]}
                </button>
              ))}
            </div>
          </div>

          {/* Presence indicator for current channel */}
          <div className="rounded-md border border-border bg-muted/50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Presence on {channelName}
            </p>
            <ChannelProvider channelName={channelName} key={channelName}>
              <PresenceIndicator
                channelName={channelName}
                currentUser={currentUser}
              />
              <PresenceDebug
                currentUserId={currentUser.id}
                channelName={channelName}
              />
            </ChannelProvider>
          </div>

          <p className="text-xs text-muted-foreground">
            Open this page in multiple browser tabs (as different users via
            DevUI) to see presence updates in real time.
          </p>
        </div>
      </div>
    </AblyProvider>
  );
}

/** Debug view showing raw presence data */
function PresenceDebug({
  currentUserId,
  channelName,
}: {
  currentUserId: number;
  channelName: string;
}) {
  const { presenceData } = usePresenceListener<{ name: string }>(channelName);

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        All members ({presenceData.length}):
      </p>
      {presenceData.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Just you — no others on this channel yet.
        </p>
      )}
      {presenceData.map((member) => (
        <div key={member.clientId} className="flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span>
            {member.data?.name ?? "Unknown"}{" "}
            {member.clientId === String(currentUserId) && (
              <span className="text-muted-foreground">(you)</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
