# Zod to Valibot Migration

## Key differences

Zod uses **method chaining** (`z.string().email().min(5)`). Valibot uses **functional pipes** (`v.pipe(v.string(), v.email(), v.minLength(5))`). Every chain becomes a `v.pipe()` call.

Zod calls parse on the schema (`schema.safeParse()`). Valibot calls parse as a standalone function (`v.safeParse(schema, input)`).

## Workflow

1. **Install Valibot**:
   - [ ] `npm install valibot` (or pnpm/bun equivalent)

2. **Try the automated codemod first** (handles ~80% of cases):
   - [ ] `npx @valibot/zod-to-valibot --dry "src/**/*"` to preview
   - [ ] `npx @valibot/zod-to-valibot "src/**/*"` to apply
   - [ ] Review output for errors — codemod is beta and misses edge cases

3. **Fix what the codemod missed** — use [REFERENCE.md](REFERENCE.md) for the full API mapping

4. **Migrate validation wrappers** — any utility that accepts `z.ZodType` or calls `schema.safeParse()` needs updating. See [EXAMPLES.md](EXAMPLES.md) for a complete wrapper migration.

5. **Update imports**:
   - [ ] Replace `import { z } from "zod"` with `import * as v from "valibot"`
   - [ ] Replace `z.infer<typeof schema>` with `v.InferOutput<typeof schema>`
   - [ ] Replace `z.input<typeof schema>` with `v.InferInput<typeof schema>`

6. **Verify**:
   - [ ] Run type checker (`tsc --noEmit`)
   - [ ] Run tests
   - [ ] Remove `zod` from dependencies

## Critical gotchas

- `z.enum(['a','b'])` becomes `v.picklist(['a','b'])` — NOT `v.enum()`. Valibot's `v.enum()` is for native TS enums (Zod's `z.nativeEnum()`).
- `z.discriminatedUnion()` becomes `v.variant()`.
- `.default('x')` becomes the 2nd arg: `v.optional(v.string(), 'x')`.
- `safeParse` success returns `.output` not `.data`. Failure returns `.issues` not `.error`.
- `.pick({ a: true })` becomes `v.pick(schema, ['a'])` — keys as array, not object.
- `z.coerce.number()` becomes `v.pipe(v.unknown(), v.transform(Number))`.
- `.extend()` / `.merge()` become spread: `v.object({ ...base.entries, newField: v.string() })`.
- `v.partial()`, `v.pick()`, `v.omit()` CANNOT wrap a schema already in `v.pipe()` — apply them first, then pipe.
- Validation names change: `.min()` splits into `v.minLength()` (strings/arrays) vs `v.minValue()` (numbers).
- `.flatten().fieldErrors` becomes `v.flatten(result.issues).nested`.
- `z.ZodType` generic constraint becomes `v.GenericSchema`.

## Reference

- [REFERENCE.md](REFERENCE.md) — Complete API mapping table (every Zod method to Valibot equivalent)
- [EXAMPLES.md](EXAMPLES.md) — Before/after migration examples for common patterns
