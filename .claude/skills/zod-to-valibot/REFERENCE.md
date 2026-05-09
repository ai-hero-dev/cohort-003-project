# Zod to Valibot: Complete API Reference

## Import style

```ts
// Zod
import { z } from 'zod';

// Valibot (namespace import by convention)
import * as v from 'valibot';
```

## Parsing

| Zod | Valibot | Notes |
|-----|---------|-------|
| `schema.parse(data)` | `v.parse(schema, data)` | Throws on failure |
| `schema.safeParse(data)` | `v.safeParse(schema, data)` | Returns result object |
| `schema.parseAsync(data)` | `v.parseAsync(schema, data)` | |
| `schema.safeParseAsync(data)` | `v.safeParseAsync(schema, data)` | |

**safeParse result shape changes:**
```ts
// Zod
const result = schema.safeParse(data);
if (result.success) { result.data } else { result.error }

// Valibot
const result = v.safeParse(schema, data);
if (result.success) { result.output } else { result.issues }
```

Valibot extras: `v.is(schema, data)` (type guard), `v.assert(schema, data)`, `v.parser(schema)` (reusable), `v.safeParser(schema)`.

Config: `v.parse(schema, data, { abortEarly: true, abortPipeEarly: true })`

## Primitives

| Zod | Valibot |
|-----|---------|
| `z.string()` | `v.string()` |
| `z.number()` | `v.number()` |
| `z.boolean()` | `v.boolean()` |
| `z.bigint()` | `v.bigint()` |
| `z.date()` | `v.date()` |
| `z.symbol()` | `v.symbol()` |
| `z.undefined()` | `v.undefined()` |
| `z.null()` | `v.null()` |
| `z.void()` | `v.void()` |
| `z.any()` | `v.any()` |
| `z.unknown()` | `v.unknown()` |
| `z.never()` | `v.never()` |
| `z.nan()` | `v.nan()` |
| `z.literal('foo')` | `v.literal('foo')` |

## Complex types

| Zod | Valibot | Notes |
|-----|---------|-------|
| `z.object({...})` | `v.object({...})` | Strips unknown keys (default) |
| `z.object({}).strict()` | `v.strictObject({...})` | Errors on unknown |
| `z.object({}).passthrough()` | `v.looseObject({...})` | Keeps unknown |
| `z.object({}).catchall(s)` | `v.objectWithRest({...}, s)` | Validates unknown with rest schema |
| `z.array(s)` | `v.array(s)` | |
| `z.tuple([a, b])` | `v.tuple([a, b])` | |
| `z.tuple([...]).rest(s)` | `v.tupleWithRest([...], s)` | |
| `z.union([a, b])` | `v.union([a, b])` | |
| `z.discriminatedUnion(k, [...])` | `v.variant(k, [...])` | **Renamed** |
| `z.intersection(a, b)` | `v.intersect([a, b])` | Takes array |
| `a.and(b)` | `v.intersect([a, b])` | |
| `a.or(b)` | `v.union([a, b])` | |
| `z.record(k, v)` | `v.record(k, v)` | |
| `z.map(k, v)` | `v.map(k, v)` | |
| `z.set(s)` | `v.set(s)` | |
| `z.enum(['a', 'b'])` | `v.picklist(['a', 'b'])` | **Renamed** |
| `z.nativeEnum(E)` | `v.enum(E)` | **Renamed** |
| `z.promise(s)` | `v.promise(s)` | |
| `z.instanceof(C)` | `v.instance(C)` | **Renamed** |
| `z.custom<T>(fn)` | `v.custom<T>(fn)` | |
| `z.lazy(() => s)` | `v.lazy(() => s)` | |
| `z.function()` | `v.function()` | |

## String validations

All chained string methods become actions inside `v.pipe()`:

| Zod | Valibot |
|-----|---------|
| `z.string().min(n)` | `v.pipe(v.string(), v.minLength(n))` |
| `z.string().max(n)` | `v.pipe(v.string(), v.maxLength(n))` |
| `z.string().length(n)` | `v.pipe(v.string(), v.length(n))` |
| `z.string().email()` | `v.pipe(v.string(), v.email())` |
| `z.string().url()` | `v.pipe(v.string(), v.url())` |
| `z.string().uuid()` | `v.pipe(v.string(), v.uuid())` |
| `z.string().cuid2()` | `v.pipe(v.string(), v.cuid2())` |
| `z.string().ulid()` | `v.pipe(v.string(), v.ulid())` |
| `z.string().regex(r)` | `v.pipe(v.string(), v.regex(r))` |
| `z.string().startsWith(s)` | `v.pipe(v.string(), v.startsWith(s))` |
| `z.string().endsWith(s)` | `v.pipe(v.string(), v.endsWith(s))` |
| `z.string().includes(s)` | `v.pipe(v.string(), v.includes(s))` |
| `z.string().trim()` | `v.pipe(v.string(), v.trim())` |
| `z.string().toLowerCase()` | `v.pipe(v.string(), v.toLowerCase())` |
| `z.string().toUpperCase()` | `v.pipe(v.string(), v.toUpperCase())` |
| `z.string().datetime()` | `v.pipe(v.string(), v.isoDateTime())` |
| `z.string().ip()` | `v.pipe(v.string(), v.ip())` |
| `z.string().emoji()` | `v.pipe(v.string(), v.emoji())` |
| `z.string().nonempty()` | `v.pipe(v.string(), v.nonEmpty())` |

