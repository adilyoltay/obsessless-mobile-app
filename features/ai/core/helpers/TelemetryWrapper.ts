/**
 * TelemetryWrapper
 * 
 * AI Pipeline telemetry işlemlerini merkezi olarak yöneten wrapper.
 * Error handling, performance tracking ve event management.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

import { trackAIInteraction, AIEventType } from '../../telemetry/aiTelemetry';
import { generateShortSecureId } from '@/utils/idGenerator';

export interface TelemetryContext {
  userId?: string;
  module?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  metadata?: Record<string, any>;
}

export class TelemetryWrapper {
  private readonly operationStack: string[] = [];
  private readonly timers: Map<string, number> = new Map();
  
  /**
   * Track an async operation with telemetry
   */
  async track<T>(
    operation: () => Promise<T>,
    eventType?: AIEventType,
    context?: TelemetryContext
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();
    
    // Start tracking
    this.startOperation(operationId, context?.operation || 'unknown');
    
    try {
      // Track start event
      if (eventType || context?.module) {
        await this.trackEventInternal(
          eventType || AIEventType.UNIFIED_PIPELINE_STARTED,
          {
            ...context?.metadata,
            operationId,
            module: context?.module,
            startTime
          },
          context?.userId
        );
      }
      
      // Execute operation
      const result = await operation();
      
      // Track success
      const duration = Date.now() - startTime;
      await this.trackSuccess(
        operationId,
        duration,
        eventType || AIEventType.UNIFIED_PIPELINE_COMPLETED,
        context
      );
      
      return result;
      
    } catch (error) {
      // Track error
      const duration = Date.now() - startTime;
      await this.trackError(
        operationId,
        error as Error,
        duration,
        eventType || AIEventType.UNIFIED_PIPELINE_ERROR,
        context
      );
      
      throw error;
      
    } finally {
      this.endOperation(operationId);
    }
  }
  
  /**
   * Track a synchronous operation
   */
  trackSync<T>(
    operation: () => T,
    context?: TelemetryContext
  ): T {
    const operationId = this.generateOperationId();
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      // Fire and forget telemetry
      this.trackEventInternal(
        AIEventType.UNIFIED_PIPELINE_COMPLETED,
        {
          ...context?.metadata,
          operationId,
          duration,
          sync: true
        },
        context?.userId
      ).catch(console.error);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Fire and forget error telemetry
      this.trackEventInternal(
        AIEventType.UNIFIED_PIPELINE_ERROR,
        {
          ...context?.metadata,
          operationId,
          duration,
          error: (error as Error).message,
          sync: true
        },
        context?.userId
      ).catch(console.error);
      
      throw error;
    }
  }
  
  /**
   * Batch track multiple operations
   */
  async trackBatch<T>(
    operations: Array<{ 
      name: string; 
      operation: () => Promise<T>;
      context?: TelemetryContext;
    }>
  ): Promise<OperationResult<T>[]> {
    const batchId = this.generateOperationId();
    const batchStartTime = Date.now();
    const results: OperationResult<T>[] = [];
    
    // Track batch start
    await this.trackEventInternal(
      AIEventType.BATCH_OPERATION_STARTED,
      {
        batchId,
        operationCount: operations.length,
        operations: operations.map(op => op.name)
      }
    );
    
    // Execute operations
    for (const { name, operation, context } of operations) {
      const startTime = Date.now();
      
      try {
        const data = await operation();
        results.push({
          success: true,
          data,
          duration: Date.now() - startTime
        });
        
      } catch (error) {
        results.push({
          success: false,
          error: error as Error,
          duration: Date.now() - startTime
        });
      }
    }
    
    // Track batch completion
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    await this.trackEventInternal(
      AIEventType.BATCH_OPERATION_COMPLETED,
      {
        batchId,
        totalDuration: Date.now() - batchStartTime,
        successCount,
        failureCount,
        successRate: successCount / operations.length
      }
    );
    
    return results;
  }
  
  /**
   * Start a timer for performance tracking
   */
  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }
  
  /**
   * End a timer and get duration
   */
  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) return -1;
    
    const duration = Date.now() - startTime;
    this.timers.delete(label);
    
    return duration;
  }
  
  /**
   * Track a custom event
   */
  async trackCustomEvent(
    eventName: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      // Map to closest AIEventType or use generic
      const eventType = this.mapToAIEventType(eventName);
      
      await trackAIInteraction(
        eventType,
        {
          ...data,
          customEvent: eventName,
          timestamp: Date.now()
        },
        userId
      );
    } catch (error) {
      console.error('Failed to track custom event:', error);
    }
  }
  
  /**
   * Track performance metrics
   */
  async trackPerformance(
    operation: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      cpuUsage?: number;
      cacheHit?: boolean;
    },
    userId?: string
  ): Promise<void> {
    await this.trackEventInternal(
      AIEventType.PERFORMANCE_METRIC,
      {
        operation,
        ...metrics,
        timestamp: Date.now()
      },
      userId
    );
  }
  
  /**
   * Track a warning
   */
  async trackWarning(
    message: string,
    context?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    await this.trackEventInternal(
      AIEventType.WARNING,
      {
        message,
        ...context,
        level: 'warning',
        timestamp: Date.now()
      },
      userId
    );
  }
  
  /**
   * Private: Generate operation ID - crypto-secure short ID
   */
  private generateOperationId(): string {
    // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
    return generateShortSecureId('op');
  }
  
  /**
   * Private: Start tracking an operation
   */
  private startOperation(id: string, name: string): void {
    this.operationStack.push(`${id}:${name}`);
    
    // Prevent stack overflow
    if (this.operationStack.length > 50) {
      this.operationStack.shift();
    }
  }
  
  /**
   * Private: End tracking an operation
   */
  private endOperation(id: string): void {
    const index = this.operationStack.findIndex(op => op.startsWith(id));
    if (index !== -1) {
      this.operationStack.splice(index, 1);
    }
  }
  
  /**
   * Private: Track success
   */
  private async trackSuccess(
    operationId: string,
    duration: number,
    eventType: AIEventType,
    context?: TelemetryContext
  ): Promise<void> {
    await this.trackEventInternal(
      eventType,
      {
        ...context?.metadata,
        operationId,
        duration,
        success: true,
        module: context?.module
      },
      context?.userId
    );
  }
  
  /**
   * Private: Track error
   */
  private async trackError(
    operationId: string,
    error: Error,
    duration: number,
    eventType: AIEventType,
    context?: TelemetryContext
  ): Promise<void> {
    await this.trackEventInternal(
      eventType,
      {
        ...context?.metadata,
        operationId,
        duration,
        success: false,
        error: error.message,
        errorStack: error.stack,
        module: context?.module
      },
      context?.userId
    );
  }
  
  /**
   * Public: Track a simple event (for UnifiedAIPipeline compatibility)
   */
  async trackEvent(
    eventType: AIEventType,
    data: Record<string, any>
  ): Promise<void> {
    const userId = data.userId || data.user_id;
    return this.trackEventInternal(eventType, data, userId);
  }

  /**
   * Private: Core track event method
   */
  private async trackEventInternal(
    eventType: AIEventType,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      await trackAIInteraction(eventType, data, userId);
    } catch (error) {
      // Telemetry should never break the main flow
      console.error('Telemetry error:', error);
    }
  }
  
  /**
   * Private: Map custom event names to AIEventType
   */
  private mapToAIEventType(eventName: string): AIEventType {
    const mapping: Record<string, AIEventType> = {
      'cache_hit': AIEventType.UNIFIED_PIPELINE_CACHE_HIT,
      'cache_miss': AIEventType.UNIFIED_PIPELINE_CACHE_MISS,
      'error': AIEventType.UNIFIED_PIPELINE_ERROR,
      'success': AIEventType.UNIFIED_PIPELINE_COMPLETED,
      'start': AIEventType.UNIFIED_PIPELINE_STARTED,
      // Add more mappings as needed
    };
    
    return mapping[eventName.toLowerCase()] || AIEventType.GENERIC_EVENT;
  }
  
  /**
   * Get current operation stack (for debugging)
   */
  getOperationStack(): string[] {
    return [...this.operationStack];
  }
  
  /**
   * Check if any operations are in progress
   */
  hasActiveOperations(): boolean {
    return this.operationStack.length > 0;
  }
  
  /**
   * Clear all tracking (cleanup)
   */
  clear(): void {
    this.operationStack.length = 0;
    this.timers.clear();
  }
}

// Singleton instance
let instance: TelemetryWrapper | null = null;

export function getTelemetryWrapper(): TelemetryWrapper {
  if (!instance) {
    instance = new TelemetryWrapper();
  }
  return instance;
}
