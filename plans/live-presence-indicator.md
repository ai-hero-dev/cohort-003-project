# Research: Live Presence Indicator

> Shows students who else is viewing the same lesson in real time.
> UI: "Matt, Sarah, and 2 others are here"

## Requirements

- **Scale**: ~20 concurrent students per lesson
- **Latency**: True real-time (1-2 second updates on join/leave)
- **UI**: Show names — "Matt, Sarah, and 2 others are here" (no cursors/scroll tracking)
- **Data**: Ephemeral only — no persistence, no historical tracking
- **Auth**: Only authenticated students count toward presence
- **Infrastructure preference**: Managed third-party service (API keys, no sidecar deploys)

---

## Recommended approach: Ably

Ably is a managed real-time messaging service with first-class presence support and official React hooks. It's the best fit for this use case because:

- **Purpose-built presence primitives** — `usePresence` and `usePresenceListener` hooks handle the full lifecycle
- **First-party React SDK** — hooks are maintained by Ably in the `ably` npm package (not a community wrapper)
- **Generous free tier** — 6M messages/month, 200 concurrent connections (our ~20 users/lesson is well within this)
- **Managed service** — no infrastructure to deploy, just API keys
- **Automatic disconnect detection** — users are removed from presence within 15 seconds of an abrupt disconnect (configurable down to 1 second via `remainPresentFor`)

### Pricing

| Plan     | Cost           | Messages         | Connections       |
| -------- | -------------- | ---------------- | ----------------- |
| Free     | $0/mo          | 6M/month         | 200 concurrent    |
| Standard | $29/mo + usage | $2.50/M messages | 10,000 concurrent |

At ~20 concurrent users per lesson, the free tier is more than sufficient. Presence enter/leave events count as messages, but at this scale the 6M monthly limit is far from a concern.

### Bundle size

- Full `ably` package: ~234 KiB minified / ~83 KiB gzipped
- Modular variant (`ably/modular`): ~92 KiB minified / ~28 KiB gzipped (tree-shakeable)

For initial implementation, use the standard import. Optimize with the modular variant later if bundle size becomes a concern.

---

## Implementation design

### Architecture overview

```
Browser (React)                    Cadence Server (React Router)         Ably Cloud
─────────────────                  ──────────────────────────────        ──────────

1. Ably client init ──────────────> GET /api/ably-auth ──────────────>  createTokenRequest()
   (authUrl)          token request    (resource route)    ABLY_API_KEY     ↓
                     <──────────────  return tokenRequest <──────────── signed TokenRequest

2. usePresence('lesson:42', data)  ──────────────────────────────────>  Enter presence set

3. usePresenceListener('lesson:42') <────────────────────────────────  join/leave events
   → update UI with member list
```

### Packages to install

```bash
pnpm add ably
```

The `ably` package includes both the server-side REST client (for token auth) and the client-side Realtime SDK with React hooks. One package covers everything.

### Server: Token auth endpoint

Create a resource route at `app/routes/api.ably-auth.ts`:

```typescript
import type { LoaderFunctionArgs } from "react-router";
import Ably from "ably";
import { requireUser } from "~/services/sessionService";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const client = new Ably.Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: String(user.id),
  });

  return Response.json(tokenRequest);
}
```

This endpoint:

- Validates the user is authenticated (reuses existing `requireUser`)
- Creates a signed token request using the server-side API key (never exposed to the client)
- Returns the token request — the Ably client SDK exchanges it for a connection token automatically
- Handles token renewal transparently (the SDK re-calls `authUrl` before expiry)

**Environment variable needed**: `ABLY_API_KEY` (server-only, from the Ably dashboard).

### Client: Ably provider setup

In the app layout (e.g., `app/layouts/app-layout.tsx` or wherever the authenticated shell lives):

```typescript
import * as Ably from "ably";
import { AblyProvider } from "ably/react";

// Create outside component to avoid re-creation on re-renders
function createAblyClient(userId: string) {
  return new Ably.Realtime({
    authUrl: "/api/ably-auth",
    clientId: userId,
  });
}
```

Wrap the authenticated app shell with `<AblyProvider client={client}>`. The client only needs to be created once per session.

### Client: Presence component

```typescript
import { ChannelProvider, usePresence, usePresenceListener } from "ably/react";

// Wrapper that sets up the channel for the current lesson
function LessonPresenceProvider({ lessonId, children }) {
  return (
    <ChannelProvider channelName={`lesson:${lessonId}`}>
      {children}
    </ChannelProvider>
  );
}

// The actual presence indicator
function PresenceIndicator({ lessonId, currentUser }) {
  // Enter the presence set with our user data
  usePresence<{ name: string }>(`lesson:${lessonId}`, {
    name: currentUser.name,
  });

  // Listen for others joining/leaving
  const { presenceData } = usePresenceListener<{ name: string }>(
    `lesson:${lessonId}`
  );

  // Filter out ourselves
  const others = presenceData.filter(
    (member) => member.clientId !== String(currentUser.id)
  );

  if (others.length === 0) return null;

  return <PresencePill members={others} />;
}
```

