// Lightweight app-wide event bus to broadcast data changes without React Query
// Avoids coupling to RN DeviceEventEmitter; simple on/emit/off API

type Listener = (payload?: any) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event: string, payload?: any): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(payload); } catch (e) { console.warn('EventBus listener error', e); }
    }
  }
}

export const eventBus = new EventBus();

// Common event names
export const Events = {
  MoodEntrySaved: 'mood_entry_saved',
  MoodEntryUpdated: 'mood_entry_updated',
  MoodEntryDeleted: 'mood_entry_deleted',
} as const;

