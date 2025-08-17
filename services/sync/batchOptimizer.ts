import NetInfo from '@react-native-community/netinfo';

class BatchOptimizer {
  private static instance: BatchOptimizer;
  private networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
  private successRate = 1.0;
  private times: number[] = [];
  private lastRecommended: number | null = null;

  static getInstance(): BatchOptimizer {
    if (!BatchOptimizer.instance) {
      BatchOptimizer.instance = new BatchOptimizer();
    }
    return BatchOptimizer.instance;
  }

  private constructor() {
    NetInfo.addEventListener((state) => {
      if (state.type === 'wifi') this.networkSpeed = 'fast';
      else if (state.type === 'cellular') {
        const gen = (state.details as any)?.cellularGeneration;
        if (gen === '4g' || gen === '5g') this.networkSpeed = 'fast';
        else if (gen === '3g') this.networkSpeed = 'medium';
        else this.networkSpeed = 'slow';
      } else this.networkSpeed = 'slow';
    });
  }

  calculate(queueSize: number, priority: 'low' | 'normal' | 'high' = 'normal'): number {
    const cfg = this.getConfig();
    let size = cfg.optimal;
    if (queueSize > 100) size = Math.min(size * 2, cfg.max);
    else if (queueSize < 10) size = Math.max(cfg.min, Math.floor(size / 2));
    if (this.successRate < 0.5) size = cfg.min;
    else if (this.successRate > 0.95 && this.averageTime() < 1000) size = Math.min(Math.floor(size * 1.5), cfg.max);
    if (priority === 'high') size = Math.max(1, Math.floor(size / 2));
    if (priority === 'low') size = Math.min(Math.floor(size * 1.5), cfg.max);
    const recommended = Math.max(cfg.min, Math.min(cfg.max, size));
    this.lastRecommended = recommended;
    return recommended;
  }

  record(batchSize: number, success: boolean, ms: number): void {
    this.successRate = this.successRate * 0.9 + (success ? 0.1 : 0);
    this.times.push(ms);
    if (this.times.length > 10) this.times.shift();
  }

  private averageTime(): number {
    if (this.times.length === 0) return 0;
    return this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  private getConfig(): { min: number; optimal: number; max: number } {
    switch (this.networkSpeed) {
      case 'fast':
        return { min: 5, optimal: 20, max: 50 };
      case 'medium':
        return { min: 3, optimal: 10, max: 20 };
      default:
        return { min: 1, optimal: 3, max: 5 };
    }
  }

  getStatistics(): { recommendedBatchSize: number; successRate: number; avgResponseTime: number } {
    // Use last computed recommendation if available; otherwise estimate with a nominal queue size
    const estimated = this.lastRecommended ?? this.calculate(20, 'normal');
    return {
      recommendedBatchSize: estimated,
      successRate: this.successRate,
      avgResponseTime: this.averageTime(),
    };
  }
}

export const batchOptimizer = BatchOptimizer.getInstance();
export default batchOptimizer;


