import type { Dir } from '../sim/InputBuffer';
import { SwipeDetector } from './SwipeDetector';

export interface InputHandlers {
  onDirection(dir: Dir): void;
  onPause(): void;
  onDebugToggle(): void;
}

const KEY_MAP: Record<string, Dir> = {
  ArrowLeft: 'LEFT',
  KeyA: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyD: 'RIGHT',
  ArrowUp: 'UP',
  KeyW: 'UP',
  Space: 'UP',
  ArrowDown: 'DOWN',
  KeyS: 'DOWN',
};

const PAD_AXIS_THRESHOLD = 0.6;

/**
 * Unifies touch swipes, mouse drags, keyboard and gamepad into LEFT/RIGHT/UP/DOWN events.
 * Also blocks page scroll, zoom and pull-to-refresh while attached.
 */
export class InputManager {
  private readonly swipe = new SwipeDetector(30);
  private readonly padPrev = [false, false, false, false];
  private mouseDown = false;
  private enabled = true;

  constructor(
    surface: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {
    surface.addEventListener('touchstart', this.onTouchStart, { passive: false });
    surface.addEventListener('touchmove', this.onTouchMove, { passive: false });
    surface.addEventListener('touchend', this.onTouchEnd, { passive: false });
    surface.addEventListener('touchcancel', this.onTouchCancel);
    surface.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    // Block pinch-zoom (iOS gesture events) and pull-to-refresh / scroll bounce.
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('touchmove', preventIfGame, { passive: false });
    document.addEventListener('dblclick', prevent, { passive: false });
  }

  /** Enables or disables gameplay input (UI buttons keep working regardless). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.swipe.cancel();
  }

  /** Polls connected gamepads; call once per frame. Allocation-free when none connected. */
  pollGamepads(): void {
    if (!this.enabled || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const b = pad.buttons;
      this.padEdge(0, ax < -PAD_AXIS_THRESHOLD || !!b[14]?.pressed, 'LEFT');
      this.padEdge(1, ax > PAD_AXIS_THRESHOLD || !!b[15]?.pressed, 'RIGHT');
      this.padEdge(2, ay < -PAD_AXIS_THRESHOLD || !!b[12]?.pressed || !!b[0]?.pressed, 'UP');
      this.padEdge(3, ay > PAD_AXIS_THRESHOLD || !!b[13]?.pressed || !!b[1]?.pressed, 'DOWN');
      return;
    }
  }

  private padEdge(index: number, down: boolean, dir: Dir): void {
    if (down && !this.padPrev[index]) this.handlers.onDirection(dir);
    this.padPrev[index] = down;
  }

  private readonly onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length >= 3) {
      this.handlers.onDebugToggle();
      this.swipe.cancel();
      e.preventDefault();
      return;
    }
    const t = e.changedTouches[0];
    if (!t || this.swipe.tracking) return;
    this.swipe.start(t.identifier, t.clientX, t.clientY);
    e.preventDefault();
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      this.emit(this.swipe.move(t.identifier, t.clientX, t.clientY));
    }
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      this.emit(this.swipe.end(t.identifier, t.clientX, t.clientY));
    }
    e.preventDefault();
  };

  private readonly onTouchCancel = (): void => {
    this.swipe.cancel();
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    this.mouseDown = true;
    this.swipe.start(-2, e.clientX, e.clientY);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (this.mouseDown) this.emit(this.swipe.move(-2, e.clientX, e.clientY));
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (!this.mouseDown) return;
    this.mouseDown = false;
    this.emit(this.swipe.end(-2, e.clientX, e.clientY));
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') {
      this.handlers.onDebugToggle();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.handlers.onPause();
      return;
    }
    const dir = KEY_MAP[e.code];
    if (!dir) return;
    e.preventDefault();
    if (!e.repeat) this.emit(dir);
  };

  private emit(dir: Dir | null): void {
    if (dir !== null && this.enabled) this.handlers.onDirection(dir);
  }
}

function prevent(e: Event): void {
  e.preventDefault();
}

function preventIfGame(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (!target?.closest('[data-scrollable]')) e.preventDefault();
}
