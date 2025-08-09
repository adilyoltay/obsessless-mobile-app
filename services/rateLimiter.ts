export interface RateLimiterOptions {
  perMinute: number;
  perHour: number;
  perDay: number;
}

interface WindowCounter {
  count: number;
  start: number;
  limit: number;
  windowMs: number;
}

export class RateLimiter {
  private store: Map<string, WindowCounter[]> = new Map();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions = { perMinute: 60, perHour: 1000, perDay: 10000 }) {
    this.options = options;
  }

  check(userId: string): void {
    const now = Date.now();
    const counters = this.store.get(userId) || [
      { count: 0, start: now, limit: this.options.perMinute, windowMs: 60 * 1000 },
      { count: 0, start: now, limit: this.options.perHour, windowMs: 60 * 60 * 1000 },
      { count: 0, start: now, limit: this.options.perDay, windowMs: 24 * 60 * 60 * 1000 }
    ];

    for (const counter of counters) {
      if (now - counter.start >= counter.windowMs) {
        counter.count = 0;
        counter.start = now;
      }

      counter.count++;
      if (counter.count > counter.limit) {
        throw new Error('Rate limit exceeded');
      }
    }

    this.store.set(userId, counters);
  }
}

export default RateLimiter;
