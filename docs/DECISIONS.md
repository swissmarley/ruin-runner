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

## Pursuer, collectibles & scoring

- **The Stone Warden is a distance behind the runner** (`Pursuer.gap`), not a physics body.
  It starts 4.6 m behind and drops back out of frame (11 m); a stumble makes it lunge to 3.8 m
  and linger there (slowly retreating) for the 4 s stumble window. `closeness` (0–1) drives the
  camera (rises 1.5 m, pulls back 0.3 m) and, later, growl/footstep volume. The Warden model
  is scaled so, when close, its head fills the bottom of the frame without hiding the runner
  (measured: Warden top at 81 % screen height vs. runner's feet at 75 %).
- **Score** = Σ(distance × multiplier) + 10 per relic coin. The multiplier grows +0.1 per 20
  coins collected in the run (cap ×5). Surge distance counts too.
- **Coins** come as lead-in lines, arcs that match a centered jump over barriers/gaps, low lines
  under beams (slide), lane-hopping trails on obstacle-free straights, and a trail + arc across
  every crumbling bridge. A placement filter guarantees no coin sits inside a pillar, on a
  barrier, in a beam or over a pit. Coin pickup reach is 0.6 m horizontally but only 0.25 m
  vertically, so high arc coins really need a jump.
- **Power-ups** (8 s each): Magnet (pulls coins within 14 m ahead from every lane), Shield
  (absorbs one obstacle hit), Surge (×1.4 speed, invulnerable, floats gaps, auto-steers corners,
  +1 s grace). Placed in obstacle-free lead-ins, not before 150 m, at most one per ~6 segments.
- **Coins spin in the vertex shader** (phase from instance position), so thousands of coins cost
  zero CPU per frame; only collected or magnet-pulled coins touch instance matrices.

## Art & audio

- **Look:** walkways floating over a misty jungle chasm. Sunken columns rise from the depths
  beside the path, piers hold the walkway up, torches line the curbs, gateway arches mark some
  straights, guardian heads watch the corners. Low golden-hour sun behind the runner's right,
  sky-derived image-based lighting, fog matched to the horizon haze of a shader sky dome.
  (Superseded the original flat-shaded Lambert look; see "Visual overhaul" below.)
- **Instance allocator:** `SlotInstances` hands out instance indices per segment slot from a
  LIFO free list; `mesh.count` is the high-water mark. Reserving worst-case ranges per slot
  made the GPU process ~1.4 M triangles of zero-scale instances; the allocator brings a typical
  frame to ~40 k triangles and ~43 draw calls, stable over time.
- **GPU-side animation:** coin spin and torch-flame flicker are done in the vertex shader via
  `onBeforeCompile` (phase from instance position), so they cost no CPU per frame.
- **Beam height 2.0 m** (not 2.6): any jump still overlaps [1.0, 2.0] m, and the shorter lintel
  no longer blocks the chase camera's view of a sliding runner.
- **Particles:** one pooled `THREE.Points` (480 particles, custom shader, preallocated buffers)
  for coin sparkles, running dust, jump/land/slide puffs, stumble/smash debris, power-up bursts,
  and bridge collapse.
- **Audio is 100 % procedural Web Audio:** one-shot SFX recipes (oscillators + a shared noise
  buffer), a Warden growl loop (detuned saws → resonant low-pass with LFO) and footsteps whose
  volume follows `closeness²`, and a 20 s ambient loop (drone, D-minor-pentatonic plucks, hand
  drums, shaker, delay) rendered once with `OfflineAudioContext` and played as a looping buffer.
  The menu runs the music through a low-pass filter; the attract-mode demo is silent apart from
  music. The context is created/resumed on the first pointer/key gesture (mobile autoplay
  rules) and suspended when the page is hidden (which also auto-pauses a run).
- **Haptics:** `navigator.vibrate` on stumble (45 ms), shield break (25 ms), crumble (20 ms),
  death (80-40-120 ms), behind a setting.

## UI, persistence & PWA

- **DOM overlays, no framework.** Menu, HUD, Pause, Game Over and Settings are plain DOM over
  the canvas (`Screens` owns them). The HUD writes to the DOM only when a displayed value
  changes. Buttons are ≥ 48 px, respect safe-area insets, and stop touch propagation so taps
  never register as swipes.
- **Settings screen is an overlay of the Menu**, not a game state; it covers sound, music,
  haptics, graphics quality (Auto/Low/Med/High) and "Replay tutorial".
- **Save data:** one versioned JSON blob (`ruinrunner.save.v1`) with field-by-field
  sanitisation; any storage failure (private mode, quota, corrupt JSON) falls back to defaults
  without breaking the game.
- **Tutorial:** on a first run the generator scripts the opening straights (jump → slide →
  dodge → turn) with generous lead-ins; signs float over the track as constant-screen-size
  sprites with touch or keyboard wording (`pointer: coarse`). Only the nearest sign shows, and
  it fades out before the runner reaches it. Passing the tutorial's corner marks it done;
  dying replays it next run.
- **Quality presets:** low = 1× pixel ratio, no shadows, shorter fog; medium = ≤1.5×, 512²
  shadows; high = ≤2×, 1024² shadows. "Auto" starts at medium on touch devices and high on
  desktop, then adapts (M8).
- **PWA without plugins:** hand-written manifest (fullscreen, portrait) and `sw.js`
  (network-first for navigations, cache-first for hashed assets/icons, versioned cache).
  Registered only in production builds. Icons (any + maskable + apple-touch + favicon) are
  generated by `scripts/gen-icons.mjs` using only Node's `zlib` — original art: a relic coin
  stamped with a ruin gate.

## Polish & performance

- **Adaptive quality** measures rAF intervals, which are vsync-quantised, so "headroom" can only
  mean "holding the full frame rate". It steps down after 2 s over budget and steps up after 10 s
  at full rate. The step-up delay doubles after any step up that is followed by a step down
  (cap 160 s), so a borderline device settles instead of oscillating. Below "low" it drops the
  pixel ratio to 0.85× and then 0.7×.
- **Profiling without real devices:** the environment had no phones and no DevTools CPU
  throttling. Instead: per-frame JS timing (~0.5 ms avg), GPU-synchronised timing via
  `readPixels` (~3.8 ms), an artificial slow-frame run to exercise adaptive quality end to end,
  and heap sampling under forced GC pressure (flat over 5 minutes).
- **Input fixes:** touches and mouse-downs that start on UI controls are ignored by the swipe
  surface (calling `preventDefault` on `touchstart` would cancel their click on mobile).
  Outside gameplay, Enter/Space act as Play/Retry/Resume instead of being swallowed.
- **Service worker cache** trims to 40 entries, so hashed assets from old deploys don't pile up.

## Optional: tilt steering

- **Off by default** (Settings → "Tilt steering (lane-free)"; only shown where
  `DeviceOrientationEvent` exists). Turning it on calls `enable()` inside the toggle's click so
  iOS can show its motion-permission prompt. If permission is refused, the toggle reverts to off.
- **Lane-free mode:** the runner's `x` chases a target at up to 11 m/s. The target is the
  left/right tilt relative to the hold angle when the run started (calibrated on Play),
  ±22° for the full range, with a 2.5° dead zone, adjusted for screen rotation. Swipes still
  jump, slide and turn; lateral swipes outside turn windows do nothing. Collision already works
  with continuous `x`. A side hit bounces the runner to the lane it came from.
- **Falls back to lanes** when the device never reports orientation (desktops), even if enabled.
- Tilt is sampled once per rendered frame rather than queued per tick, so tilt runs are not
  bit-reproducible from seed + inputs. This is acceptable for an optional mode; lane mode
  stays deterministic.

## Visual overhaul (PBR pass)

- **Why:** the flat-shaded, box-built models read as "Minecraft". Everything is still procedural
  (no model or image files, no new dependencies — post-processing and geometry helpers come
  from `three/addons`, which ship inside `three`).
- **One surface shader for every solid.** `MeshStandardMaterial` patched via `onBeforeCompile`
  (`render/art/Surface.ts`). A per-vertex `surf` attribute selects the kind (stone, masonry,
  column drum, wood, bark, iron, gold, leaf, cloth, skin, leather, glow, runestone), so merged
  meshes keep one draw call. It samples one generated 256² RGBA noise texture tri-planar at
  three scales (9 fetches) for tint, grain, Worley cracks and moss blotches, draws masonry
  joints / drum bands procedurally in world space (headings are axis-aligned, so a world grid
  lines up with the path), adds moss on upward faces and in joints, and bump-maps the result
  from a height in meters via screen-space derivatives. World-space for static ruins;
  object-space (`SURF_OBJECT`) for the explorer and Warden so patterns don't swim.
- **Depth fog in the surface shader:** geometry below the walkway fades to the fog color with
  depth (`uDepthFog`), and the sky below the horizon is exactly the fog color, so the gorge
  reads as bottomless mist without extra transparent layers (two thin noise-mist planes add
  drift on top).
- **Lighting:** ACES filmic tone mapping, sun 3.0 + hemisphere 0.35 + a PMREM environment map
  rendered once from the sky shader (`environmentIntensity` 0.55) for reflections — the gold
  coins are fully metallic and rely on it.
- **Post chain (medium/high):** half-float target → Unreal bloom (threshold 1.15, so only
  emissives, flames, the sun and gold highlights glow) → linear-HDR grade (saturation, split
  toning, vignette) → OutputPass (tone map + sRGB) → FXAA. MSAA on the half-float target cost
  more than the rest of the chain combined (measured 9.0 → 3.7 ms), so it is replaced by
  FXAA, and bloom runs at quarter resolution. Low quality renders straight to the canvas
  (renderer MSAA + tone mapping, no bloom/grade).
- **Explorer:** jointed rig (hips, spine, head, shoulders/elbows, thighs/knees/ankles, two
  scarf segments; 13 draw calls) of capsules, lathes and rounded boxes, smooth-shaded. Poses
  are pure joint-angle arrays (`render/character/Pose.ts`, unit-tested): a run cycle with knee
  tuck in the swing phase, flat foot in stance, counter-rotating hips/shoulders and a
  double-bounce; a knee-drive leap; a lean-back power slide (head stays < ~0.95 m, under the
  beam); a face-down collapse. Pose weights blend exponentially, so state changes never pop.
  Lane changes bank the body.
- **Stone Warden:** boulders are displaced icospheres sliced by random planes (chiselled,
  not blobby). Back plates use the `runestone` surface: Worley-edge ember veins whose glow
  pulses with each step and brightens as the Warden closes in.
- **Foliage:** a canvas-painted atlas (fern frond + broad leaf), alpha-tested, double-sided,
  wind sway in the vertex shader. Alpha is boosted by mip level so thin fronds don't vanish
  at a distance (the classic alpha-test mip problem — ferns were invisible before this).
  Ferns sprout on curbs, vines hang off the walkway and column capitals, broad-leaf clumps sit
  on column tops and guardian heads.
- **Budget (M-series Mac, 390×844 portrait, GPU-synced):** high (2× DPR, bloom, 2048 shadows)
  ~7.3 ms, medium ~3.3 ms, low ~1.8 ms; ~75 draw calls; 300–370 k triangles including the
  shadow pass. Hidden power-up instances are no longer drawn (`mesh.count` = live count).
  Bundle: 198 KB gzip (was 167 KB).
