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

## Simulation model

- **Track space everywhere.** The sim tracks `s` (monotonic path distance), `x` (lateral) and
  `y` (height). Obstacles, coins and gaps are stored as `s` ranges + lane masks, so collision is
  1-D-ish AABB and corners never affect collision math. World coordinates exist only for
  rendering (`PathFrame`).
- **Inputs are queued and applied at the start of the next tick**, never mid-frame, so a run is
  exactly reproducible from `(seed, tick-stamped inputs)`.
- **Timings:** jump 0.70 s / 1.35 m apex (parabola), slide 0.75 s, lane change 120 ms
  ease-out, fast-fall 16 m/s when a slide cancels a jump, input buffer 150 ms (one input,
  latest wins). Jumping out of a slide is allowed.
- **Speed curve:** `8 + 14 · (0.5·u + 0.5·smoothstep(u))`, `u = t / 180 s`. Gentle start,
  steady middle, eases into the 22 m/s cap at 3 minutes.
- **Swipes fire on `touchmove`** once the finger passes 30 px (dominant axis), at most once per
  touch; very fast flicks that only cross the threshold at release fire on `touchend`.
  Mouse drags use the same detector for desktop testing.
- **Start backstop:** the first segment begins 16 m behind the start so the camera never sees
  the track edge.
- **Dev handle:** in dev builds `window.__game` exposes the game and `debugAdvance(seconds)`,
  used for smoke tests while the browser pane is hidden (rAF paused).
