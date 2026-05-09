# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cadence is a full-stack course platform (mini Udemy) built with React Router 7 (SSR), TypeScript, SQLite, and Drizzle ORM. It supports student enrollment, lesson viewing with video/quizzes/comments, instructor course management, and admin controls.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build
pnpm typecheck        # Type-check (runs react-router typegen first)
pnpm test             # Run all tests with Vitest
pnpm test:watch       # Tests in watch mode
pnpm db:migrate       # Apply Drizzle migrations
pnpm db:seed          # Seed database with sample data
pnpm db:generate      # Generate migration after schema changes
```

To run a single test file: `pnpm vitest run app/services/someService.test.ts`

## Architecture

### Data flow

Routes (loader/action) → Services → Drizzle ORM → SQLite (`data.db`)

There is no separate REST API. All data loading and mutations happen through React Router's `loader()` and `action()` functions in route files. The frontend uses `useFetcher()` for form submissions.

### Key directories

- `app/db/schema.ts` — All Drizzle table definitions and enums (single file)
- `app/services/` — Business logic layer; each domain has its own service file
- `app/routes/` — File-based routes containing both UI components and server loaders/actions
- `app/components/` — Shared React components; `app/components/ui/` has shadcn/ui primitives
- `app/lib/` — Utilities: `session.ts` (auth), `validation.ts` (Zod helpers), `markdown.server.ts` (rendering), `utils.ts`
- `drizzle/` — SQL migration files and metadata

### Auth & roles

Session-based auth via `cadence_session` cookie. Three roles: `Student`, `Instructor`, `Admin`. No centralized middleware — each route's loader/action checks `getCurrentUserId(request)` from `app/lib/session.ts` and verifies roles inline. Instructor routes also check course ownership (`course.instructorId`).

### Route patterns

Actions use **intent-based dispatch**: a single `action()` handles multiple operations via a hidden `intent` form field, validated with Zod discriminated unions. Example: the instructor route handles `update-title`, `add-module`, `delete-lesson`, etc. all in one action.

### Validation

Three Zod helpers in `app/lib/validation.ts`: `parseFormData()`, `parseParams()`, `parseJsonBody()`. Route params are validated with `parseParams(params, schema)`. Form data with `parseFormData(formData, schema)`.

### Path alias

`~/*` maps to `app/*` (configured in tsconfig.json).

## Testing patterns

Tests live alongside services as `*.test.ts` files. Each test file:
1. Creates an in-memory SQLite DB via `createTestDb()` from `app/test/setup.ts`
2. Mocks `~/db` with `vi.mock` so the service uses the test DB
3. Seeds base data (user, instructor, category, course) via `seedBaseData(testDb)`
4. The `vi.mock` must appear before importing the service under test

## Database changes

When modifying `app/db/schema.ts`:
1. Edit the schema
2. Run `pnpm db:generate` to create a migration
3. Run `pnpm db:migrate` to apply it


When you have a function with more than one parameter with the same type, use an object parameter instead of positional parameters:

```ts

// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};

---

Anything marked as a service by the name of the file, for instance, auth-token-service.ts, should have tests written for them in an accompanying .test.ts file.
