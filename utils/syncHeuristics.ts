export function determineConcurrency(successRate: number, avgResponseTime: number, queueSize: number): number {
  // Defaults
  let c = 2;
  if (successRate > 90 && avgResponseTime < 400 && queueSize > 10) c = 3;
  if (successRate > 95 && avgResponseTime < 300 && queueSize > 100) c = 4;
  if (successRate < 60 || avgResponseTime > 1200) c = 1;
  return Math.max(1, Math.min(4, c));
}

