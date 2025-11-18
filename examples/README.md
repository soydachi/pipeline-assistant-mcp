# Examples

Example pipelines and configurations for Pipeline Assistant MCP.

## Contents

```
examples/
├── pipelines/
│   ├── pipeline-con-problemas.yml  # Pipeline with intentional issues
│   └── pipeline-arreglado.yml      # Corrected version
└── config.json                     # Custom configuration example
```

## Usage

### Analyze Problem Pipeline

```bash
node dist/cli/pipeline-assistant.js analyze \
  examples/pipelines/pipeline-con-problemas.yml
```

Expected output: Score ~25%, multiple critical issues detected.

### Analyze Fixed Pipeline

```bash
node dist/cli/pipeline-assistant.js analyze \
  examples/pipelines/pipeline-arreglado.yml
```

Expected output: Score ~95%, no critical issues.

### Generate New Pipeline

```bash
# Node.js
node dist/cli/pipeline-assistant.js generate \
  --type node --env production

# .NET with services
node dist/cli/pipeline-assistant.js generate \
  --type dotnet \
  --services redis,azuresql,keyvault \
  --env production
```

### Simulate PR Bot

```bash
node dist/cli/pr-bot-cli.js simulate --scenario bad
node dist/cli/pr-bot-cli.js simulate --scenario good
```

## Custom Configuration

Use `config.json` for custom rules:

```json
{
  "enforcement": {
    "mode": "strict",
    "blockOnCritical": true,
    "requireMinScore": 80
  },
  "customRules": [
    {
      "id": "CUSTOM-001",
      "pattern": "todo|fixme",
      "severity": "MEDIUM",
      "message": "Resolve TODO comments"
    }
  ]
}
```

## Notes

- Build project first: `npm run build`
- GitHub tokens need `repo` and `pull_request` permissions
- Azure DevOps PATs need `Code`, `Work Items`, and `Build` permissions
