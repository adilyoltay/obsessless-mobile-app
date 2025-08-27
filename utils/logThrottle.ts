/**
 * 🔇 Log Throttle Utilities
 * Reduces console spam by throttling repetitive log messages
 */

/**
 * Throttle console logs to reduce spam
 * @param key - Unique key for this log type
 * @param message - Message to log
 * @param data - Optional data to include
 * @param intervalMs - Throttle interval in milliseconds (default: 60 seconds)
 */
export function throttleLog(key: string, message: string, data?: any, intervalMs: number = 60000): void {
  if (!__DEV__) return; // Only log in development
  
  const logKey = `__throttle_log_${key}`;
  const lastLogTime = (global as any)[logKey] || 0;
  const now = Date.now();
  
  if (now - lastLogTime > intervalMs) {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
    (global as any)[logKey] = now;
  }
}

/**
 * Throttle console.warn messages
 */
export function throttleWarn(key: string, message: string, data?: any, intervalMs: number = 60000): void {
  if (!__DEV__) return;
  
  const logKey = `__throttle_warn_${key}`;
  const lastLogTime = (global as any)[logKey] || 0;
  const now = Date.now();
  
  if (now - lastLogTime > intervalMs) {
    if (data !== undefined) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
    (global as any)[logKey] = now;
  }
}

/**
 * Throttle console.error messages
 */
export function throttleError(key: string, message: string, data?: any, intervalMs: number = 60000): void {
  if (!__DEV__) return;
  
  const logKey = `__throttle_error_${key}`;
  const lastLogTime = (global as any)[logKey] || 0;
  const now = Date.now();
  
  if (now - lastLogTime > intervalMs) {
    if (data !== undefined) {
      console.error(message, data);
    } else {
      console.error(message);
    }
    (global as any)[logKey] = now;
  }
}

/**
 * Count-based throttling - only log first N times
 */
export function throttleLogCount(key: string, message: string, maxCount: number = 3, data?: any): void {
  if (!__DEV__) return;
  
  const countKey = `__throttle_count_${key}`;
  const currentCount = (global as any)[countKey] || 0;
  
  if (currentCount < maxCount) {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
    (global as any)[countKey] = currentCount + 1;
    
    if (currentCount + 1 === maxCount) {
      console.log(`🔇 [${key}] Log throttled - will not show again`);
    }
  }
}

/**
 * Debug helper to show throttle statistics
 */
export function getThrottleStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  
  Object.keys(global as any).forEach(key => {
    if (key.startsWith('__throttle_')) {
      stats[key] = (global as any)[key];
    }
  });
  
  return stats;
}

/**
 * Clear all throttle counters (useful for testing)
 */
export function clearThrottleCounters(): void {
  Object.keys(global as any).forEach(key => {
    if (key.startsWith('__throttle_')) {
      delete (global as any)[key];
    }
  });
  console.log('🔇 All log throttle counters cleared');
}
