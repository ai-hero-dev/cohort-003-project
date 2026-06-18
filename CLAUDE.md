# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cadence is a full-stack course platform (mini Udemy) built for the AI Hero "AI Coding for Real Engineers with Claude Code" cohort. It has three user roles: **Student** (browse/purchase/take courses), **Instructor** (create/manage courses and lessons), and **Admin** (manage users, courses, categories).

## Tech Stack

- **Framework:** React Router v7 with SSR (file-based routing in `app/routes/`)
- **Language:** TypeScript 5.9
- **Database:** SQLite (`data.db` at project root) via Drizzle ORM + better-sqlite3
- **Styling:** Tailwind CSS 4 + shadcn/ui components in `app/components/ui/`
- **Testing:** Vitest (globals enabled, tsconfig paths via vite-tsconfig-paths)
- **Package Manager:** pnpm 9+ (via corepack)
- **Node:** v22+

## Sandbox Setup

When running on the Dealer Tire sandbox, set `HOST=0.0.0.0` in a `.env` file so the Vite dev server binds to all interfaces (picked up via `process.env.HOST` in `vite.config.ts`). Node 24 is available at `/usr/local/nvm/versions/node/v24.14.0/bin/` — add it to PATH before running commands. Enable pnpm via `corepack enable`.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build
pnpm test             # Run all tests (vitest run)
pnpm test:watch       # Run tests in watch mode
pnpm typecheck        # Type-check (runs react-router typegen first)
pnpm db:migrate       # Run Drizzle migrations
pnpm db:seed          # Seed database with sample data
```

Run a single test file:
```bash
pnpm test app/services/courseService.test.ts
```

## Architecture

### Routing

Routes are defined in `app/routes.ts` using React Router's `route()` helper, not filesystem conventions. Route files live in `app/routes/` and use dot-delimited naming (e.g., `courses.$slug.lessons.$lessonId.tsx`). The `layout.app.tsx` layout wraps all authenticated routes (dashboard, courses, instructor, admin, settings, team).

### Data Layer

- **Schema:** `app/db/schema.ts` — all Drizzle table definitions with TypeScript enums for `UserRole`, `CourseStatus`, `LessonProgressStatus`, `QuestionType`, `TeamMemberRole`
- **DB singleton:** `app/db/index.ts` — exports `db` (better-sqlite3 with WAL mode, foreign keys ON)
- **Drizzle config:** `drizzle.config.ts` — migrations output to `./drizzle/`

### Services

Business logic lives in `app/services/` as plain functions (not classes). Each service file owns one domain: `courseService`, `enrollmentService`, `lessonService`, `moduleService`, `purchaseService`, `quizService`, `quizScoringService`, `teamService`, `userService`, `videoTrackingService`, `categoryService`, `couponService`, `progressService`. Services import `db` directly from `~/db` and use Drizzle query builder.

### Auth / Sessions

Cookie-based sessions via `app/lib/session.ts` using React Router's `createCookieSessionStorage`. Session cookie is `cadence_session`. No external auth provider — users switch via a dev UI (`app/components/dev-ui.tsx` and `api/switch-user` route).

### Key Patterns

- Route loaders/actions call service functions directly; services handle all DB queries
- `~/` path alias maps to `app/` (configured via tsconfig paths)
- Purchasing Power Parity (PPP) pricing logic in `app/lib/ppp.ts` and `app/lib/country.server.ts`
- Markdown rendering via `app/lib/markdown.server.ts` (uses `marked` + `shiki`)
- Form validation with Zod (`app/lib/validation.ts`)
- Tests are colocated with source files (e.g., `courseService.test.ts` next to `courseService.ts`)

## Formatting

Prettier with: double quotes, 2-space indent, trailing commas (es5), semicolons, arrow parens always.
