# Pipeline Assistant - VS Code Extension

Real-time pipeline analysis, quick fixes, and intelligent snippets for Azure DevOps and GitHub Actions.

## Features

- **Multi-Platform Support** - Azure DevOps and GitHub Actions
- **Real-time Analysis** - Issues appear as you type
- **Template Validation** - Detects invalid tasks, cross-platform syntax errors, and security issues
- **Quick Fixes** - One-click fixes for common problems
- **35+ Snippets** - Smart autocompletion for pipeline tasks
- **Wiki Viewer** - Browse standards in sidebar

## Installation

### Development Mode

```bash
cd vscode-extension
npm install
npm run compile
```

Press F5 to launch extension in development mode.

### Package and Install

```bash
npm run package
code --install-extension pipeline-assistant-*.vsix
```

## Commands

| Command | Description |
|---------|-------------|
| Pipeline Assistant: Generate | Create new pipeline |
| Pipeline Assistant: Analyze | Analyze current file |
| Pipeline Assistant: Show Wiki | Open standards viewer |

## Quick Fixes

Click the lightbulb or press `Ctrl+.` on errors:

- Add mandatory stages
- Replace hardcoded secrets with Key Vault
- Fix unsafe triggers
- Remove `continueOnError` from security tasks

## Snippets

Type `stage-` to see available snippets:

- `stage-validate` - Validation stage
- `stage-security` - Security scanning
- `stage-build-dotnet` - .NET build
- `stage-build-node` - Node.js build
- `stage-test` - Test execution
- `stage-deploy` - Deployment

## Settings

```json
{
  "pipelineAssistant.mcpServerPath": "/path/to/dist/src/server.js",
  "pipelineAssistant.wikiPath": "./wiki/standards",
  "pipelineAssistant.enableAutoAnalysis": true,
  "pipelineAssistant.strictMode": false
}
```

## Diagnostics

| Severity | Examples |
|----------|----------|
| Critical | Missing mandatory stages, hardcoded secrets, invalid tasks |
| High | No security scanning, unsafe triggers, cross-platform syntax errors |
| Medium | Outdated actions/tasks, performance optimizations |
| Low | Code style suggestions |

## Validation Features

The extension validates templates for:

**Azure DevOps:**
- Invalid tasks (TruffleHog@, Trivy@, Snyk@1 instead of SnykSecurityScan@1)
- Outdated tasks (SonarQube@5 instead of @6)
- GitHub Actions syntax in Azure templates (`${{ }}` instead of `$()`)

**GitHub Actions:**
- Outdated actions (checkout@v3 instead of @v4)
- Azure DevOps syntax in GitHub templates (`$()` instead of `${{ }}`)
- Invalid task syntax (`task:` instead of `uses:`)

**Security:**
- Hardcoded passwords, API keys, secrets, tokens
- Missing security stages/jobs

## Troubleshooting

**Server won't connect**
- Verify path in settings is absolute
- Check Node.js is in PATH
- Review Output panel

**No diagnostics shown**
- Confirm file is `.yml` or `.yaml`
- Enable auto-analysis in settings
- Run manual analysis

## License

Apache 2.0
