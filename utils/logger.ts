/**
 * Merkezi log yönetimi için utility
 * Production'da logları kapatır, development'ta açık bırakır
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
}

const config: LoggerConfig = {
  enabled: __DEV__,
  level: 'debug'
};

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!config.enabled) return false;
    return logLevels[level] >= logLevels[config.level];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🐛 [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      console.error(`❌ [ERROR] ${message}`, error);
    }
  }

  // Grup logları için
  group(label: string): void {
    if (config.enabled) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (config.enabled) {
      console.groupEnd();
    }
  }
}

export const logger = new Logger();
export default logger; 