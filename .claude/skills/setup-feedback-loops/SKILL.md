---
name: setup-feedback-loops
description: Install and configure a pre-commit hook (husky + lint-staged + prettier) that runs lint-staged, typecheck, and tests on every commit. Adapts to existing project state — detects package manager, skips already-configured pieces. Use when the user wants to add pre-commit hooks, set up AI feedback loops, wire up husky/lint-staged, or enforce typecheck/test before commits in a JS/TS project.
---

# Setup Feedback Loops

Wires up a pre-commit hook that auto-formats staged files, then runs typecheck and tests. Failing checks block the commit — giving AI agents (and humans) a deterministic feedback loop.

## Workflow

### 1. Detect project state

Check in parallel:

- Package manager: lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm)
- `package.json` scripts: does `typecheck` exist? does `test` exist?
- Existing dev deps: `husky`, `lint-staged`, `prettier`, `typescript`, `vitest`/`jest`
- Existing files: `.husky/pre-commit`, `.lintstagedrc*`, `.prettierrc*`, `tsconfig.json`

Report findings before changing anything.

### 2. Install missing dev dependencies

Only install what's missing. Use the detected package manager.

```bash
<pm> install --save-dev husky lint-staged prettier
```

If `typecheck` is missing and TypeScript is installed, it will need a script (step 4). If no test runner exists, ask the user which to use (default: vitest) before installing.

### 3. Initialize husky (if not already)

If `.husky/` doesn't exist:

```bash
<pm> exec husky init
```

This adds a `prepare` script to `package.json` and creates `.husky/pre-commit`.

### 4. Add missing package.json scripts

If absent, add:

- `"typecheck": "tsc --noEmit"` (or framework-specific, e.g. `"react-router typegen && tsc"` if React Router is detected)
- `"test": "vitest run"` (or chosen runner)

Don't overwrite existing scripts.

### 5. Write `.husky/pre-commit`

Overwrite with (using the detected package manager):

```bash
<pm> exec lint-staged
<pm> run typecheck
<pm> run test
```

### 6. Write `.lintstagedrc` (if absent)

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

If the user has ESLint, offer to add `"*.{ts,tsx,js,jsx}": "eslint --fix"` as a second entry.

### 7. Write `.prettierrc.json` (if absent)

Sensible defaults — only if the user has no Prettier config:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### 8. Verify

Run each step of the hook to confirm it works before reporting done:

```bash
<pm> run typecheck
<pm> run test
```

Report what was added vs skipped (already present).

## Notes

- Never overwrite existing config files (`.prettierrc*`, `.lintstagedrc*`) without asking.
- `.husky/pre-commit` is safe to overwrite — husky's default is just `<pm> test`.
- If the repo isn't a git repo, `husky init` fails — run `git init` first or ask the user.
- For monorepos, confirm with the user whether the hook lives at the root or per-package.