## Number validations

| Zod | Valibot |
|-----|---------|
| `.min(n)` / `.gte(n)` | `v.minValue(n)` |
| `.max(n)` / `.lte(n)` | `v.maxValue(n)` |
| `.gt(n)` | `v.gtValue(n)` |
| `.lt(n)` | `v.ltValue(n)` |
| `.int()` | `v.integer()` |
| `.positive()` | `v.gtValue(0)` |
| `.negative()` | `v.ltValue(0)` |
| `.nonnegative()` | `v.minValue(0)` |
| `.nonpositive()` | `v.maxValue(0)` |
| `.multipleOf(n)` | `v.multipleOf(n)` |
| `.finite()` | `v.finite()` |
| `.safe()` | `v.safeInteger()` |

All go inside `v.pipe(v.number(), ...)`.

## Array validations

| Zod | Valibot |
|-----|---------|
| `.min(n)` | `v.pipe(v.array(s), v.minLength(n))` |
| `.max(n)` | `v.pipe(v.array(s), v.maxLength(n))` |
| `.length(n)` | `v.pipe(v.array(s), v.length(n))` |
| `.nonempty()` | `v.pipe(v.array(s), v.nonEmpty())` |
| `z.string().array()` | `v.array(v.string())` |
| `schema.element` | `schema.item` |

## Object methods

| Zod | Valibot |
|-----|---------|
| `s.pick({ a: true })` | `v.pick(s, ['a'])` |
| `s.omit({ a: true })` | `v.omit(s, ['a'])` |
| `s.partial()` | `v.partial(s)` |
| `s.partial({ a: true })` | `v.partial(s, ['a'])` |
| `s.required()` | `v.required(s)` |
| `s.required({ a: true })` | `v.required(s, ['a'])` |
| `s.extend({ b: z.string() })` | `v.object({ ...s.entries, b: v.string() })` |
| `a.merge(b)` | `v.object({ ...a.entries, ...b.entries })` |
| `s.keyof()` | `v.keyof(s)` |
| `s.shape` | `s.entries` |
| `s.deepPartial()` | No equivalent (apply `v.partial()` at each level) |

## Schema modifiers

| Zod | Valibot |
|-----|---------|
| `.optional()` | `v.optional(s)` |
| `.nullable()` | `v.nullable(s)` |
| `.nullish()` | `v.nullish(s)` |
| `.default(val)` | `v.optional(s, val)` |
| `.default(() => val)` | `v.optional(s, () => val)` |
| `.catch(val)` | `v.fallback(s, val)` |
| `.describe('...')` | `v.pipe(s, v.description('...'))` |
| `.readonly()` | `v.pipe(s, v.readonly())` |
| `.brand('X')` | `v.pipe(s, v.brand('X'))` |

Valibot-only: `v.exactOptional(s)` (missing key OK, `undefined` value not OK), `v.nonOptional(s)`, `v.nonNullable(s)`, `v.nonNullish(s)`, `v.unwrap(wrappedSchema)`.

## Transformations and refinements

| Zod | Valibot |
|-----|---------|
| `.transform(fn)` | `v.pipe(s, v.transform(fn))` |
| `.refine(fn, msg)` | `v.pipe(s, v.check(fn, msg))` |
| `.superRefine(fn)` | `v.pipe(s, v.rawCheck(fn))` |
| `z.preprocess(fn, s)` | `v.pipe(v.unknown(), v.transform(fn), s)` |

### refine -> check

```ts
// Zod
z.string().refine(val => val.length > 5, 'Too short')

// Valibot
v.pipe(v.string(), v.check(val => val.length > 5, 'Too short'))
```

### superRefine -> rawCheck / forward + partialCheck

```ts
// Zod: cross-field validation
z.object({ password: z.string(), confirm: z.string() })
  .superRefine((val, ctx) => {
    if (val.password !== val.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No match', path: ['confirm'] });
    }
  });

// Valibot: using forward + partialCheck
v.pipe(
  v.object({ password: v.string(), confirm: v.string() }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirm']],
      (input) => input.password === input.confirm,
      'Passwords do not match.'
    ),
    ['confirm']
  )
);
```

