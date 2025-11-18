# Pipeline Assistant MCP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

An intelligent CI/CD pipeline assistant powered by [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Automatically generates, validates, and improves Azure DevOps and GitHub Actions pipelines according to corporate standards and DevSecOps best practices.

## Features

- **Pipeline Generation** - Create complete pipelines from templates (.NET, Node.js, Python, Java, Go)
- **Security Analysis** - Detect hardcoded secrets, missing security stages, and vulnerabilities
- **Compliance Scoring** - Calculate 0-100 scores with detailed breakdowns
- **Multiple Integrations** - VS Code extension, GitHub Actions, Azure DevOps PR Bot
- **Wiki Management** - Maintain versioned corporate standards with adoption metrics

## Quick Start

### Prerequisites

- Node.js 20+ and npm 9+
- Git

### Installation

```bash
git clone https://github.com/soydachi/pipeline-assistant-mcp.git
cd pipeline-assistant-mcp
npm install
npm run build
npm test
```

### Basic Usage

```bash
# Generate a pipeline
node dist/cli/pipeline-assistant.js generate --type node --env production

# Analyze a pipeline
node dist/cli/pipeline-assistant.js analyze examples/pipelines/pipeline-con-problemas.yml

# View standards
node dist/cli/wiki-cli.js standards --list
```

## Documentation

| Document | Description |
|----------|-------------|
| [Usage Guide](docs/USAGE.md) | Complete setup and usage for all platforms |
| [Contributing](CONTRIBUTING.md) | How to contribute to the project |
| [Changelog](CHANGELOG.md) | Version history and release notes |

## Architecture

```
pipeline-assistant-mcp/
├── src/                    # Core MCP server
│   ├── server.ts           # MCP server entry point
│   ├── pipeline-generator.ts
│   ├── pipeline-analyzer.ts
│   ├── policy-enforcer.ts
│   ├── wiki-manager.ts
│   └── azure-devops/       # Azure DevOps integration
├── cli/                    # Command-line tools
│   ├── pipeline-assistant.ts
│   ├── wiki-cli.ts
│   └── pr-bot-cli.ts
├── vscode-extension/       # VS Code extension
├── wiki/standards/         # Corporate standards
└── tests/                  # Test suite
```

## Integrations

### MCP Server (Claude Desktop)

```json
{
  "mcpServers": {
    "pipeline-assistant": {
      "command": "node",
      "args": ["dist/src/server.js"],
      "cwd": "/path/to/pipeline-assistant-mcp"
    }
  }
}
```

### VS Code Extension

Install from `vscode-extension/` directory. Provides real-time analysis, quick fixes, and 35+ intelligent snippets.

### GitHub Actions

Add `.github/workflows/pipeline-review.yml` to automatically analyze PRs.

### Azure DevOps

Configure with environment variables:
```bash
export AZDO_ORG_URL="https://dev.azure.com/your-org"
export AZDO_PAT="your-personal-access-token"
export AZDO_PROJECT="your-project"
```

See [Usage Guide](docs/USAGE.md) for detailed configuration.

## Development

```bash
npm run dev          # Watch mode
npm test             # Run tests
npm run lint         # Check code style
npm run build        # Build project
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[Apache License 2.0](LICENSE)

## Author

**Dachi Gogotchuri** ([@soydachi](https://github.com/soydachi))

- Website: [soydachi.com](https://soydachi.com)
- LinkedIn: [Dachi Gogotchuri](https://linkedin.com/in/soydachi)
