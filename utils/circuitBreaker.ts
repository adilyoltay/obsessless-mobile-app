export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // ms
  monitoringPeriod: number; // ms
  halfOpenMaxAttempts: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;
  private stateChangeCallbacks: Set<(state: CircuitState) => void> = new Set();

  constructor(private config: CircuitBreakerConfig) {
    this.startMonitoring();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkForStateTransition();
    if (this.state === CircuitState.OPEN) {
      throw new Error('CIRCUIT_OPEN');
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (e) {
      this.recordFailure();
      throw e;
    }
  }

  private recordSuccess(): void {
    this.successCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private checkForStateTransition(): void {
    if (
      this.state === CircuitState.OPEN &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout
    ) {
      this.transitionTo(CircuitState.HALF_OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    switch (newState) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
        break;
      case CircuitState.OPEN:
        this.halfOpenAttempts = 0;
        break;
      case CircuitState.HALF_OPEN:
        this.halfOpenAttempts = 0;
        break;
    }
    this.stateChangeCallbacks.forEach((cb) => cb(newState));
  }

  private startMonitoring(): void {
    setInterval(() => {
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime > this.config.monitoringPeriod
      ) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }, 10_000);
  }

  onStateChange(callback: (state: CircuitState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStatistics(): { state: CircuitState; failureCount: number; successCount: number; lastFailureTime: number | null } {
    return { state: this.state, failureCount: this.failureCount, successCount: this.successCount, lastFailureTime: this.lastFailureTime };
  }

  /**
   * 📊 Enhanced statistics with health metrics
   */
  getHealthMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    successRate: number;
    isHealthy: boolean;
    timeToReset?: number;
  } {
    const total = this.failureCount + this.successCount;
    const successRate = total > 0 ? this.successCount / total : 1;
    const isHealthy = this.state === CircuitState.CLOSED && this.failureCount < this.config.failureThreshold / 2;
    
    let timeToReset: number | undefined;
    if (this.state === CircuitState.OPEN && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      timeToReset = Math.max(0, this.config.resetTimeout - elapsed);
    }
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      successRate,
      isHealthy,
      timeToReset
    };
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

export const syncCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60_000,
  monitoringPeriod: 120_000,
  halfOpenMaxAttempts: 3,
});


