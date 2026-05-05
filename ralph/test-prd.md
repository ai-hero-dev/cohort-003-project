# PRD: Add a hello route

## Context
Testing the Ralph AFK loop on a minimal task.

## Task
Add a new file `app/routes/hello.tsx` that renders a React component saying "Hello from Ralph!".

Wire it into `app/routes.ts` (React Router v7 file-based routing) so that visiting `/hello` renders the component.

## Success criteria
- [ ] `app/routes/hello.tsx` exists and exports a default React component
- [ ] Route is registered in `app/routes.ts`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (or no test is required if none exist for this route)

## Out of scope
- Styling beyond a simple `<h1>` tag
- Tests for the new route (keep it minimal)
