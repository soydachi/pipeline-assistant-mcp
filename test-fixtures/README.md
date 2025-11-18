# Test Fixtures

Test scenarios, demos, and regression tests for Pipeline Assistant MCP.

## Structure

```
test-fixtures/
├── scenarios/           # Test pipelines organized by category
│   ├── security/       # Security vulnerability scenarios
│   ├── compliance/     # Compliance and structure issues
│   ├── project-types/  # Correct configs by language
│   ├── azure-services/ # Azure service integrations
│   ├── environments/   # Dev/staging/prod configs
│   └── edge-cases/     # Error handling and edge cases
├── expected/           # Expected results for regression
├── demos/              # Interactive demonstration scripts
├── regression/         # Automated regression test runner
└── config.json         # Test configuration
```

## Running Tests

### Regression Tests

Run all regression tests to validate the analyzer and generator:

```bash
# From project root
npx ts-node test-fixtures/regression/run-regression.ts
```

This will:
- Execute all test scenarios
- Validate scores against expected ranges
- Check for expected violation types
- Generate a report at `test-fixtures/regression/report.json`

### Demos

Run interactive demos to see features in action:

```bash
# Pipeline Analyzer demo
node dist/test-fixtures/demos/analyzer-demo.js

# Policy Enforcement demo
node dist/test-fixtures/demos/policy-enforcement-demo.js
```

## Test Scenarios

### Security (5 scenarios)

| Scenario | Description | Expected Score |
|----------|-------------|----------------|
| `hardcoded-secrets.yml` | Passwords, API keys in variables | < 35% |
| `bypass-security-tools.yml` | continueOnError on security tasks | < 45% |
| `missing-security-stage.yml` | No Security stage in pipeline | < 55% |
| `exposed-secrets-in-logs.yml` | echo/print of sensitive vars | < 40% |
| `minimal-insecure.yml` | Simplified insecure pipeline | < 30% |

### Compliance (4 scenarios)

| Scenario | Description | Expected Score |
|----------|-------------|----------------|
| `no-stages-structure.yml` | Uses jobs directly (legacy) | < 60% |
| `unsafe-trigger.yml` | `trigger: true` allows any push | < 45% |
| `missing-cache.yml` | No dependency caching | 60-80% |
| `no-approval-gates.yml` | Prod deploy without approval | < 55% |

### Project Types (4 scenarios)

| Scenario | Description | Expected Score |
|----------|-------------|----------------|
| `node-typescript.yml` | Node.js with TypeScript | > 85% |
| `dotnet-webapi.yml` | .NET 8 Web API | > 85% |
| `python-django.yml` | Python Django app | > 85% |
| `java-maven.yml` | Java with Maven | > 85% |

### Azure Services (4 scenarios)

| Scenario | Description | Expected Score |
|----------|-------------|----------------|
| `dotnet-sql-redis.yml` | SQL + Redis with KeyVault | > 80% |
| `cosmosdb-functions.yml` | Azure Functions + CosmosDB | > 80% |
| `aks-deployment.yml` | Kubernetes with Helm | > 80% |
| `servicebus-storage.yml` | Service Bus + Blob Storage | > 80% |

### Environments (3 scenarios)

| Scenario | Description | Expected Score |
|----------|-------------|----------------|
| `dev-minimal.yml` | Fast dev pipeline | 55-75% |
| `staging-complete.yml` | Full staging with all tests | > 80% |
| `production-secure.yml` | Max security + approvals | > 90% |

### Edge Cases (4 scenarios)

| Scenario | Description | Expected |
|----------|-------------|----------|
| `invalid-yaml.yml` | Syntax errors | Parse error |
| `circular-dependencies.yml` | Stage dependency loop | Error |
| `empty-pipeline.yml` | No stages or jobs | Error |
| `timeout-issues.yml` | Problematic timeouts | < 65% |

## Adding New Test Cases

1. Create a new `.yml` file in the appropriate `scenarios/` subdirectory
2. Add comments explaining the issues/features being tested
3. Include `# EXPECTED` comments with expected outcomes
4. Add the test case to `regression/run-regression.ts`

Example:

```yaml
# scenarios/security/new-scenario.yml

# Description of what this tests
trigger:
  branches:
    include:
      - main

# ... pipeline content ...

# EXPECTED VIOLATIONS:
# - VIOLATION_TYPE_1
# - VIOLATION_TYPE_2
# EXPECTED SCORE: < 50%
```

Then add to `run-regression.ts`:

```typescript
{
  name: 'New scenario',
  file: 'scenarios/security/new-scenario.yml',
  expectedMaxScore: 50,
  expectedViolations: ['VIOLATION_TYPE_1', 'VIOLATION_TYPE_2']
}
```

## CI Integration

Add to your CI pipeline:

```yaml
- stage: Test
  jobs:
  - job: RegressionTests
    steps:
    - script: npx ts-node test-fixtures/regression/run-regression.ts
      displayName: 'Run regression tests'
```

## Expected Results

Expected results are stored in `expected/` with the same structure as `scenarios/`. These JSON files contain the expected analysis output for each scenario, allowing for precise regression testing.
