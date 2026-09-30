/** Tiny DOM helpers for the overlay UI (no framework). */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `btn ${className}`.trim(), label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  // Keep presses on UI controls from starting a swipe on the game surface.
  b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  b.addEventListener('mousedown', (e) => e.stopPropagation());
  return b;
}

/** Base class for full-screen overlays that fade in and out. */
export class Overlay {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, className: string) {
    this.root = el('div', `overlay ${className} hidden`);
    parent.appendChild(this.root);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }
}

/** Formats an integer with thin grouping (e.g. 12 345). */
export function formatInt(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
