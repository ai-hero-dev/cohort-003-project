# Zod to Valibot — Complete API Reference

## Fundamental pattern change

```ts
// Zod: method chaining on schema instances
const schema = z.string().email().min(5);
const value = schema.parse(input);

// Valibot: functional composition with pipe
const schema = v.pipe(v.string(), v.email(), v.minLength(5));
const value = v.parse(schema, input);
```

## Import style

```ts
// Zod
import { z } from "zod";

// Valibot (namespace — recommended for migration)
import * as v from "valibot";

// Valibot (named — maximum tree-shaking)
import { string, pipe, email, parse } from "valibot";
```

---

## Primitives

| Zod              | Valibot          | Notes  |
| ---------------- | ---------------- | ------ |
| `z.string()`     | `v.string()`     | Direct |
| `z.number()`     | `v.number()`     | Direct |
| `z.boolean()`    | `v.boolean()`    | Direct |
| `z.date()`       | `v.date()`       | Direct |
| `z.bigint()`     | `v.bigint()`     | Direct |
| `z.symbol()`     | `v.symbol()`     | Direct |
| `z.null()`       | `v.null()`       | Direct |
| `z.undefined()`  | `v.undefined()`  | Direct |
| `z.void()`       | `v.void()`       | Direct |
| `z.any()`        | `v.any()`        | Direct |
| `z.unknown()`    | `v.unknown()`    | Direct |
| `z.never()`      | `v.never()`      | Direct |
| `z.nan()`        | `v.nan()`        | Direct |
| `z.literal('x')` | `v.literal('x')` | Direct |

## Enums — CAREFUL

| Zod                    | Valibot                  | Notes                            |
| ---------------------- | ------------------------ | -------------------------------- |
| `z.enum(['a', 'b'])`   | `v.picklist(['a', 'b'])` | **Name change** — NOT `v.enum()` |
| `z.nativeEnum(MyEnum)` | `v.enum(MyEnum)`         | **Name change**                  |

## Containers

| Zod                                | Valibot                            | Notes                                    |
| ---------------------------------- | ---------------------------------- | ---------------------------------------- |
| `z.object({...})`                  | `v.object({...})`                  | Direct                                   |
| `z.array(z.string())`              | `v.array(v.string())`              | Direct                                   |
| `z.tuple([...])`                   | `v.tuple([...])`                   | Direct                                   |
| `z.record(z.string())`             | `v.record(v.string(), v.string())` | Valibot always needs key + value schemas |
| `z.record(z.string(), z.number())` | `v.record(v.string(), v.number())` | Direct                                   |
| `z.map(k, v)`                      | `v.map(k, v)`                      | Direct                                   |
| `z.set(v)`                         | `v.set(v)`                         | Direct                                   |

## Object modifiers

| Zod                                | Valibot                           | Notes              |
| ---------------------------------- | --------------------------------- | ------------------ |
| `z.object({...}).strict()`         | `v.strictObject({...})`           | Different function |
| `z.object({...}).passthrough()`    | `v.looseObject({...})`            | Different function |
| `z.object({...}).strip()`          | `v.object({...})`                 | Default behavior   |
| `z.object({...}).catchall(schema)` | `v.objectWithRest({...}, schema)` | Different function |
| `schema.shape`                     | `schema.entries`                  | Property rename    |

## Object composition

```ts
// Zod .extend()
const Extended = Base.extend({ age: z.number() });
// Valibot — spread entries
const Extended = v.object({ ...Base.entries, age: v.number() });

// Zod .merge()
const Merged = A.merge(B);
// Valibot — spread entries
const Merged = v.object({ ...A.entries, ...B.entries });
```

## Unions & intersections

| Zod                                  | Valibot                        | Notes                        |
| ------------------------------------ | ------------------------------ | ---------------------------- |
| `z.union([a, b])`                    | `v.union([a, b])`              | Direct                       |
| `schema.or(other)`                   | `v.union([schema, other])`     | No method chaining           |
| `z.discriminatedUnion('key', [...])` | `v.variant('key', [...])`      | **Name change**              |
| `z.intersection(a, b)`               | `v.intersect([a, b])`          | **Name change**, takes array |
| `schema.and(other)`                  | `v.intersect([schema, other])` | No method chaining           |

## Nullable / Optional / Default

