/**
 * Crash Reporting Service
 * 
 * Post-AI cleanup için lightweight crash reporting.
 * Expo ile entegre olarak çalışır, PII scrubbing içerir.
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CrashReport {
  timestamp: string;
  error: {
    message: string;
    stack?: string;
    componentStack?: string;
  };
  device: {
    platform: string;
    osVersion: string;
    appVersion: string;
    deviceId?: string;
  };
  context?: {
    userId?: string;
    feature?: string;
    source?: string;
  };
}

class CrashReportingService {
  private static instance: CrashReportingService;
  
  public static getInstance(): CrashReportingService {
    if (!CrashReportingService.instance) {
      CrashReportingService.instance = new CrashReportingService();
    }
    return CrashReportingService.instance;
  }

  /**
   * PII Scrubbing: Remove sensitive information from stack traces
   */
  private sanitizeStackTrace(stack?: string): string {
    if (!stack) return '';

    return stack
      // Remove file system paths that might contain usernames
      .replace(/\/Users\/[^\/]+/g, '/Users/[USER]')
      .replace(/\\Users\\[^\\]+/g, '\\Users\\[USER]')
      // Remove potential API keys or tokens
      .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]')
      // Remove email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      // Limit stack trace length
      .substring(0, 1000);
  }

  /**
   * Collect device information for crash context
   */
  private async getDeviceInfo(): Promise<CrashReport['device']> {
    try {
      const appVersion = Constants.expoConfig?.version || 'unknown';
      
      return {
        platform: Device.osName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        appVersion: appVersion,
        deviceId: Device.modelName || undefined
      };
    } catch (error) {
      console.warn('Failed to get device info:', error);
      return {
        platform: 'unknown',
        osVersion: 'unknown', 
        appVersion: 'unknown'
      };
    }
  }

  /**
   * Report crash to Expo and local storage
   */
  public async reportCrash(
    error: Error,
    errorInfo?: any,
    context?: { 
      userId?: string; 
      feature?: string; 
      source?: string;
    }
  ): Promise<void> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const crashReport: CrashReport = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message || 'Unknown error',
          stack: this.sanitizeStackTrace(error.stack),
          componentStack: errorInfo?.componentStack 
            ? this.sanitizeStackTrace(errorInfo.componentStack)
            : undefined
        },
        device: deviceInfo,
        context: context ? {
          userId: context.userId ? '[USER_ID_HASH]' : undefined, // Never log actual user ID
          feature: context.feature,
          source: context.source
        } : undefined
      };

      // Store locally for debugging and user support
      await this.storeCrashLocally(crashReport);

      // In production, this would send to external service
      // For now, we'll use console for development tracking
      if (__DEV__) {
        console.group('🚨 CRASH REPORT');
        console.error('Error:', error.message);
        console.error('Context:', context);
        console.error('Device:', deviceInfo);
        console.groupEnd();
      }

      // TODO: Integrate with Expo Crash Reporting or Sentry in production
      // await this.sendToExpo(crashReport);
      
    } catch (reportingError) {
      console.error('Failed to report crash:', reportingError);
    }
  }

  /**
   * Store crash locally for user support and debugging
   */
  private async storeCrashLocally(crashReport: CrashReport): Promise<void> {
    try {
      const existingReports = await AsyncStorage.getItem('crash_reports');
      const reports = existingReports ? JSON.parse(existingReports) : [];
      
      reports.push(crashReport);
      
      // Keep only last 5 crash reports to avoid storage bloat
      const recentReports = reports.slice(-5);
      
      await AsyncStorage.setItem('crash_reports', JSON.stringify(recentReports));
      
      console.log(`📝 Crash report stored locally. Total reports: ${recentReports.length}`);
    } catch (error) {
      console.error('Failed to store crash report locally:', error);
    }
  }

  /**
   * Get stored crash reports for debugging
   */
  public async getCrashReports(): Promise<CrashReport[]> {
    try {
      const reports = await AsyncStorage.getItem('crash_reports');
      return reports ? JSON.parse(reports) : [];
    } catch (error) {
      console.error('Failed to get crash reports:', error);
      return [];
    }
  }

  /**
   * Clear stored crash reports
   */
  public async clearCrashReports(): Promise<void> {
    try {
      await AsyncStorage.removeItem('crash_reports');
      console.log('🗑️ Crash reports cleared');
    } catch (error) {
      console.error('Failed to clear crash reports:', error);
    }
  }

  /**
   * Get crash report summary for debug screen
   */
  public async getCrashSummary(): Promise<{
    totalCrashes: number;
    lastCrashTime?: string;
    commonErrors: string[];
  }> {
    try {
      const reports = await this.getCrashReports();
      
      if (reports.length === 0) {
        return {
          totalCrashes: 0,
          commonErrors: []
        };
      }

      const lastCrashTime = reports[reports.length - 1]?.timestamp;
      const commonErrors = [...new Set(reports.map(r => r.error.message))]
        .slice(0, 3); // Top 3 unique errors

      return {
        totalCrashes: reports.length,
        lastCrashTime,
        commonErrors
      };
    } catch (error) {
      console.error('Failed to get crash summary:', error);
      return {
        totalCrashes: 0,
        commonErrors: []
      };
    }
  }
}

export const crashReporting = CrashReportingService.getInstance();
export default crashReporting;
