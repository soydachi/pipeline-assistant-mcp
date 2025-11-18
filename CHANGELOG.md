# Changelog

All notable changes to Pipeline Assistant MCP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Planned
- GitLab integration
- Web dashboard
- Terraform/IaC support
- Advanced auto-fix

---

## [1.3.0] - 2025-11-18

### Added

#### Multi-Platform Architecture
- Platform adapters for Azure DevOps and GitHub Actions
- Platform-specific template generation with correct syntax
- Template validator with comprehensive checks
- Automatic platform detection from YAML content

#### Template Validation
- Invalid/outdated task detection (TruffleHog@, Trivy@, Snyk@1, SonarQube@5)
- Cross-platform syntax validation (detects wrong variable syntax)
- Security pattern detection (hardcoded passwords, API keys, secrets, tokens)
- YAML syntax validation
- Mixed variable syntax detection in Azure DevOps

#### Platform-Specific Features
- Azure DevOps: SonarQube@6, SnykSecurityScan@1, Docker@2, PublishBuildArtifacts@1
- GitHub Actions: actions/checkout@v4, actions/setup-node@v4, snyk/actions@master
- Correct task mappings for security tools (TruffleHog, Trivy, Snyk, SonarCloud)

#### Testing & Quality
- 341+ tests with comprehensive coverage
- Generator tests for both platforms (18 Azure, 23 GitHub)
- Validator tests for template validation (22 active, 7 skipped edge cases)
- Real template validation tests

#### New CLI Commands
- `platforms` - List available platforms
- `templates` - List available templates by platform
- `services` - List available service configurations
- `--platform` flag for multi-platform support

---

## [1.2.0] - 2025-11-18

### Added

#### Security Enhancements
- Webhook signature validation with HMAC-SHA256
- Timing-safe comparison to prevent timing attacks
- Enhanced secret masking in logs (Bearer tokens, JWT, API keys, URLs with credentials)
- Rate limiting with sliding window algorithm
- Factory functions for API and webhook rate limiters

#### Architecture Improvements
- Dependency Injection container for better testability
- Split WikiManager into focused modules (MarkdownParser, MetricsTracker, PolicyVersioner)
- Extracted constants to dedicated files
- Stricter TypeScript configuration

#### Testing & Quality
- 259+ tests with comprehensive coverage
- Zod validation for all inputs
- Structured logging across all modules
- Removed test fixtures in favor of unit tests

---

## [1.1.0] - 2025-01-18

### Added

#### Azure DevOps Integration
- Complete API client with PAT authentication
- PR Bot with automated analysis
- Inline comments on violations
- Status checks for merge blocking
- Webhook handler for auto-analysis
- Retry logic with exponential backoff
- Cache system with configurable TTL

#### Features
- Configuration from environment variables or JSON
- Learning vs enforcement modes
- Thread management (create, update, resolve)
- Performance metrics tracking
- Structured logging with secret redaction

#### Tests
- 65+ tests for Azure DevOps integration
- Full coverage of client and PR bot functionality

---

## [1.0.0] - 2024-12-19

### Added

#### Core Features
- Pipeline generation from corporate standards
- Security analysis (15+ violation types)
- Compliance scoring (0-100)
- Policy enforcement

#### Integrations
- VS Code extension with 6 providers
- GitHub Actions workflow
- MCP server implementation

#### CLI Tools
- `pipeline-assistant` - Generate and analyze
- `pipeline-wiki` - Standards management
- `pipeline-pr` - PR analysis

#### Templates
- .NET, Node.js, Python microservices
- Multi-stage pipeline support
- Docker and Kubernetes integration
