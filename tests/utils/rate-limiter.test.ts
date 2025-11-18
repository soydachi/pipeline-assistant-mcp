import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  createApiRateLimiter,
  createWebhookRateLimiter,
  createRateLimitHeaders,
} from '../../src/utils/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.stop();
    }
  });

  describe('Basic rate limiting', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 60000,
        name: 'test',
      });
    });

    it('should allow requests within limit', () => {
      const result1 = rateLimiter.checkLimit('client1');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);
      expect(result1.current).toBe(1);
      expect(result1.limit).toBe(3);

      const result2 = rateLimiter.checkLimit('client1');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
      expect(result2.current).toBe(2);

      const result3 = rateLimiter.checkLimit('client1');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
      expect(result3.current).toBe(3);
    });

    it('should block requests exceeding limit', () => {
      // Use up all requests
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');

      // Fourth request should be blocked
      const result = rateLimiter.checkLimit('client1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.current).toBe(3);
    });

    it('should track clients independently', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');

      // client1 is at limit
      const result1 = rateLimiter.checkLimit('client1');
      expect(result1.allowed).toBe(false);

      // client2 should still be allowed
      const result2 = rateLimiter.checkLimit('client2');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(2);
    });
  });

  describe('Window reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      rateLimiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 1000, // 1 second window
        name: 'test',
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reset limit after window expires', () => {
      // Use up all requests
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      expect(rateLimiter.checkLimit('client1').allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(1001);

      // Should be allowed again
      const result = rateLimiter.checkLimit('client1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.current).toBe(1);
    });

    it('should calculate resetMs correctly', () => {
      const result = rateLimiter.checkLimit('client1');
      expect(result.resetMs).toBeLessThanOrEqual(1000);
      expect(result.resetMs).toBeGreaterThan(0);

      // Advance time by 500ms
      vi.advanceTimersByTime(500);

      const result2 = rateLimiter.checkLimit('client1');
      expect(result2.resetMs).toBeLessThanOrEqual(500);
      expect(result2.resetMs).toBeGreaterThan(0);
    });
  });

  describe('Reset methods', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        name: 'test',
      });
    });

    it('should reset individual client', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      expect(rateLimiter.checkLimit('client1').allowed).toBe(false);

      rateLimiter.reset('client1');

      const result = rateLimiter.checkLimit('client1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should reset all clients', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client2');
      rateLimiter.checkLimit('client2');

      expect(rateLimiter.getActiveClients()).toBe(2);

      rateLimiter.resetAll();

      expect(rateLimiter.getActiveClients()).toBe(0);
      expect(rateLimiter.checkLimit('client1').allowed).toBe(true);
      expect(rateLimiter.checkLimit('client2').allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 60000,
        name: 'test',
      });
    });

    it('should return full limit for new client', () => {
      const status = rateLimiter.getStatus('newclient');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(3);
      expect(status.current).toBe(0);
    });

    it('should return current status without consuming a request', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');

      // getStatus should not consume a request
      const status = rateLimiter.getStatus('client1');
      expect(status.remaining).toBe(1);
      expect(status.current).toBe(2);

      // Verify request wasn't consumed
      const check = rateLimiter.checkLimit('client1');
      expect(check.allowed).toBe(true);
      expect(check.current).toBe(3);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cleanup expired clients', () => {
      rateLimiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 1000,
        name: 'test',
      });

      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client2');
      expect(rateLimiter.getActiveClients()).toBe(2);

      // Advance past window to trigger cleanup
      vi.advanceTimersByTime(1001);

      // Cleanup runs on interval, trigger it
      vi.advanceTimersByTime(1000);

      expect(rateLimiter.getActiveClients()).toBe(0);
    });
  });
});

describe('Factory functions', () => {
  let rateLimiter: RateLimiter;

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.stop();
    }
  });

  describe('createApiRateLimiter', () => {
    it('should create rate limiter with default settings', () => {
      rateLimiter = createApiRateLimiter();

      // Should allow 100 requests per minute
      const status = rateLimiter.getStatus('client1');
      expect(status.remaining).toBe(100);
    });

    it('should accept custom configuration', () => {
      rateLimiter = createApiRateLimiter({
        maxRequests: 50,
      });

      const status = rateLimiter.getStatus('client1');
      expect(status.remaining).toBe(50);
    });
  });

  describe('createWebhookRateLimiter', () => {
    it('should create rate limiter with default settings', () => {
      rateLimiter = createWebhookRateLimiter();

      // Should allow 30 requests per minute
      const status = rateLimiter.getStatus('client1');
      expect(status.remaining).toBe(30);
    });

    it('should accept custom configuration', () => {
      rateLimiter = createWebhookRateLimiter({
        maxRequests: 10,
      });

      const status = rateLimiter.getStatus('client1');
      expect(status.remaining).toBe(10);
    });
  });
});

describe('createRateLimitHeaders', () => {
  it('should create proper rate limit headers', () => {
    const result = {
      allowed: true,
      remaining: 5,
      resetMs: 30000,
      current: 10,
      limit: 15,
    };

    const headers = createRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('15');
    expect(headers['X-RateLimit-Remaining']).toBe('5');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('should handle zero remaining', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetMs: 60000,
      current: 100,
      limit: 100,
    };

    const headers = createRateLimitHeaders(result);

    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['X-RateLimit-Limit']).toBe('100');
  });
});
