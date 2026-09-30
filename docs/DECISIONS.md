# Design decisions

Short log of choices made without asking. Newest at the bottom of each section.

## Tooling

- **TypeScript 6.0 instead of 7.0.** `typescript-eslint@8` peers on `typescript <6.1`, and 7.0
  is the native-port major. 6.0.3 keeps lint + type-check working together.
- **Tooling glue packages.** `@types/three` (types for `three`), `@eslint/js` and
  `typescript-eslint` (needed for ESLint to parse TS) are treated as part of the allowed
  `three`/`eslint` deps. They are dev-only and add zero bytes to the bundle.
- **No Playwright.** Smoke tests use the Claude built-in browser pane against the Vite dev
  server/preview build instead of adding a dependency.
- **`noUncheckedIndexedAccess` off.** The hot loops index typed arrays heavily; the flag would
  force non-null assertions everywhere. Strict mode and the other strict flags stay on.
- **`npm run check` also runs `prettier --check`** so formatting drift fails CI early.
- **Vitest runs with `--expose-gc`** so the 10-minute memory test can force GC between samples.
