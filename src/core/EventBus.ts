/**
 * Minimal typed event bus. Listeners are stored in arrays created at subscribe time,
 * so emitting never allocates.
 */
export class EventBus<Events extends { [K in keyof Events]: unknown }> {
  private readonly listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    const list = (this.listeners[type] ??= []);
    list.push(fn);
    return () => {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.listeners[type];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i]!(payload);
  }

  clear(): void {
    for (const key of Object.keys(this.listeners)) delete this.listeners[key as keyof Events];
  }
}
