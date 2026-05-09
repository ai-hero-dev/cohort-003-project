---
name: zod-to-valibot
description: Migrate TypeScript validation code from Zod to Valibot. Use when user asks to migrate, convert, or replace Zod with Valibot, or when refactoring validation schemas from Zod's chaining API to Valibot's functional API. Works across any repository.
---

# Zod to Valibot Migration

## Quick start

1. Identify all files importing from `zod` (`grep -r "from ['\"]zod['\"]" --include="*.ts" --include="*.tsx"`)
2. Install valibot: add `valibot` to dependencies, remove `zod` after migration
3. Migrate each file using the patterns below and the detailed [REFERENCE.md](REFERENCE.md)
4. Run typecheck and tests after each file to catch regressions early

## Core concept

Zod uses **method chaining** on class instances. Valibot uses **functional composition** via `pipe()`.

```ts
// Zod
import { z } from 'zod';
const schema = z.string().email().min(5);
const result = schema.parse(data);

// Valibot
import * as v from 'valibot';
const schema = v.pipe(v.string(), v.email(), v.minLength(5));
const result = v.parse(schema, data);
```

## Migration workflow

For each file with Zod imports:

- [ ] Replace `import { z } from 'zod'` with `import * as v from 'valibot'`
- [ ] Convert schemas (primitives, objects, arrays, unions) per [REFERENCE.md](REFERENCE.md)
- [ ] Convert chained validations to `v.pipe()` calls
- [ ] Convert `z.infer<typeof S>` to `v.InferOutput<typeof S>`
- [ ] Convert parse/safeParse calls (schema method -> standalone function)
- [ ] Fix safeParse consumers: `.data` -> `.output`, `.error` -> `.issues`
- [ ] Convert `.refine()` to `v.check()`, `.superRefine()` to `v.rawCheck()`
- [ ] Convert `.default()` to second arg of `v.optional()`
- [ ] Convert `.catch()` to `v.fallback()`
- [ ] Convert object methods (pick/omit/partial/extend/merge) to functional form
- [ ] Convert error handling: `ZodError` -> `ValiError`, `.flatten()` -> `v.flatten()`
- [ ] Run typecheck, fix remaining type errors

## Critical name changes

| Zod | Valibot |
|-----|---------|
| `z.enum([...])` | `v.picklist([...])` |
| `z.nativeEnum(E)` | `v.enum(E)` |
| `z.discriminatedUnion(k, [...])` | `v.variant(k, [...])` |
| `z.instanceof(C)` | `v.instance(C)` |
| `.refine(fn, msg)` | `v.check(fn, msg)` |
| `.superRefine(fn)` | `v.rawCheck(fn)` |
| `.catch(val)` | `v.fallback(val)` |
| `.shape` | `.entries` |
| `.element` | `.item` |
| `z.infer<>` | `v.InferOutput<>` |
| `safeParse().data` | `safeParse().output` |
| `safeParse().error` | `safeParse().issues` |

## Automated codemod (preview first!)

```bash
npx @valibot/zod-to-valibot "src/**/*" --dry
```

Remove `--dry` to apply. Always review output — the codemod handles common cases but may miss edge cases like `.superRefine` with complex `ctx.addIssue` patterns or dynamic schema construction.

## Key gotchas

1. **No `.deepPartial()`** — apply `v.partial()` manually at each nesting level
2. **No `.extend()` / `.merge()`** — spread `.entries`: `v.object({ ...base.entries, newField: v.string() })`
3. **`pick`/`omit` take arrays** — `v.pick(schema, ['a', 'b'])` not `{ a: true, b: true }`
4. **`pipe()` must start with a schema** — cannot start with an action
5. **`partial()`/`required()` cannot wrap piped schemas** — apply pipe after partial
6. **`v.optional(schema, defaultValue)`** — default is 2nd arg, not a separate `.default()` call
7. **Async schemas need separate functions** — `v.objectAsync()`, `v.pipeAsync()`, `v.checkAsync()`

See [REFERENCE.md](REFERENCE.md) for the complete API mapping and [EXAMPLES.md](EXAMPLES.md) for real-world migration patterns.
