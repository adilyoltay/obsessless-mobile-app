class RateLimiter {
  constructor(options = { perMinute: 60, perHour: 1000, perDay: 10000 }) {
    this.options = options;
    this.store = new Map();
  }

  check(userId) {
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

module.exports = { RateLimiter };
