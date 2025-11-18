# Contributing to Pipeline Assistant MCP

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful and constructive. We welcome contributors of all experience levels.

## How to Contribute

### Reporting Issues

1. Search existing issues first
2. Use the issue template
3. Include reproduction steps
4. Provide environment details (Node.js version, OS)

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Write/update tests
5. Run quality checks: `npm run lint && npm test`
6. Commit with clear message: `git commit -m "feat: add new feature"`
7. Push and create Pull Request

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

## Development Setup

```bash
git clone https://github.com/soydachi/pipeline-assistant-mcp.git
cd pipeline-assistant-mcp
npm install
npm run build
npm test
```

### Project Structure

```
src/                      # Core TypeScript source
├── server.ts             # MCP server entry point
├── pipeline-generator.ts # Pipeline generation logic
├── pipeline-analyzer.ts  # Security and compliance analysis
├── policy-enforcer.ts    # Policy enforcement engine
├── wiki-manager.ts       # Wiki and standards management
├── container.ts          # Dependency injection container
├── platforms/            # Multi-platform support
│   ├── index.ts          # Platform registry and detection
│   ├── types.ts          # Platform interfaces and types
│   ├── azure-devops.ts   # Azure DevOps adapter
│   └── github-actions.ts # GitHub Actions adapter
├── validators/           # Validation utilities
│   └── template-validator.ts # Template validation
├── azure-devops/         # Azure DevOps integration
│   ├── client.ts         # API client with retry logic
│   ├── pr-bot.ts         # PR analysis bot
│   ├── config.ts         # Configuration management
│   └── webhook-handler.ts# Webhook processing
└── utils/                # Shared utilities
    ├── logger.ts         # Structured logging with secret masking
    ├── validation.ts     # Zod schemas for input validation
    ├── rate-limiter.ts   # Rate limiting utility
    └── formatting.ts     # Output formatting

cli/                      # CLI tools
├── pipeline-assistant.ts # Main CLI (generate/analyze/suggest)
├── wiki-cli.ts           # Wiki management
└── pr-bot-cli.ts         # PR analysis

vscode-extension/         # VS Code extension
├── src/
│   ├── extension.ts      # Extension entry point
│   └── providers/        # 6 specialized providers

tests/                    # Test suite (Vitest)
├── *.test.ts             # Unit tests
├── platforms/            # Platform adapter tests
├── validators/           # Validator tests
├── azure-devops/         # Azure DevOps tests
└── utils/                # Utility tests

wiki/standards/           # Corporate standards v2.0
├── core/                 # Stage definitions
│   └── stages.yaml       # Mandatory 6-stage structure
├── security/             # Security policies
│   ├── policies.yaml     # SEC-001 to SEC-010
│   └── sla.yaml          # Remediation SLAs
├── quality/              # Quality standards
│   └── gates.yaml        # Quality gate thresholds
├── platforms/            # Platform-specific templates
│   ├── azure/templates/  # Azure DevOps templates
│   └── github/templates/ # GitHub Actions templates
├── migration/            # Migration guides
└── governance/           # Governance documentation
```

## Code Standards

### TypeScript

- Use strict mode (enabled in tsconfig.json)
- Avoid `any` type - use proper interfaces
- Document public functions with JSDoc
- Handle errors explicitly with proper types
- Use Zod for runtime validation

### Security

- Never hardcode secrets
- Validate all inputs with Zod schemas
- Use parameterized queries
- Redact sensitive data in logs
- Implement rate limiting for public endpoints
- Use timing-safe comparisons for secrets

### Testing

- Write tests for new features (Vitest)
- Maintain existing test coverage (~55%+)
- Use descriptive test names
- Mock external dependencies
- Test edge cases and error conditions

### Logging

Use the structured logger from `src/utils/logger.ts`:

```typescript
import { logger } from './utils/logger';

logger.info('Operation completed', { userId: 123, duration: 45 });
logger.error('Operation failed', { error: err.message });
```

### Dependency Injection

Use the DI container for service instantiation:

```typescript
import { container } from './container';

const analyzer = container.resolve('pipelineAnalyzer');
```

### Quality Checks

Before submitting:

```bash
npm run lint        # Check code style
npm test            # Run tests (341+ tests)
npm run build       # Verify compilation
```

## Areas for Contribution

### Good First Issues

- Documentation improvements
- Additional pipeline templates
- New violation detection rules
- Test coverage improvements
- Bug fixes with clear reproduction steps

### Intermediate

- New Azure service integrations
- VS Code extension enhancements
- CLI improvements
- Performance optimizations

### Advanced

- GitLab integration
- Terraform/IaC support
- Web dashboard
- Custom rule engine
- Plugin system

## Review Process

1. Automated checks must pass (lint, tests, build)
2. At least one maintainer review
3. Changes may require updates based on feedback
4. Security-sensitive changes require additional review
5. Merged after approval

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/utils/logger.test.ts

# Run with coverage
npx vitest run --coverage

# Watch mode
npx vitest watch
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', () => {
    // Arrange
    const input = { /* ... */ };

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

## Questions?

- Open a GitHub issue
- Check existing documentation
- Review similar PRs

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
