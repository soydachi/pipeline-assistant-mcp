/**
 * Structured Logger Utility
 *
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Structured metadata
 * - Context/correlation IDs
 * - Secret masking
 */

import pino from 'pino';

// Patterns to mask in logs
const SECRET_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /pat/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
];

// Values to mask
const MASK_VALUE = '***REDACTED***';

/**
 * Recursively mask sensitive values in objects
 */
function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const shouldMask = SECRET_PATTERNS.some(pattern => pattern.test(key));
      if (shouldMask && typeof value === 'string') {
        masked[key] = MASK_VALUE;
      } else {
        masked[key] = maskSecrets(value);
      }
    }
    return masked;
  }

  return obj;
}

// Log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Base pino configuration
const pinoConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'secret',
      'token',
      'apiKey',
      'pat',
      'auth',
      'credential',
      'privateKey',
      '*.password',
      '*.secret',
      '*.token',
      '*.apiKey',
      '*.pat',
    ],
    censor: MASK_VALUE,
  },
};

// Create base logger
const baseLogger = pino(pinoConfig);

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

/**
 * Create a logger with a specific module name
 */
export function createLogger(moduleName: string): Logger {
  const childLogger = baseLogger.child({ module: moduleName });

  return {
    debug(message: string, context?: LogContext): void {
      if (context) {
        childLogger.debug(maskSecrets(context), message);
      } else {
        childLogger.debug(message);
      }
    },

    info(message: string, context?: LogContext): void {
      if (context) {
        childLogger.info(maskSecrets(context), message);
      } else {
        childLogger.info(message);
      }
    },

    warn(message: string, context?: LogContext): void {
      if (context) {
        childLogger.warn(maskSecrets(context), message);
      } else {
        childLogger.warn(message);
      }
    },

    error(message: string, context?: LogContext): void {
      if (context) {
        childLogger.error(maskSecrets(context), message);
      } else {
        childLogger.error(message);
      }
    },

    child(bindings: LogContext): Logger {
      const newChild = childLogger.child(bindings as pino.Bindings);
      return createLoggerFromPino(newChild, moduleName);
    },
  };
}

/**
 * Create logger wrapper from pino instance
 */
function createLoggerFromPino(pinoInstance: pino.Logger, moduleName: string): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.debug(maskSecrets(context), message);
      } else {
        pinoInstance.debug(message);
      }
    },

    info(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.info(maskSecrets(context), message);
      } else {
        pinoInstance.info(message);
      }
    },

    warn(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.warn(maskSecrets(context), message);
      } else {
        pinoInstance.warn(message);
      }
    },

    error(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.error(maskSecrets(context), message);
      } else {
        pinoInstance.error(message);
      }
    },

    child(bindings: LogContext): Logger {
      const newChild = pinoInstance.child(bindings as pino.Bindings);
      return createLoggerFromPino(newChild, moduleName);
    },
  };
}

// Default logger instance
export const logger = createLogger('pipeline-assistant');

// Export for testing
export { maskSecrets };
