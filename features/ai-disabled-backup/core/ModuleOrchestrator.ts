/**
 * 🎼 ModuleOrchestrator - Lightweight orchestrator for routing to appropriate modules
 * 
 * This orchestrator maps QuickClass classifications to appropriate module handlers
 * and manages the routing logic between different therapeutic modules.
 * 
 * Responsibilities:
 * - Route analysis results to appropriate modules
 * - Manage module initialization
 * - Handle fallback scenarios
 * - Coordinate cross-module interactions
 * 
 * @module ModuleOrchestrator
 * @since v1.0.0
 */

import { QuickClass, RouteAction, AnalysisResult } from './CoreAnalysisService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Module handler interface
 */
export interface IModuleHandler {
  name: string;
  canHandle(quickClass: QuickClass): boolean;
  process(result: AnalysisResult): Promise<ModuleResponse>;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

/**
 * Module response
 */
export interface ModuleResponse {
  success: boolean;
  action: RouteAction;
  data: {
    screen?: string;
    params?: Record<string, any>;
    message?: string;
    processed?: boolean;
  };
  metadata?: {
    processingTimeMs?: number;
    moduleUsed?: string;
  };
}

/**
 * Orchestration options
 */
export interface OrchestrationOptions {
  timeout?: number;
  fallbackEnabled?: boolean;
  crossModuleEnabled?: boolean;
}

// =============================================================================
// 🎼 MODULE ORCHESTRATOR IMPLEMENTATION
// =============================================================================

/**
 * Main orchestrator class
 */
export class ModuleOrchestrator {
  private modules: Map<string, IModuleHandler> = new Map();
  private isInitialized = false;
  private defaultTimeout = 3000; // 3 seconds

  constructor() {
    // Constructor
  }

  /**
   * Initialize orchestrator and register modules
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🎼 Initializing ModuleOrchestrator...');

      // Register module handlers
      await this.registerModules();

      // Initialize all modules
      await this.initializeModules();

      this.isInitialized = true;
      console.log('✅ ModuleOrchestrator initialized');
    } catch (error) {
      console.error('❌ ModuleOrchestrator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register all module handlers
   */
  private async registerModules(): Promise<void> {
    // Register MOOD handler
    this.registerModule('mood', new MoodHandler());

    // CBT handler removed

    // OCD handler removed

    // (Removed) Register Terapi handler

    // Register BREATHWORK handler
    this.registerModule('breathwork', new BreathworkHandler());

    // Register OTHER/fallback handler
    this.registerModule('other', new OtherHandler());
  }

  /**
   * Register a single module
   */
  registerModule(key: string, handler: IModuleHandler): void {
    this.modules.set(key, handler);
    console.log(`📦 Registered module: ${handler.name}`);
  }

