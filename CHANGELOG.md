# Changelog

All notable changes to Pipeline Assistant MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-18

### 🎉 Azure DevOps Integration Complete

Full integration with Azure DevOps, including PR analysis, inline comments, and status checks.

### Added

#### Azure DevOps Integration - Phase 1 (Client & Configuration)
- **AzureDevOpsClient** - Complete API client with authentication
  - Personal Access Token (PAT) authentication
  - List and manage Pull Requests
  - Get file changes and content
  - Cache system with TTL (5 minutes)
  - Performance metrics tracking

- **Configuration Management**
  - Load from environment variables (AZDO_ORG_URL, AZDO_PAT, etc.)
  - Load from JSON configuration files
  - Repository-specific overrides
  - Enforcement mode configuration (learning/enforcement)

- **Retry Logic & Rate Limiting**
  - Exponential backoff with jitter
  - Respects Retry-After headers
  - Configurable retry policy
  - Maximum 30-second cap per retry

- **Error Handling**
  - Specific error types (Auth, Permissions, RateLimit, Network)
  - Structured logging with secret redaction
  - Graceful degradation

#### Azure DevOps Integration - Phase 2 (PR Bot)
- **AzureDevOpsPRBot** - Automated PR analysis
  - Analyze PRs for pipeline violations
  - Calculate compliance scores
  - Determine pass/fail/warning status
  - Re-analysis on push

- **CommentThreadManager** - Inline comments
  - Create threads with violations
  - Markdown formatting with severity emojis
  - Comments on specific lines
  - Update existing threads
  - Resolve threads when fixed

- **PRStatusManager** - Status checks
  - Create "Pipeline Compliance" status
  - Block merge on failures
  - Learning vs enforcement modes
  - Score display in PR

- **WebhookHandler** - Event processing
  - Handle pullrequest.created events
  - Handle pullrequest.updated events
  - Filter irrelevant events
  - Auto-trigger analysis

#### Tests
- 65+ tests for Azure DevOps integration
- 100% coverage of Phase 1 scenarios
- 100% coverage of Phase 2 core functionality

### Technical Details
- 4,500+ lines of TypeScript code for Azure DevOps
- Full type safety with 50+ interfaces
- Comprehensive documentation

---

## [1.0.0] - 2024-12-19

### 🎉 Initial Release

First public release of Pipeline Assistant MCP, presented at TechFest Madrid 2024.

### Added

#### Core Features
- **Pipeline Generation** - Automatic generation based on corporate wiki standards
- **Pipeline Analysis** - Comprehensive validation against security policies
- **Policy Enforcement** - Automatic application of mandatory security rules
- **Wiki Management** - Parse and manage standards from Markdown/YAML

#### Integrations
- **VS Code Extension** with 6 specialized providers
  - DiagnosticProvider for real-time analysis
  - CodeActionProvider with 15+ quick fixes
  - CompletionProvider with 35+ smart snippets
  - HoverProvider for contextual documentation
  - WikiWebviewProvider for interactive docs
  - PipelineAssistantProvider for main commands
  
- **GitHub Integration**
  - Automatic PR analysis workflow
  - Inline comments on exact lines
  - Re-analysis with `/reanalyze` command
  - Visual compliance badges
  - Learning vs Enforcement modes

#### Analysis Capabilities
- Detection of 15+ violation types
- Hardcoded secrets identification
- Performance optimization suggestions
- Language-specific analysis (C#, Node.js, Python)
- Compliance score calculation
- Strict vs permissive modes

#### Templates
- Microservice templates for .NET, Node.js, Python
- Multi-stage pipeline support
- Docker and Kubernetes integration
- Helm charts deployment
- Health checks configuration

#### Metrics & Reporting
- Adoption metrics tracking
- Monthly compliance reports
- Top violations identification
- Trend analysis
- Multiple export formats (Markdown, HTML, JSON)

#### CLI Tools
- `pipeline-assistant` - Main CLI for generation and analysis
- `pipeline-wiki` - Wiki and standards management
- `pipeline-pr` - Pull request analysis tool

#### Developer Experience
- MCP server implementation
- Auto-update with file watching
- Policy versioning with rollback
- Comprehensive test coverage
- Full TypeScript support

### Technical Stack
- TypeScript 5.3
- Node.js 20+
- Model Context Protocol SDK
- Jest for testing
- GitHub Actions for CI/CD

### Documentation
- Comprehensive README
- BDD features in Gherkin format
- API documentation
- Contributing guidelines
- Apache 2.0 License

---

## [Unreleased]

### Planned for v1.1
- Azure DevOps integration
- GitLab bot support
- Web dashboard for metrics
- Advanced AI-powered auto-fix

### Under Consideration
- Terraform/IaC support
- Dockerfile analysis
- Backstage integration
- Multi-tenant support

---

For more details, see the [README](README.md) and [Roadmap](README.md#roadmap).
