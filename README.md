# Ruin Runner

A 3D endless runner for mobile browsers. You play a lone explorer fleeing the **Stone Warden**
through endless ruins: vine-choked walkways floating above a misty jungle chasm. Swipe to change
lanes, jump, slide and turn corners, grab relic coins, and don't stumble twice.

All characters, art, names, sounds and music are original. Everything is procedural: the art
is flat-shaded primitives and the audio is synthesised with Web Audio. There are no asset files
apart from the generated app icons.

- **Stack:** TypeScript (strict) · Vite · Three.js · Vitest · ESLint · Prettier
- **Bundle:** ~170 KB gzipped (one JS chunk + CSS), installable PWA, works offline
- **Target:** portrait phones at 60 FPS (adaptive quality), desktop keyboard for development

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
```

| Command                      | What it does                                            |
| ---------------------------- | ------------------------------------------------------- |
| `npm run dev`                | Dev server with hot reload                              |
| `npm run build`              | Type-check and build the production bundle into `dist/` |
| `npm run preview`            | Serve `dist/` locally (service worker active)           |
| `npm run check`              | CI gate: type-check, lint, Prettier check, all tests    |
| `npm test`                   | Unit + headless simulation tests (Vitest)               |
| `node scripts/gen-icons.mjs` | Regenerate the PWA icons in `public/icons/`             |

Requires Node ≥ 20.19.

## Controls

| Action        | Touch                                  | Keyboard           | Gamepad            |
| ------------- | -------------------------------------- | ------------------ | ------------------ |
| Change lane   | Swipe left/right                       | ← → or A D         | D-pad / left stick |
| Turn a corner | Swipe toward it inside the turn window | ← → or A D         | D-pad / stick      |
| Jump          | Swipe up                               | ↑, W or Space      | Up / A             |
| Slide         | Swipe down (mid-air: fast-fall)        | ↓ or S             | Down / B           |
| Pause         | ⏸ button                               | Esc or P           |                    |
| Play / Retry  | Buttons                                | Enter or Space     |                    |
| Debug overlay | Three-finger tap                       | `` ` `` (backtick) |                    |

Swipes register mid-gesture (after 30 px), and one input is buffered for 150 ms, so an early
swipe still counts. A first run starts with an in-world tutorial, which you can replay from
Settings.

## Gameplay rules

- Speed ramps smoothly from 8 m/s to 22 m/s over about 3 minutes.
- **Low barriers** trip you if you don't jump. **Beams** must be slid under. **Fallen pillars**
  block one or two lanes. **Pits** and the **crumbling bridge** must be jumped.
- A stumble lets the Warden close in. A second stumble within ~4 s means it catches you. Beams,
  head-on pillars, pits and wrong or missed turns end the run immediately.
- **Power-ups** last 8 s each. **Magnet** pulls in coins from every lane. **Shield** absorbs one
  hit. **Surge** gives a speed boost, invulnerability and auto-steering.
- **Score** = distance × multiplier + 10 per coin. The multiplier grows +0.1 per 20 coins in a
  run.
- High score, total relics and settings persist in `localStorage`.

## Architecture

The simulation is separate from rendering. It is a deterministic 60 Hz fixed-step model in
**track space**: `s` is distance along the path, `x` is lateral offset and `y` is height.
Collision is simple AABB overlap in that space, so corners never complicate it. Rendering
interpolates between ticks and converts track space to world space.

