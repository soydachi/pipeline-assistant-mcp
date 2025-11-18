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
src/                 # Core TypeScript source
├── server.ts        # MCP server
├── pipeline-*.ts    # Pipeline logic
├── azure-devops/    # Azure DevOps integration
cli/                 # CLI tools
vscode-extension/    # VS Code extension
tests/               # Test suite
wiki/standards/      # Corporate standards
```

## Code Standards

### TypeScript

- Use strict mode
- Avoid `any` type - use proper interfaces
- Document public functions with JSDoc
- Handle errors explicitly

### Security

- Never hardcode secrets
- Validate all inputs
- Use parameterized queries
- Redact sensitive data in logs

### Testing

- Write tests for new features
- Maintain existing test coverage
- Use descriptive test names
- Mock external dependencies

### Quality Checks

Before submitting:

```bash
npm run lint        # Check code style
npm test            # Run tests
npm run build       # Verify compilation
```

## Areas for Contribution

### Good First Issues

- Documentation improvements
- Additional pipeline templates
- New violation detection rules
- Test coverage improvements

### Advanced

- GitLab integration
- Terraform/IaC support
- Web dashboard
- Performance optimizations

## Review Process

1. Automated checks must pass
2. At least one maintainer review
3. Changes may require updates based on feedback
4. Merged after approval

## Questions?

- Open a GitHub issue
- Check existing documentation
- Review similar PRs

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
