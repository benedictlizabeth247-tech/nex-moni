/**
 * @fileOverview Standardized logging interface.
 * Prepared for future integration with observability services.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'security';

interface LogEntry {
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const logger = {
  log: (level: LogLevel, message: string, metadata?: Record<string, any>) => {
    const entry: LogEntry = {
      level,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // In production, this would send to a service like Sentry or LogRocket
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, metadata || '');
    }
  },

  info: (message: string, metadata?: Record<string, any>) => logger.log('info', message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => logger.log('warn', message, metadata),
  error: (message: string, metadata?: Record<string, any>) => logger.log('error', message, metadata),
  security: (message: string, metadata?: Record<string, any>) => logger.log('security', message, metadata),
};
