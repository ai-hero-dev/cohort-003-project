import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "../app/db/schema";
import {
  UserRole,
  CourseStatus,
  LessonProgressStatus,
  QuestionType,
  TeamMemberRole,
} from "../app/db/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../drizzle");

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// ─── Helpers ───

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Seed Data ───

async function seed() {
  console.log("Seeding database...");

  // Drop and recreate tables for a clean seed
  sqlite.exec(`
    DROP TABLE IF EXISTS video_watch_events;
    DROP TABLE IF EXISTS quiz_answers;
    DROP TABLE IF EXISTS quiz_attempts;
    DROP TABLE IF EXISTS quiz_options;
    DROP TABLE IF EXISTS quiz_questions;
    DROP TABLE IF EXISTS quizzes;
    DROP TABLE IF EXISTS lesson_progress;
    DROP TABLE IF EXISTS coupons;
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS purchases;
    DROP TABLE IF EXISTS enrollments;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS modules;
    DROP TABLE IF EXISTS courses;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS __drizzle_migrations;
  `);

  // Create tables using the same Drizzle migrations as the live database
  migrate(db, { migrationsFolder });

  console.log("Tables created.");

  // ─── Users ───
  // 1 admin, 2 instructors, 5 students

  const [admin] = db
    .insert(schema.users)
    .values({
      name: "Alex Rivera",
      email: "alex.rivera@ralph.dev",
      role: UserRole.Admin,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=alex",
      createdAt: daysAgo(120),
    })
    .returning()
    .all();

  const [instructor1] = db
    .insert(schema.users)
    .values({
      name: "Sarah Chen",
      email: "sarah.chen@ralph.dev",
      role: UserRole.Instructor,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=sarah",
      bio: "Senior TypeScript engineer with 10 years of experience building large-scale web applications. Previously at Stripe and Vercel. Passionate about type safety and developer tooling.",
      createdAt: daysAgo(100),
    })
    .returning()
    .all();

  const [instructor2] = db
    .insert(schema.users)
    .values({
      name: "Marcus Johnson",
      email: "marcus.johnson@ralph.dev",
      role: UserRole.Instructor,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=marcus",
      bio: "Full-stack developer and API architect specializing in Node.js and cloud infrastructure. Has built and scaled APIs serving millions of requests daily. Conference speaker and open-source contributor.",
      createdAt: daysAgo(95),
    })
    .returning()
    .all();

  const students = db
    .insert(schema.users)
    .values([
      {
        name: "Emma Wilson",
        email: "emma.wilson@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=emma",
        createdAt: daysAgo(60),
      },
      {
        name: "James Park",
        email: "james.park@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=james",
        createdAt: daysAgo(55),
      },
      {
        name: "Olivia Martinez",
        email: "olivia.martinez@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=olivia",
        createdAt: daysAgo(45),
      },
      {
        name: "Liam Thompson",
        email: "liam.thompson@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=liam",
        createdAt: daysAgo(30),
      },
      {
        name: "Sophia Davis",
        email: "sophia.davis@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=sophia",
        createdAt: daysAgo(20),
      },
    ])
    .returning()
    .all();

  const [bossy] = db
    .insert(schema.users)
    .values({
      name: "Bossy McBossface",
      email: "bossy.mcbossface@student.dev",
      role: UserRole.Student,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=bossy",
      createdAt: daysAgo(40),
    })
    .returning()
    .all();

  console.log(
    `Created ${1 + 2 + students.length + 1} users (1 admin, 2 instructors, ${students.length + 1} students).`
  );

  // ─── Categories ───

  const categoriesData = db
    .insert(schema.categories)
    .values([
      { name: "Programming", slug: "programming" },
      { name: "Design", slug: "design" },
      { name: "Data Science", slug: "data-science" },
      { name: "DevOps", slug: "devops" },
      { name: "Marketing", slug: "marketing" },
    ])
    .returning()
    .all();

  const catBySlug = Object.fromEntries(categoriesData.map((c) => [c.slug, c]));

  console.log(`Created ${categoriesData.length} categories.`);

  // ─── Course 1: Introduction to TypeScript (Sarah Chen) ───

  const [course1] = db
    .insert(schema.courses)
    .values({
      title: "Introduction to TypeScript",
      slug: "introduction-to-typescript",
      description:
        "Master TypeScript from the ground up. Learn type annotations, interfaces, generics, and advanced patterns that will make your JavaScript code safer and more maintainable. Includes hands-on projects and real-world examples.",
      salesCopy: `## Why TypeScript?

If you've been writing JavaScript and wondering why your code breaks in production with cryptic "undefined is not a function" errors, TypeScript is the answer you've been looking for.

TypeScript adds a powerful type system on top of JavaScript that catches bugs before they ever reach your users. It's not just about finding errors — it's about writing code with confidence, knowing that your editor understands your code as well as you do.

## What You'll Learn

This course takes you from zero TypeScript knowledge to confidently using advanced patterns in real projects. We start with the basics — type annotations, interfaces, and simple generics — and build up to discriminated unions, mapped types, conditional types, and template literal types.

Every concept is taught through practical examples. You won't just learn what a generic is — you'll learn when and why to use one, and how to constrain them for maximum type safety.

### Course Highlights

- **19 lessons** across 5 modules, from setup to advanced patterns
- **Hands-on quizzes** to test your understanding as you go
- **Real-world React examples** showing TypeScript in production code
- **Error handling patterns** using Result types and discriminated unions

## Who Is This Course For?

This course is perfect for JavaScript developers who want to level up their code quality. Whether you're working on a personal project or a large team codebase, TypeScript will make your development experience faster, safer, and more enjoyable.

No prior TypeScript experience required — just a solid understanding of JavaScript fundamentals.

## What Makes This Course Different

Unlike courses that just show you syntax, this course focuses on *thinking in types*. You'll learn to design your types first and let them guide your implementation, catching entire categories of bugs at compile time instead of runtime.

By the end of this course, you'll understand why TypeScript has become the default choice for serious JavaScript development.`,
      instructorId: instructor1.id,
      categoryId: catBySlug["programming"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-typescript.svg",
      price: 4999,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(10),
    })
    .returning()
    .all();

  // Course 1 modules and lessons
  const c1Modules = [
    {
      title: "Getting Started with TypeScript",
      lessons: [
        {
          title: "What is TypeScript?",
          duration: 8,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          githubRepoUrl:
            "https://github.com/total-typescript/ts-intro-what-is-ts",
          content: `## What is TypeScript?

TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds optional static typing and class-based object-oriented programming to the language.

### Why TypeScript?

- Catch errors at compile time instead of runtime
- Better IDE support with autocompletion
- Easier to refactor large codebases
- Self-documenting code through types`,
        },
        {
          title: "Installing and Configuring TypeScript",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Setting Up TypeScript

Let's get TypeScript installed and configured in your development environment.

### Installation

\`\`\`bash
npm install -g typescript
tsc --version
\`\`\`

### tsconfig.json

The \`tsconfig.json\` file configures the TypeScript compiler options for your project.`,
        },
        {
          title: "Your First TypeScript Program",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          githubRepoUrl:
            "https://github.com/total-typescript/ts-intro-first-program",
          content: `## Hello, TypeScript!

Let's write our first TypeScript program and see the compilation process in action.

\`\`\`typescript
function greet(name: string): string {
  return \\\`Hello, \\\${name}!\\\`;
}

console.log(greet('World'));
\`\`\``,
        },
      ],
    },
    {
      title: "Type System Fundamentals",
      lessons: [
        {
          title: "Primitive Types",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Primitive Types

TypeScript supports the same primitive types as JavaScript, plus a few extras.

- \`string\` — text values
- \`number\` — numeric values (integer and float)
- \`boolean\` — true/false
- \`null\` and \`undefined\`
- \`symbol\` and \`bigint\``,
        },
        {
          title: "Arrays and Tuples",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Arrays and Tuples

Learn how to type arrays and fixed-length tuples in TypeScript.

\`\`\`typescript
const numbers: number[] = [1, 2, 3];
const pair: [string, number] = ['age', 25];
\`\`\``,
        },
        {
          title: "Type Aliases and Interfaces",
          duration: 18,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Type Aliases vs Interfaces

Both type aliases and interfaces let you define custom types, but they have subtle differences.

### Type Alias

\`\`\`typescript
type User = {
  name: string;
  age: number;
};
\`\`\`

### Interface

\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\``,
        },
        {
          title: "Union and Intersection Types",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Union and Intersection Types

Combine types in powerful ways using unions (\`|\`) and intersections (\`&\`).

\`\`\`typescript
type StringOrNumber = string | number;
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;
\`\`\``,
        },
      ],
    },
    {
      title: "Functions and Generics",
      lessons: [
        {
          title: "Function Types",
          duration: 11,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Typing Functions

TypeScript lets you type function parameters, return values, and even the function itself.

\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}

const multiply: (a: number, b: number) => number = (a, b) => a * b;
\`\`\``,
        },
        {
          title: "Generics Basics",
          duration: 20,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          githubRepoUrl:
            "https://github.com/total-typescript/ts-generics-basics",
          content: `## Introduction to Generics

Generics let you write reusable code that works with multiple types while maintaining type safety.

\`\`\`typescript
function identity<T>(value: T): T {
  return value;
}

const str = identity('hello'); // string
const num = identity(42); // number
\`\`\``,
        },
        {
          title: "Generic Constraints",
          duration: 16,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Constraining Generics

Use \`extends\` to limit what types a generic can accept.

\`\`\`typescript
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}

getLength('hello'); // OK
getLength([1, 2, 3]); // OK
// getLength(42); // Error!
\`\`\``,
        },
        {
          title: "Utility Types",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Built-in Utility Types

TypeScript provides several utility types for common type transformations.

- \`Partial<T>\` — makes all properties optional
- \`Required<T>\` — makes all properties required
- \`Pick<T, K>\` — selects specific properties
- \`Omit<T, K>\` — excludes specific properties
- \`Record<K, V>\` — creates an object type with keys K and values V`,
        },
      ],
    },
    {
      title: "Advanced Patterns",
      lessons: [
        {
          title: "Discriminated Unions",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Discriminated Unions

A pattern that combines union types with literal types to create type-safe tagged unions.

\`\`\`typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rectangle': return shape.width * shape.height;
  }
}
\`\`\``,
        },
        {
          title: "Type Guards and Narrowing",
          duration: 13,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Type Guards

Type guards are expressions that narrow a type within a conditional block.

\`\`\`typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function process(value: string | number) {
  if (isString(value)) {
    console.log(value.toUpperCase()); // string
  } else {
    console.log(value.toFixed(2)); // number
  }
}
\`\`\``,
        },
        {
          title: "Mapped Types",
          duration: 17,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Mapped Types

Create new types by transforming each property of an existing type.

\`\`\`typescript
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};
\`\`\``,
        },
        {
          title: "Conditional Types",
          duration: 19,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Conditional Types

Types that depend on a condition, similar to ternary expressions but at the type level.

\`\`\`typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<'hello'>; // true
type B = IsString<42>; // false
\`\`\``,
        },
        {
          title: "Template Literal Types",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Template Literal Types

Construct string types using template literal syntax.

\`\`\`typescript
type Color = 'red' | 'blue' | 'green';
type CSSProperty = \\\`color-\\\${Color}\\\`;
// 'color-red' | 'color-blue' | 'color-green'
\`\`\``,
        },
      ],
    },
    {
      title: "Real-World TypeScript",
      lessons: [
        {
          title: "TypeScript with React",
          duration: 22,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          githubRepoUrl:
            "https://github.com/total-typescript/ts-react-examples",
          content: `## TypeScript + React

Learn how to use TypeScript effectively in React applications.

\`\`\`typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick} className={variant}>{label}</button>;
}
\`\`\``,
        },
        {
          title: "Error Handling Patterns",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
          content: `## Error Handling in TypeScript

Strategies for handling errors in a type-safe way.

\`\`\`typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number> {
  if (b === 0) return { ok: false, error: new Error('Division by zero') };
  return { ok: true, value: a / b };
}
\`\`\``,
        },
        {
          title: "Course Wrap-Up and Next Steps",
          duration: 8,
          content: `## Congratulations!

You've completed the Introduction to TypeScript course. Here's what we covered:

- TypeScript fundamentals and type system
- Functions, generics, and utility types
- Advanced patterns like discriminated unions and mapped types
- Real-world usage with React

### Next Steps

Practice by converting an existing JavaScript project to TypeScript. Start with strict mode enabled and work through the errors one by one.`,
        },
      ],
    },
  ];

  const course1LessonIds: number[] = [];

  for (let mi = 0; mi < c1Modules.length; mi++) {
    const modData = c1Modules[mi];
    const [mod] = db
      .insert(schema.modules)
      .values({
        courseId: course1.id,
        title: modData.title,
        position: mi + 1,
        createdAt: daysAgo(90 - mi),
      })
      .returning()
      .all();

    for (let li = 0; li < modData.lessons.length; li++) {
      const lessonData = modData.lessons[li];
      const [lesson] = db
        .insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: lessonData.title,
          content: lessonData.content,
          videoUrl: lessonData.videoUrl ?? null,
          githubRepoUrl:
            ("githubRepoUrl" in lessonData ? lessonData.githubRepoUrl : null) ??
            null,
          position: li + 1,
          durationMinutes: lessonData.duration,
          createdAt: daysAgo(90 - mi),
        })
        .returning()
        .all();
      course1LessonIds.push(lesson.id);
    }
  }

  console.log(
    `Created course "${course1.title}" with ${c1Modules.length} modules and ${course1LessonIds.length} lessons.`
  );

  // ─── Course 2: Building REST APIs with Node.js (Marcus Johnson) ───

  const [course2] = db
    .insert(schema.courses)
    .values({
      title: "Building REST APIs with Node.js",
      slug: "building-rest-apis-with-nodejs",
      description:
        "Learn to build production-ready REST APIs using Node.js and Express. Covers routing, middleware, authentication, database integration, error handling, testing, and deployment best practices.",
      salesCopy: `## Build APIs That Actually Work in Production

Most API tutorials teach you how to return JSON from an endpoint. This course teaches you how to build APIs that handle real traffic, real users, and real problems — the kind you'll face on the job.

From your first Express route to deploying a production-ready API, you'll learn every layer of the stack: routing, middleware, validation, authentication, database integration, testing, and deployment.

## What You'll Build

Throughout this course, you'll build a complete REST API from scratch. Not a toy project — a properly structured API with authentication, input validation, error handling, pagination, and tests.

### Topics Covered

- **Express fundamentals** — routing, middleware chains, request/response lifecycle
- **Input validation with Zod** — never trust user input, validate everything
- **Database integration** — Drizzle ORM with SQLite, CRUD operations, transactions
- **JWT authentication** — secure your endpoints with industry-standard tokens
- **Security hardening** — rate limiting, CORS, security headers with Helmet
- **Testing** — unit tests with Vitest, integration tests with Supertest
- **Deployment** — environment config, process management, CI/CD basics

## Who Should Take This Course?

This course is designed for developers who know JavaScript and want to build backend services. If you've built frontends but never created your own API, this is the perfect next step.

You should be comfortable with JavaScript basics — functions, async/await, and working with objects. No backend experience required.

## Why Node.js for APIs?

Node.js lets you use the same language on both frontend and backend. Its non-blocking I/O model handles concurrent requests efficiently, and the npm ecosystem gives you battle-tested libraries for every common backend task.

Express is the most widely-used Node.js web framework for a reason — it's minimal, flexible, and has a massive community. The patterns you learn here will transfer to any Node.js framework.

## 20 Lessons, 5 Modules, Zero Fluff

Every lesson is focused and practical. No 45-minute lectures where 40 minutes are filler. Each lesson teaches one concept, shows you how to implement it, and moves on.`,
      instructorId: instructor2.id,
      categoryId: catBySlug["programming"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 5999,
      createdAt: daysAgo(75),
      updatedAt: daysAgo(5),
    })
    .returning()
    .all();

  const c2Modules = [
    {
      title: "API Fundamentals",
      lessons: [
        {
          title: "What is a REST API?",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## REST API Fundamentals

REST (Representational State Transfer) is an architectural style for designing networked applications. RESTful APIs use HTTP methods to perform CRUD operations on resources.

### Key Principles

- Stateless communication
- Resource-based URLs
- Standard HTTP methods (GET, POST, PUT, DELETE)
- JSON as the data format`,
        },
        {
          title: "Setting Up Express",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          githubRepoUrl:
            "https://github.com/total-typescript/rest-api-express-setup",
          content: `## Express.js Setup

Express is the most popular Node.js web framework for building APIs.

\`\`\`javascript
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
\`\`\``,
        },
        {
          title: "HTTP Methods and Status Codes",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## HTTP Methods

- **GET** — Retrieve resources (200 OK)
- **POST** — Create resources (201 Created)
- **PUT** — Update resources (200 OK)
- **DELETE** — Remove resources (204 No Content)

### Common Status Codes

- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 404 Not Found
- 500 Internal Server Error`,
        },
        {
          title: "Request and Response Objects",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Working with Request & Response

Express provides rich request and response objects for handling HTTP communication.

\`\`\`javascript
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  // ... create user
  res.status(201).json({ id: 1, name, email });
});
\`\`\``,
        },
      ],
    },
    {
      title: "Routing and Middleware",
      lessons: [
        {
          title: "Express Router",
          duration: 13,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Organizing Routes

Use Express Router to organize your API endpoints into logical groups.

\`\`\`javascript
import { Router } from 'express';

const userRouter = Router();
userRouter.get('/', getUsers);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);

app.use('/api/users', userRouter);
\`\`\``,
        },
        {
          title: "Custom Middleware",
          duration: 16,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Middleware in Express

Middleware functions have access to the request, response, and next function in the request-response cycle.

\`\`\`javascript
function logger(req, res, next) {
  console.log(\\\`\\\${req.method} \\\${req.url}\\\`);
  next();
}

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
\`\`\``,
        },
        {
          title: "Error Handling Middleware",
          duration: 11,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Centralized Error Handling

Express supports error-handling middleware with four parameters.

\`\`\`javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});
\`\`\``,
        },
        {
          title: "Validation with Zod",
          duration: 18,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Request Validation

Use Zod to validate request bodies, query parameters, and URL parameters.

\`\`\`javascript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional()
});

app.post('/api/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  // ... create user with result.data
});
\`\`\``,
        },
      ],
    },
    {
      title: "Database Integration",
      lessons: [
        {
          title: "Connecting to a Database",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Database Setup

Learn how to connect your API to a database using an ORM.

\`\`\`javascript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('app.db');
const db = drizzle(sqlite);
\`\`\``,
        },
        {
          title: "CRUD Operations",
          duration: 20,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          githubRepoUrl:
            "https://github.com/total-typescript/rest-api-crud-operations",
          content: `## Building CRUD Endpoints

Implement Create, Read, Update, Delete operations for your API resources.

\`\`\`javascript
// Create
app.post('/api/posts', async (req, res) => {
  const post = await db.insert(posts).values(req.body).returning();
  res.status(201).json(post);
});

// Read
app.get('/api/posts/:id', async (req, res) => {
  const post = await db.select().from(posts).where(eq(posts.id, req.params.id));
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});
\`\`\``,
        },
        {
          title: "Pagination and Filtering",
          duration: 15,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Pagination

Implement cursor-based and offset-based pagination for list endpoints.

\`\`\`javascript
app.get('/api/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const results = await db.select().from(posts)
    .limit(limit).offset(offset);
  res.json({ data: results, page, limit });
});
\`\`\``,
        },
        {
          title: "Transactions",
          duration: 12,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Database Transactions

Use transactions to ensure data consistency when multiple operations must succeed or fail together.

\`\`\`javascript
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values({ userId, total }).returning();
  for (const item of items) {
    await tx.insert(orderItems).values({ orderId: order.id, ...item });
  }
});
\`\`\``,
        },
      ],
    },
    {
      title: "Authentication and Security",
      lessons: [
        {
          title: "JWT Authentication",
          duration: 22,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## JSON Web Tokens

Implement JWT-based authentication for your API.

\`\`\`javascript
import jwt from 'jsonwebtoken';

app.post('/api/login', async (req, res) => {
  const user = await findUser(req.body.email);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
  res.json({ token });
});
\`\`\``,
        },
        {
          title: "Rate Limiting",
          duration: 10,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Rate Limiting

Protect your API from abuse by limiting the number of requests per client.

\`\`\`javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});

app.use('/api/', limiter);
\`\`\``,
        },
        {
          title: "CORS and Security Headers",
          duration: 11,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## CORS Configuration

Configure Cross-Origin Resource Sharing for your API.

\`\`\`javascript
import cors from 'cors';
import helmet from 'helmet';

app.use(cors({ origin: 'https://yourapp.com' }));
app.use(helmet());
\`\`\``,
        },
      ],
    },
    {
      title: "Testing and Deployment",
      lessons: [
        {
          title: "Unit Testing API Routes",
          duration: 18,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Testing with Vitest and Supertest

Write tests for your API endpoints using Vitest and Supertest.

\`\`\`javascript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/users', () => {
  it('returns a list of users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});
\`\`\``,
        },
        {
          title: "Integration Testing",
          duration: 16,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Integration Tests

Test complete request flows including database interactions.

\`\`\`javascript
describe('User CRUD', () => {
  it('creates and retrieves a user', async () => {
    const createRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'test@test.com' });
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(\\\`/api/users/\\\${createRes.body.id}\\\`);
    expect(getRes.body.name).toBe('Test');
  });
});
\`\`\``,
        },
        {
          title: "Environment Variables and Config",
          duration: 9,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Configuration Management

Manage environment-specific settings with environment variables.

\`\`\`javascript
const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || 'sqlite:app.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret'
};
\`\`\``,
        },
        {
          title: "Deploying Your API",
          duration: 14,
          videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
          content: `## Deployment

Deploy your Node.js API to production. We'll cover various hosting options and best practices.

### Deployment Checklist

- Set NODE_ENV=production
- Use a process manager (PM2)
- Set up logging and monitoring
- Configure HTTPS
- Set up CI/CD pipeline`,
        },
        {
          title: "Course Wrap-Up",
          duration: 7,
          content: `## Congratulations!

You've completed the Building REST APIs course. You now have the skills to build, test, and deploy production-ready APIs with Node.js.

### Key Takeaways

- RESTful design principles
- Express routing and middleware
- Database integration and transactions
- Authentication and security
- Testing and deployment`,
        },
      ],
    },
  ];

  const course2LessonIds: number[] = [];

  for (let mi = 0; mi < c2Modules.length; mi++) {
    const modData = c2Modules[mi];
    const [mod] = db
      .insert(schema.modules)
      .values({
        courseId: course2.id,
        title: modData.title,
        position: mi + 1,
        createdAt: daysAgo(75 - mi),
      })
      .returning()
      .all();

    for (let li = 0; li < modData.lessons.length; li++) {
      const lessonData = modData.lessons[li];
      const [lesson] = db
        .insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: lessonData.title,
          content: lessonData.content,
          videoUrl: lessonData.videoUrl ?? null,
          githubRepoUrl:
            ("githubRepoUrl" in lessonData ? lessonData.githubRepoUrl : null) ??
            null,
          position: li + 1,
          durationMinutes: lessonData.duration,
          createdAt: daysAgo(75 - mi),
        })
        .returning()
        .all();
      course2LessonIds.push(lesson.id);
    }
  }

  console.log(
    `Created course "${course2.title}" with ${c2Modules.length} modules and ${course2LessonIds.length} lessons.`
  );

  // ─── Quizzes ───
  // Add quizzes to some lessons in both courses

  // Quiz 1: TypeScript Basics Quiz (attached to "Your First TypeScript Program", lesson 3 of course 1)
  const [quiz1] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course1LessonIds[2], // "Your First TypeScript Program"
      title: "TypeScript Basics Quiz",
      passingScore: 0.7,
    })
    .returning()
    .all();

  const quiz1Questions = [
    {
      text: "What does TypeScript compile to?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "JavaScript", correct: true },
        { text: "WebAssembly", correct: false },
        { text: "Java bytecode", correct: false },
        { text: "Machine code", correct: false },
      ],
    },
    {
      text: "TypeScript is a superset of JavaScript.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: true },
        { text: "False", correct: false },
      ],
    },
    {
      text: "Which file configures the TypeScript compiler?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "tsconfig.json", correct: true },
        { text: "package.json", correct: false },
        { text: "typescript.config.js", correct: false },
        { text: ".tsrc", correct: false },
      ],
    },
  ];

  const quiz1OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz1Questions.length; qi++) {
    const q = quiz1Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz1.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz1OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  // Quiz 2: Generics Quiz (attached to "Generics Basics", lesson index 5 in course 1)
  const [quiz2] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course1LessonIds[7], // "Generics Basics" (module 3, lesson 2)
      title: "Generics Knowledge Check",
      passingScore: 0.6,
    })
    .returning()
    .all();

  const quiz2Questions = [
    {
      text: "What is the primary benefit of generics?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "Code reusability with type safety", correct: true },
        { text: "Faster execution speed", correct: false },
        { text: "Smaller bundle size", correct: false },
        { text: "Better error messages", correct: false },
      ],
    },
    {
      text: "Generic type parameters can be constrained using the 'extends' keyword.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: true },
        { text: "False", correct: false },
      ],
    },
  ];

  const quiz2OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz2Questions.length; qi++) {
    const q = quiz2Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz2.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz2OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  // Quiz 3: REST API Basics (attached to "HTTP Methods and Status Codes", lesson index 2 in course 2)
  const [quiz3] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course2LessonIds[2], // "HTTP Methods and Status Codes"
      title: "HTTP Methods Quiz",
      passingScore: 0.7,
    })
    .returning()
    .all();

  const quiz3Questions = [
    {
      text: "Which HTTP method is used to create a new resource?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "POST", correct: true },
        { text: "GET", correct: false },
        { text: "PUT", correct: false },
        { text: "PATCH", correct: false },
      ],
    },
    {
      text: "A 404 status code means the server encountered an internal error.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: false },
        { text: "False", correct: true },
      ],
    },
    {
      text: "Which status code indicates successful resource creation?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "201 Created", correct: true },
        { text: "200 OK", correct: false },
        { text: "204 No Content", correct: false },
        { text: "202 Accepted", correct: false },
      ],
    },
  ];

  const quiz3OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz3Questions.length; qi++) {
    const q = quiz3Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz3.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz3OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  console.log("Created 3 quizzes with questions and options.");

  // ─── Enrollments ───
  // Varied enrollment patterns:
  // - Emma: enrolled in both courses (nearly complete in course 1, mid-way in course 2)
  // - James: enrolled in course 1 only (completed)
  // - Olivia: enrolled in both courses (just started course 1, mid-way in course 2)
  // - Liam: enrolled in course 2 only (just started, abandoned)
  // - Sophia: enrolled in course 1 only (recently enrolled, barely started)

  db.insert(schema.enrollments)
    .values([
      { userId: students[0].id, courseId: course1.id, enrolledAt: daysAgo(50) },
      { userId: students[0].id, courseId: course2.id, enrolledAt: daysAgo(40) },
      {
        userId: students[1].id,
        courseId: course1.id,
        enrolledAt: daysAgo(45),
        completedAt: daysAgo(10),
      },
      { userId: students[2].id, courseId: course1.id, enrolledAt: daysAgo(35) },
      { userId: students[2].id, courseId: course2.id, enrolledAt: daysAgo(30) },
      { userId: students[3].id, courseId: course2.id, enrolledAt: daysAgo(25) },
      { userId: students[4].id, courseId: course1.id, enrolledAt: daysAgo(15) },
    ])
    .run();

  console.log("Created 7 enrollments.");

  // ─── Lesson Progress ───

  // Helper to mark lessons as complete
  function markComplete(
    userId: number,
    lessonId: number,
    daysAgoCompleted: number
  ) {
    db.insert(schema.lessonProgress)
      .values({
        userId,
        lessonId,
        status: LessonProgressStatus.Completed,
        completedAt: daysAgo(daysAgoCompleted),
      })
      .run();
  }

  function markInProgress(userId: number, lessonId: number) {
    db.insert(schema.lessonProgress)
      .values({
        userId,
        lessonId,
        status: LessonProgressStatus.InProgress,
      })
      .run();
  }

  // Emma (students[0]) — nearly complete in course 1 (17 of 19 lessons done)
  for (let i = 0; i < 17; i++) {
    markComplete(students[0].id, course1LessonIds[i], 50 - i);
  }
  markInProgress(students[0].id, course1LessonIds[17]);

  // Emma — mid-way through course 2 (10 of 20 lessons done)
  for (let i = 0; i < 10; i++) {
    markComplete(students[0].id, course2LessonIds[i], 40 - i);
  }
  markInProgress(students[0].id, course2LessonIds[10]);

  // James (students[1]) — completed all of course 1
  for (let i = 0; i < course1LessonIds.length; i++) {
    markComplete(students[1].id, course1LessonIds[i], 45 - i);
  }

  // Olivia (students[2]) — just started course 1 (3 lessons done)
  for (let i = 0; i < 3; i++) {
    markComplete(students[2].id, course1LessonIds[i], 30 - i);
  }
  markInProgress(students[2].id, course1LessonIds[3]);

  // Olivia — mid-way through course 2 (8 lessons done)
  for (let i = 0; i < 8; i++) {
    markComplete(students[2].id, course2LessonIds[i], 28 - i);
  }

  // Liam (students[3]) — just started course 2, abandoned (2 lessons done)
  for (let i = 0; i < 2; i++) {
    markComplete(students[3].id, course2LessonIds[i], 22 - i);
  }

  // Sophia (students[4]) — barely started course 1 (1 lesson done)
  markComplete(students[4].id, course1LessonIds[0], 12);
  markInProgress(students[4].id, course1LessonIds[1]);

  console.log("Created lesson progress records.");

  // ─── Quiz Attempts ───

  // Helper to record a quiz attempt with answers
  function recordQuizAttempt(
    userId: number,
    quizId: number,
    optionIds: { questionId: number; optionId: number; correct: boolean }[],
    selectedCorrectIndices: number[], // which questions (0-based) the student got right
    attemptDaysAgo: number
  ) {
    const totalQuestions = new Set(optionIds.map((o) => o.questionId)).size;
    const correctCount = selectedCorrectIndices.length;
    const score = correctCount / totalQuestions;

    // Determine passing based on quiz passingScore (we'll just use 0.7 as default)
    const passed = score >= 0.7;

    const [attempt] = db
      .insert(schema.quizAttempts)
      .values({
        userId,
        quizId,
        score,
        passed,
        attemptedAt: daysAgo(attemptDaysAgo),
      })
      .returning()
      .all();

    // Build answer selections
    const questionIds = [...new Set(optionIds.map((o) => o.questionId))];
    for (let qi = 0; qi < questionIds.length; qi++) {
      const qId = questionIds[qi];
      const qOptions = optionIds.filter((o) => o.questionId === qId);
      let selectedOption: (typeof qOptions)[0];

      if (selectedCorrectIndices.includes(qi)) {
        // Pick correct answer
        selectedOption = qOptions.find((o) => o.correct)!;
      } else {
        // Pick wrong answer
        selectedOption = qOptions.find((o) => !o.correct)!;
      }

      db.insert(schema.quizAnswers)
        .values({
          attemptId: attempt.id,
          questionId: qId,
          selectedOptionId: selectedOption.optionId,
        })
        .run();
    }
  }

  // Emma — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[0].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 35);

  // Emma — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[0].id, quiz2.id, quiz2OptionIds, [0, 1], 30);

  // Emma — passed quiz 3 (2/3 correct, just barely at 67% with 70% passing = fail, then retake)
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 2], 28);
  // Retake — all correct
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 27);

  // James — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[1].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 40);

  // James — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[1].id, quiz2.id, quiz2OptionIds, [0, 1], 35);

  // Olivia — failed quiz 1 first attempt (1/3 correct), then passed on retry (3/3)
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0], 25);
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 24);

  // Olivia — passed quiz 3 (3/3 correct)
  recordQuizAttempt(students[2].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 20);

  // Sophia — failed quiz 1 (1/3 correct, hasn't retaken yet)
  recordQuizAttempt(students[4].id, quiz1.id, quiz1OptionIds, [1], 10);

  console.log("Created quiz attempts and answers.");

  // ─── Video Watch Events ───
  // Sprinkle some realistic watch events

  function addWatchEvent(
    userId: number,
    lessonId: number,
    eventType: string,
    positionSeconds: number,
    eventDaysAgo: number
  ) {
    db.insert(schema.videoWatchEvents)
      .values({
        userId,
        lessonId,
        eventType,
        positionSeconds,
        createdAt: daysAgo(eventDaysAgo),
      })
      .run();
  }

  // Emma watching course 1 lesson 1 (8 min video)
  addWatchEvent(students[0].id, course1LessonIds[0], "play", 0, 50);
  addWatchEvent(students[0].id, course1LessonIds[0], "pause", 180, 50);
  addWatchEvent(students[0].id, course1LessonIds[0], "play", 180, 49);
  addWatchEvent(students[0].id, course1LessonIds[0], "ended", 480, 49);

  // James watching course 1 lesson 1
  addWatchEvent(students[1].id, course1LessonIds[0], "play", 0, 45);
  addWatchEvent(students[1].id, course1LessonIds[0], "ended", 480, 45);

  // Liam started watching course 2 lesson 1 but stopped mid-way
  addWatchEvent(students[3].id, course2LessonIds[0], "play", 0, 22);
  addWatchEvent(students[3].id, course2LessonIds[0], "pause", 300, 22);
  addWatchEvent(students[3].id, course2LessonIds[0], "seek", 150, 21);
  addWatchEvent(students[3].id, course2LessonIds[0], "play", 150, 21);
  addWatchEvent(students[3].id, course2LessonIds[0], "pause", 360, 21);

  console.log("Created video watch events.");

  // ─── Purchases ───
  // Individual purchases for enrolled students

  const [purchase1] = db
    .insert(schema.purchases)
    .values({
      userId: students[0].id, // Emma — bought course 1 individually
      courseId: course1.id,
      pricePaid: 4999,
      country: "US",
      createdAt: daysAgo(50),
    })
    .returning()
    .all();

  db.insert(schema.purchases)
    .values({
      userId: students[0].id, // Emma — bought course 2 individually
      courseId: course2.id,
      pricePaid: 5999,
      country: "US",
      createdAt: daysAgo(40),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[1].id, // James — bought course 1 with PPP discount (India)
      courseId: course1.id,
      pricePaid: 2500,
      country: "IN",
      createdAt: daysAgo(45),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[2].id, // Olivia — bought course 1 individually
      courseId: course1.id,
      pricePaid: 4999,
      country: "US",
      createdAt: daysAgo(35),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[4].id, // Sophia — bought course 1 individually
      courseId: course1.id,
      pricePaid: 4999,
      country: "US",
      createdAt: daysAgo(15),
    })
    .run();

  console.log("Created 5 individual purchases.");

  // ─── Teams, Team Members, and Coupons ───
  // Bossy McBossface bought 5 team seats for course 2; Olivia and Liam redeemed coupons

  const [team1] = db
    .insert(schema.teams)
    .values({ createdAt: daysAgo(30) })
    .returning()
    .all();

  db.insert(schema.teamMembers)
    .values({
      teamId: team1.id,
      userId: bossy.id,
      role: TeamMemberRole.Admin,
      createdAt: daysAgo(30),
    })
    .run();

  // Team purchase by Bossy McBossface for course 2 (5 seats)
  const [teamPurchase] = db
    .insert(schema.purchases)
    .values({
      userId: bossy.id,
      courseId: course2.id,
      pricePaid: 5999 * 5,
      country: "US",
      createdAt: daysAgo(30),
    })
    .returning()
    .all();

  // Generate 5 coupons for the team purchase
  const couponCodes = [
    "TEAM-NODEJS-A1B2C3",
    "TEAM-NODEJS-D4E5F6",
    "TEAM-NODEJS-G7H8I9",
    "TEAM-NODEJS-J0K1L2",
    "TEAM-NODEJS-M3N4O5",
  ];

  const seededCoupons = db
    .insert(schema.coupons)
    .values(
      couponCodes.map((code) => ({
        teamId: team1.id,
        courseId: course2.id,
        code,
        purchaseId: teamPurchase.id,
        createdAt: daysAgo(30),
      }))
    )
    .returning()
    .all();

  // Redeem 2 coupons: Olivia (students[2]) and Liam (students[3])
  // Olivia already has an enrollment for course 2 from the enrollments section above
  db.update(schema.coupons)
    .set({
      redeemedByUserId: students[2].id,
      redeemedAt: daysAgo(30),
    })
    .where(eq(schema.coupons.id, seededCoupons[0].id))
    .run();

  // Liam already has an enrollment for course 2 from the enrollments section above
  db.update(schema.coupons)
    .set({
      redeemedByUserId: students[3].id,
      redeemedAt: daysAgo(25),
    })
    .where(eq(schema.coupons.id, seededCoupons[1].id))
    .run();

  console.log(
    `Created 1 team with Bossy McBossface as admin, 1 team purchase, and ${seededCoupons.length} coupons (2 redeemed, 3 available).`
  );

  console.log("\n✓ Seed complete!");
  console.log("  Users: 9 (1 admin, 2 instructors, 6 students)");
  console.log("  Categories: 5");
  console.log(
    `  Courses: 2 (${course1LessonIds.length} + ${course2LessonIds.length} lessons)`
  );
  console.log("  Quizzes: 3");
  console.log("  Enrollments: 7");
  console.log("  Purchases: 6 (5 individual + 1 team)");
  console.log("  Teams: 1 (with 5 coupons)");
}

seed().catch(console.error);
