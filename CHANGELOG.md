# Changelog

All notable changes to Pipeline Assistant MCP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

---

## [Unreleased]

### Planned
- GitLab integration
- Web dashboard
- Terraform/IaC support
- Advanced auto-fix
