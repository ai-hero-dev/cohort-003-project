# Zod to Valibot — Migration Examples

Real-world before/after examples for common patterns.

---

## Simple form schema

```ts
// BEFORE (Zod)
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
});

type LoginData = z.infer<typeof loginSchema>;
```

```ts
// AFTER (Valibot)
import * as v from "valibot";

const loginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.minLength(1, "Email is required."),
    v.email("Please enter a valid email address.")
  ),
});

type LoginData = v.InferOutput<typeof loginSchema>;
```

---

## Discriminated union for multi-intent forms

```ts
// BEFORE (Zod)
import { z } from "zod";

const actionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update-user"),
    userId: z.coerce.number().int(),
    name: z.string().trim().min(1, "Name cannot be empty."),
    email: z.string().trim().min(1, "Email cannot be empty."),
  }),
  z.object({
    intent: z.literal("update-role"),
    userId: z.coerce.number().int(),
    role: z.nativeEnum(UserRole),
  }),
]);
```

```ts
// AFTER (Valibot)
import * as v from "valibot";

const actionSchema = v.variant("intent", [
  v.object({
    intent: v.literal("update-user"),
    userId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name cannot be empty.")),
    email: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Email cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("update-role"),
    userId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    role: v.enum(UserRole),
  }),
]);
```

---

## Route param validation

```ts
// BEFORE (Zod)
const paramsSchema = z.object({
  courseId: z.coerce.number().int(),
  lessonId: z.coerce.number().int(),
});
```

```ts
// AFTER (Valibot)
const paramsSchema = v.object({
  courseId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  lessonId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
});
```

---

## Nested arrays with complex objects

```ts
// BEFORE (Zod)
const quizSchema = z.object({
  title: z.string().trim().min(1, "Quiz title is required."),
  passingScore: z.number(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        type: z.nativeEnum(QuestionType),
        options: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            isCorrect: z.boolean(),
          })
        ),
      })
    )
    .min(1, "At least one question is required."),
});
```

```ts
// AFTER (Valibot)
const quizSchema = v.object({
  title: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Quiz title is required.")
  ),
  passingScore: v.number(),
  questions: v.pipe(
    v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        type: v.enum(QuestionType),
        options: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            isCorrect: v.boolean(),
          })
        ),
      })
    ),
    v.minLength(1, "At least one question is required.")
  ),
});
```

---

## Transform with union

```ts
// BEFORE (Zod)
const schema = z.object({
  country: z
    .string()
    .length(2)
    .or(z.literal(""))
    .transform((v) => v || null),
});
```

```ts
// AFTER (Valibot)
const schema = v.object({
  country: v.pipe(
    v.union([v.pipe(v.string(), v.length(2)), v.literal("")]),
    v.transform((val) => val || null)
  ),
});
```

---

## Optional fields with defaults

```ts
// BEFORE (Zod)
const schema = z.object({
  name: z.string().trim().min(1),
  bio: z.string().trim().optional(),
  theme: z.string().default("light"),
});
```

```ts
// AFTER (Valibot)
const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  bio: v.optional(v.pipe(v.string(), v.trim())),
  theme: v.optional(v.string(), "light"),
});
```

---

## Validation wrapper (parseFormData pattern)

This is the most critical file to migrate — it powers all form validation.

```ts
// BEFORE (Zod) — app/lib/validation.ts
import { data } from "react-router";
import type { z } from "zod";

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; errors: Record<string, string> };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseFormData<T extends z.ZodType>(
  formData: FormData,
  schema: T
): ParseResult<z.infer<T>> {
  const raw = Object.fromEntries(formData);
  const result = schema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }
  return { success: false, errors };
}

export function parseParams<T extends z.ZodType>(
  params: Record<string, string | undefined>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params);
  if (result.success) {
    return result.data;
  }
  throw data("Invalid parameters", { status: 400 });
}

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  const raw = await request.json();
  const result = schema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }
  return { success: false, errors };
}
```