```ts
// Zod                          // Valibot
z.string().optional()           v.optional(v.string())
z.string().nullable()           v.nullable(v.string())
z.string().nullish()            v.nullish(v.string())

// Defaults — Valibot uses 2nd argument, NOT a separate method
z.string().default('hi')        v.optional(v.string(), 'hi')
z.string().optional().default('hi')   v.optional(v.string(), 'hi')
z.date().default(() => new Date())    v.optional(v.date(), () => new Date())
```

## Pick / Omit / Partial / Required

```ts
// Zod                                              // Valibot
schema.pick({ a: true, c: true })                   v.pick(schema, ['a', 'c'])
schema.omit({ b: true })                            v.omit(schema, ['b'])
schema.partial()                                     v.partial(schema)
schema.partial({ a: true })                          v.partial(schema, ['a'])
schema.required()                                    v.required(schema)
schema.required({ a: true })                         v.required(schema, ['a'])
schema.keyof()                                       v.keyof(schema)
```

**WARNING**: `v.partial()`, `v.pick()`, `v.omit()`, `v.required()` CANNOT wrap a schema already in `v.pipe()`. Apply them first, then pipe.

## String validations

| Zod              | Valibot           | Notes                |
| ---------------- | ----------------- | -------------------- |
| `.min(n)`        | `v.minLength(n)`  | **Name change**      |
| `.max(n)`        | `v.maxLength(n)`  | **Name change**      |
| `.length(n)`     | `v.length(n)`     | Direct               |
| `.email()`       | `v.email()`       | Direct               |
| `.url()`         | `v.url()`         | Direct               |
| `.uuid()`        | `v.uuid()`        | Direct               |
| `.regex(r)`      | `v.regex(r)`      | Direct               |
| `.startsWith(s)` | `v.startsWith(s)` | Direct               |
| `.endsWith(s)`   | `v.endsWith(s)`   | Direct               |
| `.includes(s)`   | `v.includes(s)`   | Direct               |
| `.trim()`        | `v.trim()`        | Direct (inside pipe) |
| `.toLowerCase()` | `v.toLowerCase()` | Direct (inside pipe) |
| `.toUpperCase()` | `v.toUpperCase()` | Direct (inside pipe) |
| `.datetime()`    | `v.isoDateTime()` | **Name change**      |
| `.ip()`          | `v.ip()`          | Direct               |
| `.nonempty()`    | `v.nonEmpty()`    | Casing change        |

## Number validations

| Zod              | Valibot           | Notes           |
| ---------------- | ----------------- | --------------- |
| `.min(n)`        | `v.minValue(n)`   | **Name change** |
| `.max(n)`        | `v.maxValue(n)`   | **Name change** |
| `.gt(n)`         | `v.gtValue(n)`    | **Name change** |
| `.gte(n)`        | `v.minValue(n)`   | **Name change** |
| `.lt(n)`         | `v.ltValue(n)`    | **Name change** |
| `.lte(n)`        | `v.maxValue(n)`   | **Name change** |
| `.int()`         | `v.integer()`     | **Name change** |
| `.positive()`    | `v.minValue(1)`   | Value-based     |
| `.nonnegative()` | `v.minValue(0)`   | Value-based     |
| `.negative()`    | `v.maxValue(-1)`  | Value-based     |
| `.nonpositive()` | `v.maxValue(0)`   | Value-based     |
| `.multipleOf(n)` | `v.multipleOf(n)` | Direct          |
| `.finite()`      | `v.finite()`      | Direct          |
| `.safe()`        | `v.safeInteger()` | **Name change** |

## Array/Set validations

| Zod                   | Valibot          | Notes           |
| --------------------- | ---------------- | --------------- |
| `.min(n)` (array)     | `v.minLength(n)` | **Name change** |
| `.max(n)` (array)     | `v.maxLength(n)` | **Name change** |
| `.nonempty()` (array) | `v.nonEmpty()`   | Casing change   |
| `.min(n)` (set)       | `v.minSize(n)`   | **Name change** |
| `.max(n)` (set)       | `v.maxSize(n)`   | **Name change** |

## Parsing

```ts
// Zod                                    // Valibot
schema.parse(input)                       v.parse(schema, input)
schema.safeParse(input)                   v.safeParse(schema, input)

// safeParse result differences:
// Zod success:   { success: true, data: T }
// Valibot success: { success: true, output: T }    ← .output NOT .data

// Zod failure:   { success: false, error: ZodError }
// Valibot failure: { success: false, issues: Issue[] }  ← .issues NOT .error
```

## Type inference

