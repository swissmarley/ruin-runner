# Ruin Runner — project guide for Claude

3D endless runner for portrait mobile browsers (Temple Run–inspired gameplay, 100% original
content). The explorer auto-runs through ancient ruins, chased by the **Stone Warden**.

## Stack

- TypeScript 6 (strict), Vite 8, Three.js r186
- Vitest 5 for pure-logic tests (no rendering in tests)
- ESLint 10 (flat config + typescript-eslint), Prettier 3
- Web Audio API (all SFX/music generated procedurally, no audio files)
- PWA: hand-written `public/manifest.webmanifest` + `public/sw.js`

Allowed deps only: `three`, `vite`, `typescript`, `vitest`, `eslint`, `prettier` (plus their
type/config glue: `@types/three`, `@eslint/js`, `typescript-eslint`). Ask before adding others.

## Commands

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Vite dev server (LAN-exposed for phone testing)   |
| `npm run build`   | Type-check + production build into `dist/`        |
| `npm run preview` | Serve the production build                        |
| `npm run check`   | typecheck + lint + format:check + tests (CI gate) |
| `npm run test`    | Vitest once (`npm run test:watch` to watch)       |
| `npm run format`  | Prettier write                                    |

npm note: the user's `~/.npm` cache has permission issues; if installs fail with EACCES/EEXIST,
set `npm_config_cache` to a scratch dir.

## Architecture overview

Simulation and rendering are strictly separated:

- **Simulation** (`core/`, `world/`, `entities/`, `systems/`, `sim/`) is pure TypeScript with no
  DOM or Three.js imports. It runs at a fixed 60 Hz. Everything lives in **track space**:
  `s` = distance along the path (monotonic), `x` = lateral offset (lanes), `y` = height.
  Collisions are AABB overlaps in track space, so corners never complicate collision.
- **Rendering** (`render/`) reads simulation state each frame, interpolates between the last two
  ticks (`alpha`), and converts track space to world space via `world/Track.ts`.
- **Glue** (`core/Game.ts`) owns the state machine (`Boot → Menu → Playing ⇄ Paused → GameOver →
Menu/Playing`), the loop, input, audio, UI, and save data.

```
src/
  main.ts              bootstrap
  config.ts            tunable constants (speeds, durations, lane width…)
  core/                Game, GameLoop (fixed step), StateMachine, EventBus, Rng
  world/               Segment, SegmentPool (ring buffer), TrackGenerator, ObstaclePatterns,
                       PatternValidator, Track (path queries)
  entities/            Player (lanes/jump/slide), Pursuer, Coin, PowerUp
  systems/             Physics (AABB), Collision, Scoring, Difficulty
  sim/                 Simulation (one tick of game logic), Bot (perfect-play planner)
  input/               InputManager, SwipeDetector
  render/              Renderer, CameraRig, Materials, Effects, WorldView, *View, Quality
  audio/               AudioManager, Sfx, Music
  ui/                  Hud, Menu, GameOver, Settings, Pause, DebugOverlay
  storage/             SaveData
tests/                 Vitest suites (pure logic + headless bot runs)
docs/DECISIONS.md      design decisions log
```

## Code conventions

- No file over ~300 lines; prefer small, well-named modules.
- Simulation code must not import `three` or touch the DOM.
- Hot path (per tick / per frame) must not allocate: reuse objects, pooled arrays, scratch
  vectors declared at module scope. No closures, spreads, `map/filter` in hot loops.
- Seeded `Rng` only inside the simulation — never `Math.random()` there.
- Constants in `src/config.ts`; no magic numbers scattered in logic.
- Named exports only; `import type` for type-only imports.
- Record non-obvious choices in `docs/DECISIONS.md`.

## Milestones

- [x] **M1 Scaffold** — Vite + TS strict + ESLint + Prettier + Vitest, spinning cube, `npm run check`
- [x] **M2 Running core** — auto-run, 3 lanes, jump/slide, chase cam, fixed-step loop, input
- [x] **M3 Procedural track** — segment pool, seeded gen, turns + windows, 10-min bot sim
- [ ] **M4 Obstacles & death** — patterns, collision, stumble/death, game over + instant retry
- [ ] **M5 Pursuer, coins, power-ups, scoring** — Magnet/Shield/Surge (8 s), difficulty ramp
- [ ] **M6 Art & audio** — low-poly ruins, fog/lighting, particles, procedural SFX + music
- [ ] **M7 UI, persistence, PWA** — menu/HUD/settings, save data, tutorial, installable PWA
- [ ] **M8 Polish & perf** — adaptive quality, debug overlay, throttled profiling, README

## Verification log

- M1: `npm run check` green; dev server renders the spinning cube.
- M2: unit tests for lanes, jump/slide/fast-fall timing, input buffer, fixed-step loop, state
  machine, swipe detection. Browser (390×844): keyboard ←/Space/↓ and synthetic touch swipes
  (right/up/down/left) drive the player; no console warnings.
- M3: generator determinism/contiguity/no-self-overlap tests; turn window tests (early buffer,
  queued pivot turn, missed turn, wrong turn); bot survives 1000 seeds × 40 s from start and
  1000 seeds × 25 s at top speed; 10-minute headless run alive with pool ≤ 28 and heap growth
  < 1 MB after forced GC. Browser: autopilot (`__game.autopilot = true`) turns corners with
  smooth camera blend.