  /**
   * Initialize all registered modules
   */
  private async initializeModules(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const [key, module] of this.modules) {
      if (module.initialize) {
        initPromises.push(
          module.initialize().catch(error => {
            console.warn(`⚠️ Module ${module.name} initialization failed:`, error);
          })
        );
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Process analysis result through appropriate module
   */
  async process(
    result: AnalysisResult,
    options: OrchestrationOptions = {}
  ): Promise<ModuleResponse> {
    const startTime = Date.now();

    try {
      // Ensure orchestrator is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Find appropriate handler
      const handler = this.findHandler(result.quickClass);

      if (!handler) {
        console.warn(`⚠️ No handler found for class: ${result.quickClass}`);
        return this.createFallbackResponse(result);
      }

      // Process with timeout
      const timeout = options.timeout || this.defaultTimeout;
      const response = await this.processWithTimeout(handler, result, timeout);

      // Add metadata
      response.metadata = {
        ...response.metadata,
        processingTimeMs: Date.now() - startTime,
        moduleUsed: handler.name,
      };

      return response;
    } catch (error) {
      console.error('❌ ModuleOrchestrator.process error:', error);
      return this.createErrorResponse(result, error);
    }
  }

  /**
   * Find appropriate handler for QuickClass
   */
  private findHandler(quickClass: QuickClass): IModuleHandler | null {
    // Direct mapping
    const directKey = quickClass.toLowerCase();
    if (this.modules.has(directKey)) {
      const handler = this.modules.get(directKey)!;
      if (handler.canHandle(quickClass)) {
        return handler;
      }
    }

    // Search all handlers
    for (const handler of this.modules.values()) {
      if (handler.canHandle(quickClass)) {
        return handler;
      }
    }

    // Return fallback handler
    return this.modules.get('other') || null;
  }

  /**
   * Process with timeout protection
   */
  private async processWithTimeout(
    handler: IModuleHandler,
    result: AnalysisResult,
    timeout: number
  ): Promise<ModuleResponse> {
    return Promise.race([
      handler.process(result),
      new Promise<ModuleResponse>((_, reject) =>
        setTimeout(() => reject(new Error('Module processing timeout')), timeout)
      ),
    ]);
  }

  /**
   * Create fallback response
   */
  private createFallbackResponse(result: AnalysisResult): ModuleResponse {
    return {
      success: true,
      action: 'AUTO_SAVE',
      data: {
        message: 'İşleminiz kaydedildi',
        processed: true,
      },
      metadata: {
        moduleUsed: 'fallback',
      },
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(result: AnalysisResult, error: any): ModuleResponse {
    return {
      success: false,
      action: 'AUTO_SAVE',
      data: {
        message: 'İşlem sırasında bir hata oluştu',
        processed: false,
      },
      metadata: {
        moduleUsed: 'error',
      },
    };
  }

  /**
   * Cleanup all modules
   */
  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const module of this.modules.values()) {
      if (module.cleanup) {
        cleanupPromises.push(
          module.cleanup().catch(error => {
            console.warn(`⚠️ Module ${module.name} cleanup failed:`, error);
          })
        );
      }
    }

    await Promise.all(cleanupPromises);
    this.modules.clear();
    this.isInitialized = false;
  }
}

// =============================================================================
// 📦 MODULE HANDLERS
// =============================================================================

/**
 * MOOD module handler
 */
class MoodHandler implements IModuleHandler {
  name = 'MoodHandler';

  canHandle(quickClass: QuickClass): boolean {
    return quickClass === 'MOOD';
  }

  async process(result: AnalysisResult): Promise<ModuleResponse> {
    return {
      success: true,
      action: 'AUTO_SAVE',
      data: {
        screen: 'mood',
        params: {
          mood: (result.payload as any)?.mood ?? (result.payload as any)?.estimatedMood ?? 50,
          confidence: result.confidence,
        },
        message: 'Ruh haliniz kaydedildi',
        processed: true,
      },
    };
  }
}

/**
 * CBT module handler
 */
// CBTHandler removed

/**
 * OCD module handler
 */
// OCDHandler removed

/**
 * BREATHWORK module handler
 */
class BreathworkHandler implements IModuleHandler {
  name = 'BreathworkHandler';

  canHandle(quickClass: QuickClass): boolean {
    return quickClass === 'BREATHWORK';
  }

  async process(result: AnalysisResult): Promise<ModuleResponse> {
    // Determine protocol based on anxiety level
    let protocol: 'box' | '478' | 'paced' = 'box';
    const anxietyLevel = (result.payload as any)?.anxietyLevel;
    
    if (anxietyLevel && anxietyLevel >= 7) {
      protocol = '478'; // High anxiety
    } else if (anxietyLevel && anxietyLevel <= 3) {
      protocol = 'paced'; // Low anxiety, maintenance
    }

    return {
      success: true,
      action: 'SUGGEST_BREATHWORK',
      data: {
        screen: 'breathwork',
        params: {
          protocol,
          autoStart: true,
          source: 'checkin',
          anxietyLevel,
        },
        message: 'Nefes egzersizi öneriliyor',
        processed: true,
      },
    };
  }
}

/**
 * OTHER/fallback module handler
 */
class OtherHandler implements IModuleHandler {
  name = 'OtherHandler';

  canHandle(quickClass: QuickClass): boolean {
    return true; // Handles everything
  }

  async process(result: AnalysisResult): Promise<ModuleResponse> {
    return {
      success: true,
      action: 'AUTO_SAVE',
      data: {
        message: 'Kaydınız alındı',
        processed: true,
      },
    };
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

export default ModuleOrchestrator;
// Types are already exported above via interface declarations