| Zod                       | Valibot                        | Notes           |
| ------------------------- | ------------------------------ | --------------- |
| `z.infer<typeof schema>`  | `v.InferOutput<typeof schema>` | **Name change** |
| `z.input<typeof schema>`  | `v.InferInput<typeof schema>`  | **Name change** |
| `z.output<typeof schema>` | `v.InferOutput<typeof schema>` | **Name change** |
| N/A                       | `v.InferIssue<typeof schema>`  | Valibot-only    |

## Type constraints

| Zod            | Valibot              | Notes                           |
| -------------- | -------------------- | ------------------------------- |
| `z.ZodType`    | `v.GenericSchema`    | For generic function parameters |
| `z.ZodType<T>` | `v.GenericSchema<T>` | With output type constraint     |

## Coercion

```ts
// Zod                        // Valibot
z.coerce.string()             v.pipe(v.unknown(), v.transform(String))
z.coerce.number()             v.pipe(v.unknown(), v.transform(Number))
z.coerce.boolean()            v.pipe(v.unknown(), v.transform(Boolean))
z.coerce.date()               v.pipe(v.unknown(), v.transform((x) => new Date(x as string)))
```

## Transforms

```ts
// Zod
z.string().transform((val) => val.length);

// Valibot
v.pipe(
  v.string(),
  v.transform((val) => val.length)
);
```

## Refinements

```ts
// Zod .refine()
z.string().refine((val) => val.length <= 255, { message: "Too long" });

// Valibot v.check()
v.pipe(
  v.string(),
  v.check((val) => val.length <= 255, "Too long")
);
```

```ts
// Zod .superRefine()
z.string().superRefine((val, ctx) => {
  if (val.length < 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Too short" });
  }
});

// Valibot v.rawCheck()
v.pipe(
  v.string(),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed && dataset.value.length < 5) {
      addIssue({ message: "Too short" });
    }
  })
);
```

```ts
// Zod cross-field .refine() on object
z.object({ password: z.string(), confirm: z.string() }).refine(
  (d) => d.password === d.confirm,
  { message: "No match", path: ["confirm"] }
);

// Valibot v.forward() + v.partialCheck()
v.pipe(
  v.object({ password: v.string(), confirm: v.string() }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirm"]],
      (d) => d.password === d.confirm,
      "No match"
    ),
    ["confirm"]
  )
);
```

## Preprocessing

```ts
// Zod
z.preprocess((val) => String(val), z.string());

// Valibot
v.pipe(v.unknown(), v.transform(String), v.string());
```

## Branding

```ts
// Zod
z.string().uuid().brand<"UserId">();

// Valibot
v.pipe(v.string(), v.uuid(), v.brand("UserId"));
```

## Catch / Fallback

```ts
// Zod                          // Valibot
z.string().catch('default')     v.fallback(v.string(), 'default')
z.date().catch(() => new Date())  v.fallback(v.date(), () => new Date())
```

## Lazy / Recursive

```ts
// Zod
const Tree: z.ZodType<TreeNode> = z.object({
  children: z.lazy(() => z.array(Tree)),
});

// Valibot
const Tree: v.GenericSchema<TreeNode> = v.object({
  children: v.array(v.lazy(() => Tree)),
});
```

## instanceof

| Zod                   | Valibot             | Notes           |
| --------------------- | ------------------- | --------------- |
| `z.instanceof(Error)` | `v.instance(Error)` | **Name change** |

## Error handling

```ts
// Zod
const result = schema.safeParse(input);
if (!result.success) {
  const flat = result.error.flatten();
  flat.fieldErrors; // Record<string, string[]>
  flat.formErrors; // string[]
}

// Valibot
const result = v.safeParse(schema, input);
if (!result.success) {
  const flat = v.flatten(result.issues);
  flat.nested; // Record<string, string[]>  ← was fieldErrors
  flat.root; // string[]                  ← was formErrors
}
```

## Custom error messages

```ts
// Zod — separate type vs validation messages
z.string({ invalid_type_error: "Not a string" });
z.string().min(5, { message: "Too short" });
z.string().min(5, "Too short"); // shorthand

// Valibot — always a single string as last argument
v.string("Not a string");
v.pipe(v.string("Not a string"), v.minLength(5, "Too short"));
```

## Tuple variants

```ts
// Zod
z.tuple([a, b]).rest(c);

// Valibot
v.tupleWithRest([a, b], c);
```
