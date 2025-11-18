# Pipeline Assistant MCP - Workshop Guide

> **Interactive Workshop**: Intelligent CI/CD Pipeline Generation with AI
>
> **Duration**: 60-90 minutes
> **Level**: Beginner to Intermediate
> **Author**: Dachi Gogotchuri (@soydachi)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Environment Setup](#2-environment-setup)
3. [Part 1: Pipeline Generation](#3-part-1-pipeline-generation)
4. [Part 2: Pipeline Analysis](#4-part-2-pipeline-analysis)
5. [Part 3: Wiki Management](#5-part-3-wiki-management)
6. [Part 4: VS Code Extension](#6-part-4-vs-code-extension)
7. [Part 5: MCP Server Integration](#7-part-5-mcp-server-integration)
8. [Part 6: Azure DevOps Integration](#8-part-6-azure-devops-integration)
9. [Part 7: GitHub Integration](#9-part-7-github-integration)
10. [Next Steps](#10-next-steps)

---

## 1. Introduction

### What is Pipeline Assistant MCP?

**Pipeline Assistant MCP** is an intelligent system that automates the complete CI/CD pipeline lifecycle using AI. It's not just a validation tool - it's a complete DevSecOps assistant.

### The Problem It Solves

**Before Pipeline Assistant:**
```
Developer: "I need to create a pipeline for my .NET microservice"

2-4 hours later...
- Forgot security scanning
- Hardcoded database credentials
- Didn't configure NuGet cache
- Tests don't generate coverage
- Deploy goes directly to production without approval

Result: Insecure, slow, incomplete pipeline
```

**With Pipeline Assistant:**
```
Developer: "node dist/cli/pipeline-assistant.js generate --platform azure-devops --type dotnet"

5 seconds later...
- Complete pipeline generated
- All security policies applied
- Optimized caching
- Tests with coverage
- Deploy with approval gates
- Compliance Score: 98%

Result: Production-ready pipeline from minute one
```

### Architecture Overview

```
Developer Interfaces         Core Services              Data Sources
-------------------         -------------              ------------
    CLI Tools         -->   MCP Server            --> Corporate Wiki
    VS Code Ext       -->   Pipeline Generator    --> Security Policies
    Claude Desktop    -->   Pipeline Analyzer     --> Templates
    GitHub Actions    -->   Policy Enforcer
    Azure DevOps      -->   Wiki Manager
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **MCP Server** | AI integration via Model Context Protocol | `src/server.ts` |
| **Pipeline Generator** | Creates pipelines from templates | `src/pipeline-generator.ts` |
| **Pipeline Analyzer** | Security and compliance analysis | `src/pipeline-analyzer.ts` |
| **Policy Enforcer** | Applies corporate policies | `src/policy-enforcer.ts` |
| **Wiki Manager** | Standards and metrics management | `src/wiki-manager.ts` |
| **Platform Adapters** | Multi-platform support (Azure/GitHub) | `src/platforms/` |
| **Template Validator** | Validate templates for issues | `src/validators/` |
| **Azure DevOps Client** | PR Bot and webhook integration | `src/azure-devops/` |

---

## 2. Environment Setup

### Prerequisites

Before starting, verify you have:

```bash
# Check Node.js (>= 20.0.0)
node --version
# Expected: v20.x.x or higher

# Check npm (>= 9.0.0)
npm --version
# Expected: 9.x.x or higher

# Check Git
git --version
# Expected: 2.x.x or higher
```

### Step 1: Clone the Repository

```bash
# Clone the project
git clone https://github.com/soydachi/pipeline-assistant-mcp.git

# Enter the directory
cd pipeline-assistant-mcp

# View the structure
ls -la
```

**What you'll see:**
```
src/                  # Source code
cli/                  # CLI tools
vscode-extension/     # VS Code extension
wiki/                 # Corporate standards
tests/                # Test suite
examples/             # Example pipelines
package.json          # Dependencies
tsconfig.json         # TypeScript config
```

### Step 2: Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 234 packages in 15s
```

### Step 3: Build the Project

```bash
npm run build
```

**What this does:**
1. Clears previous `dist/` directory
2. Runs TypeScript compiler (`tsc`)
3. Generates JavaScript in `dist/`

**Expected output:**
```
> @soydachi/pipeline-assistant-mcp@1.0.0 prebuild
> npm run clean

> @soydachi/pipeline-assistant-mcp@1.0.0 build
> tsc
```

### Step 4: Run Tests

```bash
npm test
```

**Expected output:**
```
Test Files  22 passed (22)
     Tests  341 passed (341)
  Duration  <2s
```

If all tests pass, your environment is ready!

### Step 5: Verify CLI Tools

```bash
# Test main CLI
node dist/cli/pipeline-assistant.js --help

# Test wiki CLI
node dist/cli/wiki-cli.js --help

# Test PR bot CLI
node dist/cli/pr-bot-cli.js --help
```

---

## 3. Part 1: Pipeline Generation

### Objective
Learn to automatically generate complete pipelines according to corporate standards.

### Exercise 1.1: Generate Basic .NET Pipeline

```bash
node dist/cli/pipeline-assistant.js generate \
  --platform azure-devops \
  --type dotnet \
  --output my-first-pipeline.yml
```

**What just happened?**

1. **Pipeline Generator** used the Azure DevOps platform adapter from `src/platforms/`
2. Read the .NET template from `wiki/standards/platforms/azure/templates/`
3. Applied all **mandatory** policies from `wiki/standards/pipeline-standards.md`
4. Generated a complete pipeline with:
   - Validate stage (linting)
   - Security stage (TruffleHog, SonarQube, Snyk)
   - Build stage
   - Test stage (with coverage)
   - Deploy stage (conditional)

**View the result:**
```bash
cat my-first-pipeline.yml
```

### Exercise 1.2: Generate Pipeline with Azure Services

Generate a more complex pipeline including Redis and Azure SQL:

```bash
node dist/cli/pipeline-assistant.js generate \
  --platform azure-devops \
  --type dotnet \
  --services redis,azuresql \
  --env production \
  --output pipeline-with-services.yml
```

**What's included now?**

Additional configuration for:
- Azure SQL connection strings
- Redis cache configuration
- Key Vault integration for secrets
- Environment-specific settings

**View the differences:**
```bash
diff my-first-pipeline.yml pipeline-with-services.yml
```

### Exercise 1.3: Generate Node.js Pipeline for GitHub Actions

```bash
node dist/cli/pipeline-assistant.js generate \
  --platform github-actions \
  --type node \
  --services cosmosdb,servicebus \
  --output pipeline-nodejs.yml
```

**Differences from Azure DevOps .NET:**
- Uses `actions/setup-node@v4` instead of `NodeTool@0` or `UseDotNet@2`
- Uses `uses:` syntax instead of `task:` syntax
- Includes `npm ci` with cache via `actions/cache@v4`
- Runs `npm audit` for dependency scanning
- Tests with `npm test`

### Exercise 1.4: View All Options

```bash
node dist/cli/pipeline-assistant.js generate --help
```

**Available options:**
```
--platform <platform>  Target platform (azure-devops|github-actions) [required]
--type <type>          Project type (dotnet|node|python|java|go)
--services <services>  Azure services (redis,azuresql,keyvault,cosmosdb,servicebus,storage)
--env <environment>    Target environment (dev|staging|production)
--output <file>        Output file path
--strict               Apply strict validation rules
```

### Checkpoint 1

**What we learned:**
- How to generate complete pipelines automatically
- Multi-platform support (Azure DevOps and GitHub Actions)
- Differences between technologies and platforms
- How to include Azure services
- Security policies applied automatically

**Try it yourself:**
```bash
node dist/cli/pipeline-assistant.js generate \
  --platform azure-devops \
  --type python \
  --services storage,servicebus \
  --output my-python-pipeline.yml
```

---

## 4. Part 2: Pipeline Analysis

### Objective
Learn to detect security, compliance, and performance issues in existing pipelines.

### Exercise 2.1: Analyze Problematic Pipeline

Use the example pipeline that has multiple issues:

```bash
# First, view the problematic pipeline
cat examples/pipelines/pipeline-con-problemas.yml
```

**Now analyze it:**
```bash
node dist/cli/pipeline-assistant.js analyze \
  examples/pipelines/pipeline-con-problemas.yml
```

**Expected output:**
```
Pipeline Analysis Report
========================

Compliance Score: 25/100

Critical Issues (5):
- [SEC-001] Hardcoded secrets detected in variables
- [SEC-002] No security scanning stage
- [SEC-003] Missing secret scanning (TruffleHog)
- [POL-001] Missing mandatory security stage
- [POL-002] No approval gates for production

Medium Issues (3):
- [PERF-001] No cache configuration
- [QUAL-001] Tests don't generate coverage report
- [QUAL-002] No code quality checks

Low Issues (2):
- [DOC-001] Missing stage descriptions
- [CONF-001] Trigger not properly configured
```

### Exercise 2.2: Analyze Corrected Pipeline

```bash
node dist/cli/pipeline-assistant.js analyze \
  examples/pipelines/pipeline-arreglado.yml
```

**Expected output:**
```
Pipeline Analysis Report
========================

Compliance Score: 95/100

No critical issues found!

Recommendations (2):
- Consider adding deployment slots for zero-downtime deployments
- Add integration test stage for end-to-end validation
```

### Exercise 2.3: Get Improvement Suggestions

```bash
node dist/cli/pipeline-assistant.js suggest \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --focus security
```

**Expected output:**
Specific suggestions for each security issue with code examples.

### Exercise 2.4: Compare Before/After

```bash
# Side by side comparison
diff examples/pipelines/pipeline-con-problemas.yml \
     examples/pipelines/pipeline-arreglado.yml
```

### Checkpoint 2

**What we learned:**
- How to analyze existing pipelines
- Understanding compliance scores
- Interpreting issue severities
- Getting specific improvement suggestions

---

## 5. Part 3: Wiki Management

### Objective
Learn to manage corporate standards and view adoption metrics.

### Exercise 3.1: View Available Standards

```bash
node dist/cli/wiki-cli.js standards --list
```

**Expected output:**
```
Corporate Pipeline Standards
============================

Mandatory (8):
- security-scanning: Must include security scanning stage
- secret-management: Use Key Vault for all secrets
- branch-protection: Restrict production deploys to main
- approval-gates: Require approval for production
- test-coverage: Minimum 80% code coverage
- artifact-signing: Sign all build artifacts
- vulnerability-scan: Scan for known vulnerabilities
- audit-logging: Enable pipeline audit logs

Recommended (5):
- cache-optimization: Enable dependency caching
- parallel-jobs: Use parallel job execution
- reusable-templates: Use YAML templates
- blue-green-deploy: Implement blue-green deployments
- smoke-tests: Add post-deployment smoke tests

Forbidden (3):
- hardcoded-secrets: Never hardcode secrets
- skip-tests: Never skip test stages
- force-deploy: Never force deploy without checks
```

### Exercise 3.2: View Pipeline Templates

```bash
node dist/cli/wiki-cli.js templates --list
```

**Expected output:**
```
Available Templates
===================

- microservicio-dotnet.yml: .NET microservice template
- microservicio-node.yml: Node.js microservice template
- microservicio-python.yml: Python microservice template
```

### Exercise 3.3: View Adoption Metrics

```bash
node dist/cli/wiki-cli.js metrics --current
```

**Expected output:**
```
Standards Adoption Metrics
==========================

Overall Compliance: 78%

By Category:
- Security: 85%
- Quality: 72%
- Performance: 68%
- Documentation: 82%

Top Violations:
1. cache-optimization (32% non-compliant)
2. test-coverage (28% non-compliant)
3. parallel-jobs (25% non-compliant)
```

### Exercise 3.4: Generate Report

```bash
node dist/cli/wiki-cli.js metrics \
  --report markdown \
  --export metrics-report.md
```

This creates a markdown report you can share with your team.

### Checkpoint 3

**What we learned:**
- Viewing corporate standards (mandatory/recommended/forbidden)
- Available templates for different technologies
- Tracking adoption metrics
- Generating compliance reports

---

## 6. Part 4: VS Code Extension

### Objective
Experience real-time analysis and quick fixes directly in VS Code.

### Step 1: Install the Extension

```bash
# Navigate to extension directory
cd vscode-extension

# Install dependencies
npm install

# Compile
npm run compile

# Return to root
cd ..
```

### Step 2: Launch in Development Mode

1. Open VS Code in the project root
2. Press `F5` to launch a new window with the extension loaded
3. In the new window, open a `.yml` file

### Step 3: Experience Real-Time Analysis

1. Open `examples/pipelines/pipeline-con-problemas.yml`
2. You'll see red underlines on problematic lines
3. Hover over them to see the issue description
4. Click the lightbulb for quick fix suggestions

### Step 4: Use Snippets

1. Create a new file: `my-test-pipeline.yml`
2. Type `stage-` and see the autocomplete suggestions
3. Try these snippets:
   - `stage-security` - Complete security stage
   - `stage-build-dotnet` - .NET build stage
   - `stage-test-coverage` - Test with coverage

### Step 5: Use Commands

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and try:
- `Pipeline Assistant: Generate` - Generate new pipeline
- `Pipeline Assistant: Analyze` - Analyze current file
- `Pipeline Assistant: Show Wiki` - View standards in sidebar

### Checkpoint 4

**What we learned:**
- Installing and running the VS Code extension
- Real-time problem detection
- Using quick fixes
- Available snippets and commands

---

## 7. Part 5: MCP Server Integration

### Objective
Use Pipeline Assistant with Claude Desktop via Model Context Protocol.

### Step 1: Locate Claude Config

**macOS:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
type %APPDATA%\Claude\claude_desktop_config.json
```

### Step 2: Configure MCP Server

Add the following to your Claude Desktop config:

```json
{
  "mcpServers": {
    "pipeline-assistant": {
      "command": "node",
      "args": ["dist/src/server.js"],
      "cwd": "/absolute/path/to/pipeline-assistant-mcp"
    }
  }
}
```

**Important:** Replace `/absolute/path/to/pipeline-assistant-mcp` with your actual path.

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop for changes to take effect.

### Step 4: Test the Integration

Open Claude Desktop and try these prompts:

**Generate a pipeline:**
```
Generate a Node.js pipeline for production with Redis and Azure SQL.
Include security scanning and deployment approval gates.
```

**Analyze a pipeline:**
```
Analyze this pipeline for security issues:

trigger:
  branches:
    include: ['*']

variables:
  DB_PASSWORD: 'supersecret123'

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: npm install
          - script: npm test
```

**Get suggestions:**
```
Suggest performance improvements for a pipeline that takes 15 minutes to run.
```

### Checkpoint 5

**What we learned:**
- Configuring MCP Server for Claude Desktop
- Using natural language to generate pipelines
- Analyzing pipelines through conversation
- Getting AI-powered suggestions

---

## 8. Part 6: Azure DevOps Integration

### Objective
Set up automated PR analysis in Azure DevOps.

### Prerequisites

You'll need:
- Azure DevOps organization
- Personal Access Token (PAT)
- A project with a repository

### Step 1: Create Personal Access Token

1. Go to Azure DevOps: https://dev.azure.com/your-org
2. Click your profile icon > Security
3. Click "New Token"
4. Configure:
   - Name: `pipeline-assistant`
   - Scopes:
     - Code: Read & Write
     - Work Items: Read & Write
     - Build: Read
     - Pull Request Threads: Read & Write
5. Copy the token (you won't see it again!)

### Step 2: Configure Environment

```bash
export AZDO_ORG_URL="https://dev.azure.com/your-organization"
export AZDO_PAT="your-personal-access-token"
export AZDO_PROJECT="YourProject"
export AZDO_REPOSITORY="your-repo"  # Optional
```

### Step 3: Test Connection

```bash
# Test the PAT works
curl -u ":$AZDO_PAT" \
  "$AZDO_ORG_URL/_apis/projects?api-version=7.0"
```

You should see a JSON response with your projects.

### Step 4: Analyze a PR

If you have a PR with pipeline changes:

```bash
# Learning mode (comments only)
node dist/cli/pr-bot-cli.js analyze \
  --owner your-org \
  --repo your-repo \
  --pr 123 \
  --mode learning \
  --dry-run

# Remove --dry-run to actually post comments
```

### Step 5: Simulate PR Analysis

Don't have a real PR? Use simulation:

```bash
# Simulate a bad pipeline PR
node dist/cli/pr-bot-cli.js simulate --scenario bad

# Simulate a good pipeline PR
node dist/cli/pr-bot-cli.js simulate --scenario good

# Simulate mixed (some good, some bad)
node dist/cli/pr-bot-cli.js simulate --scenario mixed
```

### Step 6: Webhook Configuration (Advanced)

For automatic analysis on PR creation:

1. Go to Project Settings > Service Hooks
2. Create new subscription
3. Select "Web Hooks"
4. Trigger: Pull request created/updated
5. Configure your server URL and secret

### Checkpoint 6

**What we learned:**
- Creating Azure DevOps PAT
- Configuring environment variables
- Analyzing PRs from command line
- Different enforcement modes (learning vs enforcement)

---

## 9. Part 7: GitHub Integration

### Objective
Set up automatic pipeline analysis in GitHub PRs.

### Step 1: Create GitHub Workflow

Create `.github/workflows/pipeline-review.yml`:

```yaml
name: Pipeline Review

on:
  pull_request:
    paths:
      - '**.yml'
      - '**.yaml'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Clone Pipeline Assistant
        run: |
          git clone https://github.com/soydachi/pipeline-assistant-mcp.git /tmp/pa
          cd /tmp/pa && npm install && npm run build

      - name: Analyze Pipelines
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          for file in $(find . -name "*.yml" -o -name "*.yaml"); do
            echo "Analyzing: $file"
            node /tmp/pa/dist/cli/pipeline-assistant.js analyze "$file"
          done
```

### Step 2: Test the Workflow

1. Create a branch with a pipeline file
2. Make a PR
3. Watch the workflow run
4. See results in the PR checks

### Checkpoint 7

**What we learned:**
- Setting up GitHub Actions
- Automatic analysis on PRs
- Integration with GitHub token

---

## 10. Next Steps

### What You've Learned

- Generating production-ready pipelines in seconds
- Analyzing pipelines for security and compliance issues
- Managing corporate standards and metrics
- Using VS Code extension for real-time analysis
- Integrating with Claude Desktop via MCP
- Setting up Azure DevOps and GitHub automation

### Explore Further

1. **Customize Standards**
   - Edit `wiki/standards/pipeline-standards.md`
   - Add your organization's specific requirements
   - Create custom templates

2. **Run Tests**
   ```bash
   npm test
   npx vitest run --coverage
   ```

3. **Contribute**
   - Check [CONTRIBUTING.md](CONTRIBUTING.md)
   - Look for issues labeled "good first issue"
   - Add new pipeline templates

4. **Advanced Features**
   - Rate limiting configuration
   - Webhook signature validation
   - Custom rule engine

### Resources

- [Usage Guide](docs/USAGE.md) - Complete reference
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history
- [GitHub Issues](https://github.com/soydachi/pipeline-assistant-mcp/issues) - Report issues

### Contact

**Dachi Gogotchuri** ([@soydachi](https://github.com/soydachi))
- Website: [soydachi.com](https://soydachi.com)
- LinkedIn: [Dachi Gogotchuri](https://linkedin.com/in/soydachi)

---

Congratulations! You've completed the Pipeline Assistant MCP workshop.