```
src/
  main.ts            bootstrap + service-worker registration
  config.ts          every tuning constant
  core/              Game (glue), GameLoop (fixed step + rAF), StateMachine, EventBus, Rng,
                     Feedback (events → visuals/audio/haptics), Haptics
  sim/               Simulation (one tick), Controls (input, buffer, turns), Pickups,
                     SimEvents, Bot (perfect-play planner)
  world/             TrackGenerator, Segment, SegmentPool (ring buffer), ObstaclePatterns,
                     PatternValidator, PatternPlacer, CoinPlacer, Tutorial, Track, Heading
  entities/          Player (lanes/jump/slide), Pursuer, Coin, PowerUp
  systems/           Collision, Physics, Difficulty, Scoring, Turns
  input/             InputManager (touch, mouse, keyboard, gamepad), SwipeDetector
  render/            Renderer, GameView, CameraRig, TurnBlend, *View, *Meshes, Effects,
                     Environment, SlotInstances (instance allocator), Quality, AdaptiveQuality
  audio/             AudioManager, Sfx (procedural one-shots), Music (offline-rendered loop)
  ui/                Screens, Menu, Hud, Pause, GameOver, Settings, DebugOverlay
  storage/           SaveData
tests/               Vitest: logic units + headless bot runs (1000 seeds, 10-minute run)
```

Key ideas:

- **Seeded, pure track generation.** A run is fully determined by its seed, because difficulty
  comes from distance rather than live state. Headings are limited to west, north and east, so
  the path never overlaps itself.
- **Beatable by construction.** Obstacle templates are authored in time slots and proven
  solvable at every speed by `PatternValidator`. The bot uses the same timing model and beats
  2,000 generated runs without a single stumble.
- **No per-frame allocation in the hot path.** Segments, obstacles, coins, particles and
  instance slots are all pooled. A 10-minute headless run shows under 1 MB heap growth, and a
  5-minute browser run shows a flat heap after GC.
- **Low draw calls.** Every repeated prop is an `InstancedMesh` fed by a free-list allocator.
  A typical frame is about 43 draw calls and 40–55 k triangles. Coin spin and torch flicker run
  in the vertex shader.
- **Adaptive quality.** It steps from high to medium to low, then to lower resolution, when
  frames run over budget for 2 s. It steps back up after a sustained full frame rate, with
  backoff so it doesn't oscillate. The pixel ratio is capped at 2.

More detail lives in [`CLAUDE.md`](CLAUDE.md) and the design log in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## Testing

`npm run check` runs 150+ tests, including:

- RNG determinism, lane, jump, slide and fast-fall timing, the input buffer and swipe detection
- Turn windows (early buffer, queued pivot turn, missed and wrong turns), collisions and the
  stumble/death rules
- Solvability of every pattern at every speed, and generator determinism, contiguity and
  no self-overlap
- Scoring, the pursuer, pickups and magnet, the difficulty curve, save/load (including corrupt
  or unavailable storage), adaptive quality, and the tutorial
- The **perfect bot** on 1,000 seeds from the start plus 1,000 at top speed, and a
  **10-minute** run with pool and heap checks

## Deploying (static hosting)

The build is a static site with relative paths (`base: './'`), so it works from a domain root
or a sub-path.

```bash
npm run build
```

Upload `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront,
nginx, and so on). Notes:

- Serve over **HTTPS**. Service workers, installability and vibration all require it.
- `sw.js` and `index.html` should be served with `Cache-Control: no-cache`. Everything in
  `assets/` is content-hashed and can be cached forever (`immutable`).
- The service worker uses network-first for pages and cache-first for hashed assets, and trims
  old assets automatically. Bump `VERSION` in `public/sw.js` to force a full cache reset.
- Example for GitHub Pages: push `dist/` to a `gh-pages` branch, or use an Action that runs
  `npm ci && npm run build` and publishes `dist/`.

## Performance notes

Measured in the Claude desktop browser pane (Apple Silicon) at 390×844:

- JS time per frame: ~0.5 ms average, 1.3 ms at the 95th percentile.
- With the GPU forced to finish each frame (`readPixels`): ~3.8 ms at medium quality and 1.5×
  pixel ratio.

Real mid-range phones were **not** available for testing. Adaptive quality was verified by
driving frames at 30 fps and then 60 fps: it stepped down to low with a 0.7× pixel ratio, then
recovered to high.
