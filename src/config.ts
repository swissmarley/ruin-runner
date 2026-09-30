/** Central tuning constants. Units: meters, seconds, meters/second. */

// Simulation clock
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const MAX_STEPS_PER_FRAME = 5;

// Lanes & track layout
export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.2;
export const CENTER_LANE = 1;
/** Walkable half-width of the track (three lanes plus a small border). */
export const TRACK_HALF_WIDTH = 3.6;
/** Side length of the square corner block; the turn pivot sits at its center. */
export const CORNER_SIZE = TRACK_HALF_WIDTH * 2;

// Player motion
export const SPEED_MIN = 8;
export const SPEED_MAX = 22;
export const SPEED_RAMP_TIME = 180;
export const LANE_CHANGE_TIME = 0.12;
export const JUMP_DURATION = 0.7;
export const JUMP_HEIGHT = 1.35;
export const SLIDE_DURATION = 0.75;
/** Downward speed when a slide cancels a jump (fast-fall). */
export const FAST_FALL_SPEED = 16;
export const INPUT_BUFFER_TIME = 0.15;

// Player collider (track space)
export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HALF_DEPTH = 0.3;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_SLIDE_HEIGHT = 0.7;

// Turns
/** Seconds of approach (at current speed) before the corner block during which a swipe turns. */
export const TURN_WINDOW_LEAD_TIME = 0.35;
export const TURN_WINDOW_MIN_LEAD = 3;
/** How far past the pivot the player can still turn before hitting the far wall. */
export const TURN_LATE_MARGIN = CORNER_SIZE / 2 - 0.6;
/** Visual turn easing time (render only). */
export const TURN_BLEND_TIME = 0.2;

// Obstacles (depth = extent along the path)
export const LOW_BARRIER_HEIGHT = 0.75;
export const LOW_DEPTH = 0.5;
export const BEAM_BOTTOM = 1.0;
/** Any jump overlaps [BEAM_BOTTOM, BEAM_TOP] (feet ≤ 1.35 m, head ≥ 1.7 m), so 2 m suffices. */
export const BEAM_TOP = 2.0;
export const BEAM_DEPTH = 0.5;
export const PILLAR_HEIGHT = 1.9;
export const PILLAR_DEPTH = 1.2;
export const GAP_LENGTH = 2.6;
export const CRUMBLE_GAP_LENGTH = 3.8;
/** How far the player's center may hang over a gap edge before falling. */
export const GAP_EDGE_GRACE = 0.25;
/** Obstacles are narrower than their lane by this much on each side (lane-change leniency). */
export const OBSTACLE_LANE_INSET = 0.3;

// Pursuer & failure
export const STUMBLE_WINDOW = 4;
export const PURSUER_FAR_GAP = 11;
export const PURSUER_NEAR_GAP = 3.8;
export const PURSUER_START_GAP = 4.6;

// Power-ups & scoring
export const POWERUP_DURATION = 8;
export const SURGE_SPEED_MULT = 1.4;
export const SURGE_GRACE_TIME = 1;
export const MAGNET_RANGE_AHEAD = 14;
export const MAGNET_RANGE_BEHIND = 1;
export const COIN_RADIUS = 0.6;
export const COIN_POINTS = 10;
export const COINS_PER_MULT_STEP = 20;
export const MULT_STEP = 0.1;
export const MULT_MAX = 5;

// World streaming
export const SEGMENT_POOL_SIZE = 28;
export const SPAWN_AHEAD = 190;
export const KEEP_BEHIND = 40;