## Coercion

| Zod | Valibot |
|-----|---------|
| `z.coerce.string()` | `v.pipe(v.unknown(), v.transform(String))` |
| `z.coerce.number()` | `v.pipe(v.unknown(), v.transform(Number))` |
| `z.coerce.boolean()` | `v.pipe(v.unknown(), v.transform(Boolean))` |
| `z.coerce.date()` | `v.pipe(v.unknown(), v.transform(v => new Date(v)))` |
| `z.coerce.bigint()` | `v.pipe(v.unknown(), v.transform(BigInt))` |

Preferred: use Valibot's typed coercion actions for safety:
```ts
v.pipe(v.string(), v.toNumber())    // NaN-safe
v.pipe(v.string(), v.toDate())      // validates result
v.pipe(v.string(), v.toBigint())
v.pipe(v.string(), v.toBoolean())
```

## Type inference

| Zod | Valibot |
|-----|---------|
| `z.infer<typeof s>` | `v.InferOutput<typeof s>` |
| `z.input<typeof s>` | `v.InferInput<typeof s>` |
| `z.output<typeof s>` | `v.InferOutput<typeof s>` |
| N/A | `v.InferIssue<typeof s>` |

## Error handling

| Zod | Valibot |
|-----|---------|
| `ZodError` | `ValiError` (import `{ ValiError }`) |
| `error.issues` | `error.issues` |
| `error.flatten()` | `v.flatten(result.issues)` |
| `error.format()` | N/A (use flatten) |

```ts
// Zod error check
import { ZodError } from 'zod';
if (e instanceof ZodError) { ... }

// Valibot error check
import { isValiError } from 'valibot';
if (v.isValiError(e)) { ... }
```

**Custom error messages:**
```ts
// Zod
z.string({ invalid_type_error: 'Not a string' }).min(5, { message: 'Too short' })

// Valibot (message is last arg of each function)
v.pipe(v.string('Not a string'), v.minLength(5, 'Too short'))
```

**Flatten structure:**
```ts
const flat = v.flatten<typeof schema>(result.issues);
// flat.root   — root-level errors (string[])
// flat.nested — { 'field.path': string[] }
// flat.other  — errors without dot paths
```

**Global error configuration:**
```ts
v.setGlobalMessage('Field is invalid');
v.setSchemaMessage((issue) => `Expected ${issue.expected} but got ${issue.received}`);
v.setSpecificMessage(v.string, 'Must be a string');
v.setGlobalConfig({ lang: 'de' });
```

## Recursive / lazy schemas

```ts
// Zod
type Category = { name: string; subcategories: Category[] };
const CategorySchema: z.ZodType<Category> = z.object({
  name: z.string(),
  subcategories: z.lazy(() => CategorySchema.array()),
});

// Valibot (must annotate with GenericSchema)
type Category = { name: string; subcategories: Category[] };
const CategorySchema: v.GenericSchema<Category> = v.object({
  name: v.string(),
  subcategories: v.array(v.lazy(() => CategorySchema)),
});
```

## Metadata

```ts
// Zod
z.string().describe('A user email')

// Valibot
v.pipe(v.string(), v.title('Email'), v.description('A user email'))
```

Retrieve: `v.getTitle(s)`, `v.getDescription(s)`, `v.getExamples(s)`, `v.getMetadata(s)`.

## Pipe mechanism

Core composition pattern — replaces all method chaining:

```ts
const EmailSchema = v.pipe(
  v.string(),        // 1. Base schema (required first)
  v.trim(),          // 2. Transform
  v.nonEmpty(),      // 3. Validate
  v.email(),         // 4. Validate
  v.maxLength(255),  // 5. Validate
  v.toLowerCase(),   // 6. Transform
  v.brand('Email')   // 7. Brand
);
```

Rules:
- Must start with a schema (not an action)
- Up to 19 actions after the schema
- By default collects all issues; use `abortPipeEarly: true` to short-circuit

## Async schemas

Zod uses the same schema with `.parseAsync()`. Valibot requires separate async schema functions when async validation is needed:

```ts
// Valibot async
const schema = v.pipeAsync(
  v.string(),
  v.checkAsync(async (val) => await isUnique(val), 'Must be unique')
);
await v.parseAsync(schema, data);
```

Async variants: `v.objectAsync()`, `v.arrayAsync()`, `v.unionAsync()`, `v.pipeAsync()`, `v.checkAsync()`, `v.transformAsync()`, `v.rawCheckAsync()`, `v.rawTransformAsync()`, `v.lazyAsync()`, `v.variantAsync()`, etc.
