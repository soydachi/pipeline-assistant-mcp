# Demo Project - Pipeline Assistant Testing

This is a sample .NET 8 Web API project designed to test Pipeline Assistant MCP capabilities.

## Project Structure

```
demo-project/
├── src/
│   ├── DemoApi.csproj          # Main API project
│   └── Program.cs              # API implementation
├── tests/
│   ├── DemoApi.Tests.csproj    # Test project
│   └── ApiTests.cs             # Unit tests
├── .azuredevops/
│   ├── pipeline-bad.yml        # Pipeline with security issues
│   └── pipeline-good.yml       # Compliant pipeline
├── DemoApi.sln                 # Solution file
└── README.md                   # This file
```

## Quick Start

### 1. Build and Run Locally

```bash
# Restore dependencies
dotnet restore

# Build the project
dotnet build

# Run the API
dotnet run --project src/DemoApi.csproj

# Run tests
dotnet test
```

### 2. Access the API

- Swagger UI: https://localhost:5001/swagger
- Health Check: https://localhost:5001/health
- Get Items: https://localhost:5001/api/items

## Testing Pipeline Assistant

### Analyze the Bad Pipeline

```bash
# From the pipeline-assistant-mcp root directory
node dist/cli/pipeline-assistant.js analyze -f demo-project/.azuredevops/pipeline-bad.yml
```

**Expected Issues:**
- SEC-001: Hardcoded secrets detected
- SEC-002: No SAST analysis
- SEC-003: No dependency scanning
- SEC-010: No SBOM generation
- POL-001: Missing security stage
- POL-002: No approval gates
- QUAL-001: No code coverage
- PERF-001: No caching

### Analyze the Good Pipeline

```bash
node dist/cli/pipeline-assistant.js analyze -f demo-project/.azuredevops/pipeline-good.yml
```

**Expected Result:**
- Compliance Score: 95-100%
- No critical issues

### Generate a New Pipeline

```bash
node dist/cli/pipeline-assistant.js generate \
  --platform azure-devops \
  --type dotnet \
  --env production \
  --output demo-project/.azuredevops/pipeline-generated.yml
```

## Using with Azure DevOps

### Option 1: Import to Azure Repos

1. Create a new repository in Azure DevOps
2. Push this demo project:
   ```bash
   cd demo-project
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://dev.azure.com/your-org/your-project/_git/demo-api
   git push -u origin main
   ```

### Option 2: Import to GitHub

1. Create a new GitHub repository
2. Push this demo project:
   ```bash
   cd demo-project
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/demo-api.git
   git push -u origin main
   ```

## Testing PR Analysis

1. Create a branch with the bad pipeline
2. Open a PR to main
3. Pipeline Assistant will analyze and comment

### Simulate PR Analysis

```bash
# From pipeline-assistant-mcp root
node dist/cli/pr-bot-cli.js simulate --scenario bad
```

## Pipeline Comparison

| Feature | pipeline-bad.yml | pipeline-good.yml |
|---------|-----------------|-------------------|
| Secret Scanning | No | Yes (TruffleHog) |
| SAST Analysis | No | Yes |
| Dependency Scan | No | Yes |
| SBOM Generation | No | Yes |
| Code Coverage | No | Yes |
| Caching | No | Yes (NuGet) |
| Approval Gates | No | Yes (environments) |
| Stages | 3 | 6 |

## Environment Configuration

For the PR bot to post comments, configure:

```bash
export AZDO_ORG_URL="https://dev.azure.com/your-org"
export AZDO_PAT="your-pat"
export AZDO_PROJECT="your-project"
```

Or use Variable Groups in Azure DevOps (see main project documentation).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/items | List all items |
| GET | /api/items/{id} | Get item by ID |
| POST | /api/items | Create new item |

## License

MIT - See main project for details.
