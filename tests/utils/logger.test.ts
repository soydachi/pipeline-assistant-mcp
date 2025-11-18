import { describe, it, expect } from 'vitest';
import { maskSecrets } from '../../src/utils/logger';

describe('maskSecrets', () => {
  const REDACTED = '***REDACTED***';

  describe('Key-based masking', () => {
    it('should mask password fields', () => {
      const result = maskSecrets({ password: 'secret123' });
      expect(result).toEqual({ password: REDACTED });
    });

    it('should mask token fields', () => {
      const result = maskSecrets({ token: 'abc123', accessToken: 'xyz789' });
      expect(result).toEqual({ token: REDACTED, accessToken: REDACTED });
    });

    it('should mask secret fields', () => {
      const result = maskSecrets({ secret: 'value', webhookSecret: 'value2' });
      expect(result).toEqual({ secret: REDACTED, webhookSecret: REDACTED });
    });

    it('should mask apiKey fields', () => {
      const result = maskSecrets({ apiKey: 'key1', api_key: 'key2' });
      expect(result).toEqual({ apiKey: REDACTED, api_key: REDACTED });
    });

    it('should mask PAT fields', () => {
      const result = maskSecrets({ pat: 'token', personalAccessToken: 'token2' });
      expect(result).toEqual({ pat: REDACTED, personalAccessToken: REDACTED });
    });

    it('should mask auth fields', () => {
      const result = maskSecrets({ auth: 'value', authentication: 'value2' });
      expect(result).toEqual({ auth: REDACTED, authentication: REDACTED });
    });

    it('should mask authorization fields', () => {
      const result = maskSecrets({ authorization: 'Bearer token123' });
      expect(result).toEqual({ authorization: REDACTED });
    });

    it('should mask credential fields', () => {
      const result = maskSecrets({ credential: 'cred', credentials: 'creds' });
      expect(result).toEqual({ credential: REDACTED, credentials: REDACTED });
    });

    it('should mask privateKey fields', () => {
      const result = maskSecrets({ privateKey: 'key', private_key: 'key2' });
      expect(result).toEqual({ privateKey: REDACTED, private_key: REDACTED });
    });

    it('should be case insensitive', () => {
      const result = maskSecrets({
        PASSWORD: 'secret',
        Token: 'token',
        API_KEY: 'key',
      });
      expect(result).toEqual({
        PASSWORD: REDACTED,
        Token: REDACTED,
        API_KEY: REDACTED,
      });
    });
  });

  describe('Value-based masking', () => {
    it('should mask Bearer tokens in strings', () => {
      const result = maskSecrets({
        message: 'Using Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 for auth',
      });
      expect(result).toEqual({
        message: `Using ${REDACTED} for auth`,
      });
    });

    it('should mask Basic auth in strings', () => {
      const result = maskSecrets({
        header: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
      });
      expect(result).toEqual({
        header: REDACTED,
      });
    });

    it('should mask JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = maskSecrets({ data: `Token: ${jwt}` });
      expect(result).toEqual({
        data: `Token: ${REDACTED}`,
      });
    });

    it('should mask URLs with embedded credentials', () => {
      const result = maskSecrets({
        url: 'https://user:password@example.com/api',
      });
      expect(result).toEqual({
        url: `${REDACTED}example.com/api`,
      });
    });

    it('should mask long hex strings (potential API keys)', () => {
      const result = maskSecrets({
        key: 'Found key: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
      });
      // The 36-char hex string should be masked
      expect((result as any).key).toContain(REDACTED);
    });
  });

  describe('Nested objects', () => {
    it('should mask secrets in nested objects', () => {
      const result = maskSecrets({
        config: {
          database: {
            password: 'dbpass',
            host: 'localhost',
          },
        },
      });
      expect(result).toEqual({
        config: {
          database: {
            password: REDACTED,
            host: 'localhost',
          },
        },
      });
    });

    it('should mask secrets in arrays', () => {
      const result = maskSecrets({
        tokens: [
          { token: 'token1' },
          { token: 'token2' },
        ],
      });
      expect(result).toEqual({
        tokens: [
          { token: REDACTED },
          { token: REDACTED },
        ],
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      const result = maskSecrets(null);
      expect(result).toBeNull();
    });

    it('should handle undefined values', () => {
      const result = maskSecrets(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(maskSecrets(42)).toBe(42);
      expect(maskSecrets(true)).toBe(true);
    });

    it('should not mask non-sensitive keys', () => {
      const result = maskSecrets({
        name: 'John',
        email: 'john@example.com',
        count: 42,
      });
      expect(result).toEqual({
        name: 'John',
        email: 'john@example.com',
        count: 42,
      });
    });

    it('should handle empty objects', () => {
      const result = maskSecrets({});
      expect(result).toEqual({});
    });

    it('should handle empty arrays', () => {
      const result = maskSecrets([]);
      expect(result).toEqual([]);
    });

    it('should not mask short strings that look like hex', () => {
      // Short strings should not be masked even if hex
      const result = maskSecrets({ id: 'abc123' });
      expect(result).toEqual({ id: 'abc123' });
    });
  });

  describe('Real-world scenarios', () => {
    it('should mask Azure DevOps config', () => {
      const config = {
        organizationUrl: 'https://dev.azure.com/myorg',
        project: 'MyProject',
        personalAccessToken: 'vso_pat_token_here_12345678901234567890123456',
        timeout: 30000,
      };

      const result = maskSecrets(config);
      expect(result).toEqual({
        organizationUrl: 'https://dev.azure.com/myorg',
        project: 'MyProject',
        personalAccessToken: REDACTED,
        timeout: 30000,
      });
    });

    it('should mask webhook payload with secrets', () => {
      const payload = {
        eventType: 'push',
        signature: 'sha256=abc123def456',
        resource: {
          repository: {
            name: 'my-repo',
          },
        },
      };

      const result = maskSecrets(payload);
      // signature should be masked because it matches secret pattern
      expect(result).toEqual({
        eventType: 'push',
        signature: REDACTED,
        resource: {
          repository: {
            name: 'my-repo',
          },
        },
      });
    });

    it('should mask error messages with tokens', () => {
      const error = {
        message: 'Auth failed for Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.rTCH8cLoGxAm_xw68z-zXVKi9ie6xJn9tnVWjd_9ftE',
        code: 401,
      };

      const result = maskSecrets(error) as any;
      expect(result.message).toContain(REDACTED);
      expect(result.code).toBe(401);
    });
  });
});
