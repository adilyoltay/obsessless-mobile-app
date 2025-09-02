import NetInfo from '@react-native-community/netinfo';

type Listener = (isOnline: boolean) => void;

/**
 * NetworkMonitor: single-responsibility wrapper around NetInfo
 * - Tracks current connectivity state
 * - Notifies subscribers on changes
 */
export class NetworkMonitor {
  private isOnline = true;
  private unsubscribe?: () => void;
  private listeners = new Set<Listener>();

  start(): void {
    if (this.unsubscribe) return; // already started
    try {
      this.unsubscribe = NetInfo.addEventListener(state => {
        const next = (state.isConnected ?? false) && (state.isInternetReachable !== false);
        const changed = next !== this.isOnline;
        this.isOnline = next;
        if (changed) this.emit();
      });

      // Seed initial state
      NetInfo.fetch().then(state => {
        const next = (state.isConnected ?? false) && (state.isInternetReachable !== false);
        const changed = next !== this.isOnline;
        this.isOnline = next;
        if (changed) this.emit();
      }).catch(() => {});
    } catch (e) {
      // If NetInfo is unavailable, default to online to avoid blocking
      this.isOnline = true;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    // Push current state immediately
    try { fn(this.isOnline); } catch {}
    return () => this.listeners.delete(fn);
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  async fetchCurrent(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = (state.isConnected ?? false) && (state.isInternetReachable !== false);
      return this.isOnline;
    } catch {
      return this.isOnline;
    }
  }

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.listeners.clear();
  }

  private emit() {
    for (const fn of Array.from(this.listeners)) {
      try { fn(this.isOnline); } catch {}
    }
  }
}

export const networkMonitor = new NetworkMonitor();

