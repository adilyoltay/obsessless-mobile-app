/**
 * ✅ F-05 FIX: Voice Temp Cleanup Service
 * 
 * This service manages cleanup of temporary voice files both locally and on server.
 * It provides scheduled cleanup to prevent storage buildup and maintain app performance.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { edgeAIService } from '@/features/ai-fallbacks/edgeAIService';

export interface CleanupStats {
  clientDeleted: number;
  serverDeleted: number;
  lastCleanup: string;
  errors: string[];
}

class VoiceCleanupService {
  private static instance: VoiceCleanupService;
  private cleanupInterval?: NodeJS.Timeout;
  private appStateSubscription?: any;

  private constructor() {
    this.initializeAppStateListener();
  }

  static getInstance(): VoiceCleanupService {
    if (!VoiceCleanupService.instance) {
      VoiceCleanupService.instance = new VoiceCleanupService();
    }
    return VoiceCleanupService.instance;
  }

  /**
   * Initialize cleanup service with periodic schedule
   */
  async initialize(): Promise<void> {
    console.log('🧹 Initializing voice cleanup service...');
    
    // Check if cleanup is due
    const lastCleanup = await this.getLastCleanupTime();
    const now = Date.now();
    const daysSinceCleanup = (now - lastCleanup) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCleanup >= 1) {
      console.log(`🔄 Last cleanup was ${daysSinceCleanup.toFixed(1)} days ago, running cleanup...`);
      await this.performFullCleanup();
    }
    
    // Schedule daily cleanup
    this.schedulePeriodicCleanup();
  }

  /**
   * Start periodic cleanup (daily)
   */
  private schedulePeriodicCleanup(): void {
    // Clear existing interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Schedule cleanup every 24 hours
    this.cleanupInterval = setInterval(async () => {
      console.log('⏰ Scheduled cleanup triggered');
      await this.performFullCleanup();
    }, 24 * 60 * 60 * 1000);

    console.log('✅ Periodic cleanup scheduled (every 24 hours)');
  }

  /**
   * Listen for app state changes to trigger cleanup
   */
  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          // App going to background - good time for cleanup
          this.performQuickCleanup();
        }
      }
    );
  }

  /**
   * Perform full cleanup (client + server)
   */
  async performFullCleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      clientDeleted: 0,
      serverDeleted: 0,
      lastCleanup: new Date().toISOString(),
      errors: []
    };

    console.log('🧹 Starting full cleanup process...');

    try {
      // 1. Client-side cleanup (2+ hours old)
      const clientResult = await this.performClientCleanup(2);
      stats.clientDeleted = clientResult.deleted;
      if (clientResult.error) {
        stats.errors.push(`Client: ${clientResult.error}`);
      }

      // 2. Server-side cleanup (48+ hours old)
      const serverResult = await this.performServerCleanup(48);
      stats.serverDeleted = serverResult.deleted;
      if (serverResult.error) {
        stats.errors.push(`Server: ${serverResult.error}`);
      }

      // 3. Update last cleanup time
      await this.setLastCleanupTime(Date.now());

      console.log('✅ Full cleanup completed:', {
        client: stats.clientDeleted,
        server: stats.serverDeleted,
        errors: stats.errors.length
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Full cleanup: ${errorMsg}`);
      console.error('❌ Full cleanup failed:', error);
    }

    return stats;
  }

  /**
   * Perform quick cleanup (client-side only)
   */
  async performQuickCleanup(): Promise<void> {
    try {
      console.log('⚡ Performing quick cleanup...');
      const result = await this.performClientCleanup(1); // 1 hour threshold
      console.log(`⚡ Quick cleanup: deleted ${result.deleted} files`);
    } catch (error) {
      console.warn('⚠️ Quick cleanup failed:', error);
    }
  }

  /**
   * Client-side cleanup using edgeAIService
   */
  private async performClientCleanup(hoursThreshold: number): Promise<{deleted: number; error?: string}> {
    try {
      await edgeAIService.cleanupOldTempFiles(hoursThreshold);
      
      // Since edgeAIService doesn't return count, we'll assume success
      // In a real implementation, you'd modify edgeAIService to return stats
      return { deleted: 0 }; // Placeholder - edgeAIService logs success/failure
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { deleted: 0, error: errorMsg };
    }
  }

  /**
   * Server-side cleanup using Edge Function
   */
  private async performServerCleanup(hoursThreshold: number): Promise<{deleted: number; error?: string}> {
    try {
      console.log(`🌐 Calling server cleanup for files older than ${hoursThreshold} hours...`);
      
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        deleted: number;
        error?: string;
        details?: string;
      }>('clean-audio-temp', {
        body: { hours: hoursThreshold }
      });

      if (error) {
        console.error('❌ Server cleanup invocation failed:', error);
        return { deleted: 0, error: error.message || 'Invocation failed' };
      }

      if (!data?.success) {
        const errorMsg = data?.error || data?.details || 'Unknown server error';
        console.error('❌ Server cleanup failed:', errorMsg);
        return { deleted: 0, error: errorMsg };
      }

      console.log(`✅ Server cleanup successful: ${data.deleted} files deleted`);
      return { deleted: data.deleted || 0 };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Server cleanup exception:', error);
      return { deleted: 0, error: errorMsg };
    }
  }

  /**
   * Manually trigger cleanup (for debugging/testing)
   */
  async manualCleanup(): Promise<CleanupStats> {
    console.log('🔧 Manual cleanup triggered');
    return await this.performFullCleanup();
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{lastCleanup: string; daysSince: number}> {
    const lastCleanup = await this.getLastCleanupTime();
    const daysSince = (Date.now() - lastCleanup) / (1000 * 60 * 60 * 24);
    
    return {
      lastCleanup: new Date(lastCleanup).toISOString(),
      daysSince: Math.round(daysSince * 10) / 10 // Round to 1 decimal
    };
  }

  /**
   * Stop cleanup service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = undefined;
    }

    console.log('🔄 Voice cleanup service destroyed');
  }

  // Private helpers
  private async getLastCleanupTime(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem('voice_cleanup_last');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  private async setLastCleanupTime(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem('voice_cleanup_last', timestamp.toString());
    } catch (error) {
      console.warn('⚠️ Failed to update last cleanup time:', error);
    }
  }
}

// Singleton instance
export const voiceCleanupService = VoiceCleanupService.getInstance();
export default voiceCleanupService;
