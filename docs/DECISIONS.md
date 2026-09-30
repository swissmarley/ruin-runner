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

## Track & turns

- **Track is a pure function of the seed.** The generator derives difficulty from distance via
  the inverse of the base speed curve (`timeAtDistance`), never from live state. Surges only
  make the player arrive _earlier_ (therefore slower than estimated), so spacing computed from
  the estimate is always safe.
- **Headings are restricted to west/north/east.** From east the generator can only turn left,
  from west only right, so the path zig-zags forward and can never overlap itself.
- **Corners are square blocks** (`CORNER_SIZE` = track width) with the pivot at their center.
  A correct swipe inside the window _queues_ the turn; it executes when the player reaches the
  pivot (or immediately if already past it). Turning resets the player to the center lane —
  the renderer hides the snap with a 200 ms yaw + position blend (`TurnBlend`).
- **Turn window** opens `max(3 m, 0.35 s × speed)` before the corner block and closes 3 m past
  the pivot (just before the far wall). Lateral inputs up to one buffer-time (150 ms) before
  the window are held as turn intents instead of becoming lane changes.
- **Wrong way:** a wrong-direction swipe while still on the straight part of the window is just
  a lane change; inside the corner block it is a fatal "wrong turn". Running past the window
  without turning is a fatal "missed turn".
- **No bridge directly after a corner, no corner directly after a corner**, and at least two
  straights at the start of every run.

## Obstacles & failure

- **Patterns are authored in time slots** (`SLOT_TIME` = 1.15 s), converted to meters with the
  generation-time speed estimate, so a template is equally fair at 8 m/s and 22 m/s.
- **Solvability is proven twice:** `PatternValidator` (DP over lanes with explicit timing for
  lane changes, jump→jump, jump→slide fast-fall, slide→jump) is unit-tested for every template
  at every speed, and the bot — which uses the same timing function — beats 2000 generated runs
  without a single stumble. At least one slot of rest before every pattern guarantees any
  cross-pattern transition is feasible.
- **Hit rules:** low barrier → stumble; overhead beam → fatal; pillar head-on → fatal; steering
  into a pillar's side → stumble + bounce back to the previous lane; standing over a gap →
  fatal fall (0.25 m edge grace); wrong/missed turn → fatal. A second stumble within 4 s means
  the Stone Warden catches you.
- **Shield** absorbs one obstacle hit (stumble or fatal) but not falls or missed turns.
  **Surge** smashes through obstacles, floats over gaps and auto-steers corners; 1 s of grace
  invulnerability follows it.
- **Obstacles are inset 0.3 m from lane edges** so clipping a neighbouring lane mid-change is
  forgiven.
- **Crumbling bridge:** every bridge has one 3.8 m crumbled section (a normal gap to the sim).
  Visually the planks stay in place until the runner is 16 m away, then tumble into the chasm.
- **Attract mode:** the menu background is the bot playing a random seed.
