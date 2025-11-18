/**
 * Rate Limiter
 *
 * Provides rate limiting functionality using token bucket algorithm
 */

import { createLogger } from './logger.js';

const logger = createLogger('RateLimiter');

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier for this rate limiter (for logging) */
  name?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until reset in milliseconds */
  resetMs: number;
  /** Current request count */
  current: number;
  /** Maximum allowed requests */
  limit: number;
}

/**
 * Client rate limit state
 */
interface ClientState {
  count: number;
  windowStart: number;
}

/**
 * Rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private clients: Map<string, ClientState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      name: config.name || 'default',
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Check if a request from a client should be allowed
   *
   * @param clientId - Unique identifier for the client (e.g., IP address, user ID)
   * @returns Rate limit check result
   */
  checkLimit(clientId: string): RateLimitResult {
    const now = Date.now();
    let state = this.clients.get(clientId);

    // Initialize or reset window if expired
    if (!state || now - state.windowStart >= this.config.windowMs) {
      state = {
        count: 0,
        windowStart: now,
      };
      this.clients.set(clientId, state);
    }

    const resetMs = this.config.windowMs - (now - state.windowStart);
    const remaining = Math.max(0, this.config.maxRequests - state.count);
    const allowed = state.count < this.config.maxRequests;

    if (allowed) {
      state.count++;
    } else {
      logger.warn('Rate limit exceeded', {
        limiter: this.config.name,
        clientId: this.maskClientId(clientId),
        current: state.count,
        limit: this.config.maxRequests,
        resetMs,
      });
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : 0,
      resetMs,
      current: state.count,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Reset rate limit for a specific client
   */
  reset(clientId: string): void {
    this.clients.delete(clientId);
    logger.debug('Rate limit reset', {
      limiter: this.config.name,
      clientId: this.maskClientId(clientId),
    });
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    const count = this.clients.size;
    this.clients.clear();
    logger.debug('All rate limits reset', {
      limiter: this.config.name,
      clientsCleared: count,
    });
  }

  /**
   * Get current status for a client
   */
  getStatus(clientId: string): RateLimitResult {
    const now = Date.now();
    const state = this.clients.get(clientId);

    if (!state || now - state.windowStart >= this.config.windowMs) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetMs: 0,
        current: 0,
        limit: this.config.maxRequests,
      };
    }

    const resetMs = this.config.windowMs - (now - state.windowStart);
    const remaining = Math.max(0, this.config.maxRequests - state.count);

    return {
      allowed: state.count < this.config.maxRequests,
      remaining,
      resetMs,
      current: state.count,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Get number of active clients
   */
  getActiveClients(): number {
    return this.clients.size;
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Start cleanup interval to remove expired client states
   */
  private startCleanup(): void {
    // Run cleanup every window period
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.windowMs);

    // Don't prevent Node from exiting
    this.cleanupInterval.unref();
  }

  /**
   * Clean up expired client states
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, state] of this.clients.entries()) {
      if (now - state.windowStart >= this.config.windowMs) {
        this.clients.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', {
        limiter: this.config.name,
        clientsRemoved: cleaned,
        clientsRemaining: this.clients.size,
      });
    }
  }

  /**
   * Mask client ID for logging (privacy)
   */
  private maskClientId(clientId: string): string {
    if (clientId.length <= 8) {
      return clientId;
    }
    return `${clientId.slice(0, 4)}...${clientId.slice(-4)}`;
  }
}

/**
 * Create a rate limiter for API calls
 *
 * Default: 100 requests per minute
 */
export function createApiRateLimiter(
  config: Partial<RateLimiterConfig> = {}
): RateLimiter {
  return new RateLimiter({
    maxRequests: config.maxRequests ?? 100,
    windowMs: config.windowMs ?? 60000, // 1 minute
    name: config.name ?? 'api',
  });
}

/**
 * Create a rate limiter for webhook events
 *
 * Default: 30 requests per minute (more restrictive)
 */
export function createWebhookRateLimiter(
  config: Partial<RateLimiterConfig> = {}
): RateLimiter {
  return new RateLimiter({
    maxRequests: config.maxRequests ?? 30,
    windowMs: config.windowMs ?? 60000, // 1 minute
    name: config.name ?? 'webhook',
  });
}

/**
 * Rate limiter middleware result
 */
export interface RateLimitMiddlewareResult {
  limited: boolean;
  headers: Record<string, string>;
  retryAfter?: number;
}

/**
 * Create rate limit headers for HTTP responses
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + result.resetMs / 1000).toString(),
  };
}
