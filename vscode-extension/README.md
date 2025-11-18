# Pipeline Assistant - VS Code Extension

Real-time pipeline analysis, quick fixes, and intelligent snippets for Azure DevOps and GitHub Actions.

## Features

- **Real-time Analysis** - Issues appear as you type
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
| Critical | Missing mandatory stages, hardcoded secrets |
| High | No security scanning, unsafe triggers |
| Medium | Performance optimizations |
| Low | Code style suggestions |

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