```ts
// AFTER (Valibot) — app/lib/validation.ts
import { data } from "react-router";
import * as v from "valibot";

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; errors: Record<string, string> };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseFormData<T extends v.GenericSchema>(
  formData: FormData,
  schema: T
): ParseResult<v.InferOutput<T>> {
  const raw = Object.fromEntries(formData);
  const result = v.safeParse(schema, raw);

  if (result.success) {
    return { success: true, data: result.output };
  }

  const flat = v.flatten<typeof schema>(result.issues);
  const errors: Record<string, string> = {};
  if (flat.nested) {
    for (const [key, messages] of Object.entries(flat.nested)) {
      if (messages && messages.length > 0) {
        errors[key] = messages[0];
      }
    }
  }
  return { success: false, errors };
}

export function parseParams<T extends v.GenericSchema>(
  params: Record<string, string | undefined>,
  schema: T
): v.InferOutput<T> {
  const result = v.safeParse(schema, params);
  if (result.success) {
    return result.output;
  }
  throw data("Invalid parameters", { status: 400 });
}

export async function parseJsonBody<T extends v.GenericSchema>(
  request: Request,
  schema: T
): Promise<ParseResult<v.InferOutput<T>>> {
  const raw = await request.json();
  const result = v.safeParse(schema, raw);

  if (result.success) {
    return { success: true, data: result.output };
  }

  const flat = v.flatten<typeof schema>(result.issues);
  const errors: Record<string, string> = {};
  if (flat.nested) {
    for (const [key, messages] of Object.entries(flat.nested)) {
      if (messages && messages.length > 0) {
        errors[key] = messages[0];
      }
    }
  }
  return { success: false, errors };
}
```

### Key changes in the wrapper:

| Zod                                  | Valibot                           | Location           |
| ------------------------------------ | --------------------------------- | ------------------ |
| `z.ZodType`                          | `v.GenericSchema`                 | Generic constraint |
| `z.infer<T>`                         | `v.InferOutput<T>`                | Return types       |
| `schema.safeParse(raw)`              | `v.safeParse(schema, raw)`        | Parse call         |
| `result.data`                        | `result.output`                   | Success value      |
| `result.error.flatten().fieldErrors` | `v.flatten(result.issues).nested` | Error extraction   |

---

## Enum-based status/role validation

```ts
// BEFORE (Zod)
import { CourseStatus } from "~/db/schema";

const schema = z.object({
  status: z.nativeEnum(CourseStatus),
});
```

```ts
// AFTER (Valibot)
import { CourseStatus } from "~/db/schema";

const schema = v.object({
  status: v.enum(CourseStatus),
});
```

---

## JSON body schema (API routes)

```ts
// BEFORE (Zod)
const trackingSchema = z.object({
  lessonId: z.number(),
  positionSeconds: z.number(),
});

export async function action({ request }: Route.ActionArgs) {
  const parsed = await parseJsonBody(request, trackingSchema);
  if (!parsed.success) return data({ error: "Invalid" }, { status: 400 });
  // parsed.data.lessonId — works the same after migration
}
```

```ts
// AFTER (Valibot)
const trackingSchema = v.object({
  lessonId: v.number(),
  positionSeconds: v.number(),
});

// Action code stays identical — the parseJsonBody wrapper handles the difference
```

---

## Purchase schema with coerce + int + min

```ts
// BEFORE (Zod)
const purchaseSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("confirm-purchase") }),
  z.object({
    intent: z.literal("confirm-team-purchase"),
    quantity: z.coerce.number().int().min(1),
  }),
]);
```

```ts
// AFTER (Valibot)
const purchaseSchema = v.variant("intent", [
  v.object({ intent: v.literal("confirm-purchase") }),
  v.object({
    intent: v.literal("confirm-team-purchase"),
    quantity: v.pipe(
      v.unknown(),
      v.transform(Number),
      v.integer(),
      v.minValue(1)
    ),
  }),
]);
```

---

## Checklist for each file

When migrating a file:

- [ ] Replace `import { z } from "zod"` with `import * as v from "valibot"`
- [ ] Convert `z.object({...})` to `v.object({...})`
- [ ] Convert chained string validations to `v.pipe(v.string(), ...)`
- [ ] Convert `z.coerce.number()` to `v.pipe(v.unknown(), v.transform(Number))`
- [ ] Convert `z.discriminatedUnion()` to `v.variant()`
- [ ] Convert `z.nativeEnum()` to `v.enum()`
- [ ] Convert `z.enum([])` to `v.picklist([])`
- [ ] Convert `.optional()` to `v.optional()`
- [ ] Convert `.default()` to 2nd arg of `v.optional()`
- [ ] Convert `z.infer<>` to `v.InferOutput<>`
- [ ] Convert `.transform()` into `v.pipe()` with `v.transform()`
- [ ] Run type checker
- [ ] Run tests
