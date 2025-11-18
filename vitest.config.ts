import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/*.test.ts',
      ],
      thresholds: {
        // Current: ~55% lines, ~60% functions, ~46% branches
        // TODO: Increase to 80% after adding tests for:
        // - server.ts (MCP handlers)
        // - wiki-manager.ts (file operations)
        // - azure-devops/comment-thread-manager.ts
        // - azure-devops/pr-status-manager.ts
        // - azure-devops/webhook-handler.ts
        lines: 50,
        functions: 55,
        branches: 40,
        statements: 50,
      },
    },
    typecheck: {
      enabled: false, // Set to true if you want type checking during tests
    },
  },
});