### Client: "Matt, Sarah, and 2 others" display logic

```typescript
function PresencePill({ members }) {
  const MAX_NAMED = 2;
  const named = members.slice(0, MAX_NAMED).map((m) => m.data.name);
  const remaining = members.length - named.length;

  let text: string;
  if (remaining === 0) {
    text = named.join(" and ") + (named.length === 1 ? " is" : " are") + " here";
  } else {
    text = named.join(", ") + ` and ${remaining} other${remaining === 1 ? "" : "s"} ${remaining === 1 ? "is" : "are"} here`;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      {text}
    </div>
  );
}
```

### Channel naming convention

Ably uses colons as namespace delimiters. Use `lesson:{lessonId}` as the channel name. This lets you apply channel-level permissions per namespace in the Ably dashboard if needed later.

### Disconnect behavior

| Scenario                                    | Leave detection                                          |
| ------------------------------------------- | -------------------------------------------------------- |
| User navigates away / closes tab            | Immediate (SDK fires `beforeunload`)                     |
| Network drops / crash                       | 15 seconds default (configurable via `remainPresentFor`) |
| Browser tab discarded (Chrome Memory Saver) | 15 seconds (no `beforeunload` fired)                     |

To reduce the stale-user window, set `remainPresentFor` to 5 seconds:

```typescript
new Ably.Realtime({
  authUrl: "/api/ably-auth",
  clientId: userId,
  transportParams: { remainPresentFor: "5000" },
});
```

### Route registration

Add the auth endpoint to `app/routes.ts`:

```typescript
route("api/ably-auth", "./routes/api.ably-auth.ts"),
```

---

## Integration points in the existing codebase

| Concern                             | Where it fits                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Token auth route                    | `app/routes/api.ably-auth.ts` (new resource route)                                          |
| Route registration                  | `app/routes.ts` (add one line)                                                              |
| AblyProvider                        | `app/layouts/app-layout.tsx` or authenticated layout wrapper                                |
| ChannelProvider + PresenceIndicator | Lesson page component (`app/routes/courses.$courseSlug.lessons.$lessonSlug.tsx` or similar) |
| User data (name, id)                | Already available from session/loader — pass to presence hooks                              |
| Environment variable                | `ABLY_API_KEY` in `.env`                                                                    |

No database changes. No new tables. No migrations. The entire feature is client-side + one API route.

---

## Alternatives considered

### Pusher (presence channels)

- **Strengths**: Battle-tested, purpose-built presence channels with `member_added`/`member_removed` events, 100-member cap per channel (fine for us).
- **Free tier**: 100 concurrent connections, 200k messages/day.
- **React**: Community package `@harelpls/use-pusher` provides `usePresenceChannel()` — not maintained by Pusher.
- **Server auth**: Requires a similar auth endpoint pattern.
- **Why not recommended**: React hooks are community-maintained (not first-party), slightly older DX, and the free tier is less generous than Ably. Functionally equivalent but Ably edges it on developer experience.

### PartyKit (Cloudflare Durable Objects)

- **Strengths**: Runs on Cloudflare edge (low latency), most flexible (full WebSocket control), cheapest long-term (Cloudflare free tier).
- **Free tier**: 100k requests/day on Cloudflare Workers free plan.
- **React**: `usePartySocket()` hook — low-level WebSocket, no presence abstraction.
- **Why not recommended**: No built-in presence — you write ~30 lines of server-side presence logic yourself. Requires deploying a separate service (PartyKit cloud or your own Cloudflare account). More moving parts for a feature that Ably gives you out of the box.

### Liveblocks

- **Strengths**: Best React DX (`useOthers()`, `useMyPresence()`), built for multiplayer/collaboration.
- **Free tier**: 100 monthly active users.
- **Why not recommended**: Full collaboration platform (shared storage, CRDTs, comments, notifications). Pulling in that entire abstraction for a simple presence indicator is overkill. The dependency is heavier than needed.

### Supabase Realtime

- **Strengths**: Presence built on CRDTs, can use without the full Supabase DB.
- **Free tier**: Unlimited connections but projects pause after 1 week of inactivity.
- **Why not recommended**: No React presence hooks (manual `useEffect` wiring), free tier inactivity pause is a real concern for a small app, and adding a Supabase project just for presence when the app uses SQLite is an awkward architectural fit.

---

## Summary

|                   | Ably (recommended)      | Pusher                   | PartyKit                            |
| ----------------- | ----------------------- | ------------------------ | ----------------------------------- |
| Presence built-in | Yes                     | Yes                      | No (DIY)                            |
| React hooks       | First-party             | Community                | Low-level                           |
| Free tier         | 6M msgs, 200 conns      | 200k msgs/day, 100 conns | 100k req/day                        |
| Deployment        | API keys only           | API keys only            | Separate service                    |
| New code needed   | ~1 route + ~1 component | ~1 route + ~1 component  | ~1 server + ~1 route + ~1 component |
| DB changes        | None                    | None                     | None                                |
