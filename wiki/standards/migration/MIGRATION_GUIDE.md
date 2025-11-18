# Migration Guide: Pipeline Standards v1.x to v2.0

This guide helps teams migrate existing pipelines to the new v2.0 standards structure.

## Overview

Version 2.0 introduces:
- Reorganized directory structure
- 4 new security policies (SEC-007 to SEC-010)
- Mandatory 6-stage pipeline structure
- SLA definitions for vulnerability remediation
- Compliance mapping (SOC2, ISO 27001, PCI-DSS)

## Breaking Changes

### 1. Directory Structure

**Old structure:**
```
wiki/standards/
├── pipeline-standards.md      # DEPRECATED
├── security-policies.yaml     # DEPRECATED
└── platforms/
```

**New structure:**
```
wiki/standards/
├── README.md                  # New entry point
├── version.yaml
├── core/
│   ├── stages.yaml
│   ├── naming-conventions.yaml
│   └── environments.yaml
├── security/
│   ├── policies.yaml
│   ├── sla.yaml
│   └── compliance-mapping.yaml
├── quality/
│   ├── testing.yaml
│   ├── coverage.yaml
│   └── gates.yaml
├── platforms/
└── migration/
```

### 2. New Security Policies

| Policy ID | Name | Required | Action |
|-----------|------|----------|--------|
| SEC-007 | DAST | Yes (web apps) | Add OWASP ZAP to staging deployment |
| SEC-008 | License Compliance | Yes | Add license checker for your language |
| SEC-009 | API Security | No (APIs only) | Add API security scanning |
| SEC-010 | SBOM Generation | Yes | Add Syft SBOM generation to build |

### 3. Pipeline Stage Changes

**Old:** Variable number of stages

**New:** Mandatory 6 stages in order:
1. Validate
2. Security
3. Build
4. Test
5. Scan
6. Deploy

### 4. Security Job Separation

**Old:** Single security job with multiple scans

**New:** Separate jobs per security policy (parallel execution):
- `secret-scan` (SEC-001)
- `sast` (SEC-002)
- `dependency-scan` (SEC-003)
- `license-compliance` (SEC-008)

## Migration Steps

### Step 1: Update Pipeline Structure

#### Azure DevOps

Update your `azure-pipelines.yml`:

```yaml
# Before
stages:
- stage: Build
- stage: Test
- stage: Deploy

# After
stages:
- stage: Validate
  displayName: 'Validate'
- stage: Security
  displayName: 'Security'
  dependsOn: Validate
- stage: Build
  displayName: 'Build'
  dependsOn: Security
- stage: Test
  displayName: 'Test'
  dependsOn: Build
- stage: Scan
  displayName: 'Scan'
  dependsOn: Build
- stage: DeployDev
  displayName: 'Deploy to Development'
  dependsOn: Test
```

#### GitHub Actions

Update your workflow:

```yaml
# Before
jobs:
  build:
  test:
  deploy:

# After
jobs:
  validate:
    name: Validate
  secret-scan:
    name: 'SEC-001: Secret Scan'
    needs: validate
  sast:
    name: 'SEC-002: SAST'
    needs: validate
  dependency-scan:
    name: 'SEC-003: Dependency Scan'
    needs: validate
  license-compliance:
    name: 'SEC-008: License Compliance'
    needs: validate
  build:
    name: Build
    needs: [secret-scan, sast, dependency-scan, license-compliance]
  # ... continue with test, docker, deploy
```

### Step 2: Add SEC-007 (DAST)

Add DAST scanning to your staging deployment.

#### Azure DevOps

```yaml
- stage: DeployStaging
  jobs:
  - deployment: DeployToStaging
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureWebApp@1
            inputs:
              appName: '$(webAppName)-staging'
        postRouteTraffic:
          steps:
          - script: |
              docker run --rm -v $(Build.SourcesDirectory)/reports:/zap/wrk:rw \
                -t owasp/zap2docker-stable zap-baseline.py \
                -t https://$(webAppName)-staging.azurewebsites.net \
                -r zap-report.html \
                -I
            displayName: 'OWASP ZAP Baseline Scan'
```

#### GitHub Actions

```yaml
deploy-staging:
  steps:
    - name: Deploy
      # ... deploy steps

    - name: OWASP ZAP Baseline Scan
      uses: zaproxy/action-baseline@v0.12.0
      with:
        target: 'https://${{ vars.WEBAPP_NAME }}-staging.azurewebsites.net'
        cmd_options: '-I'
```

### Step 3: Add SEC-008 (License Compliance)

#### Node.js

```yaml
# Azure DevOps
- script: |
    npx license-checker --json --out licenses.json
    npx license-checker --failOn "GPL;AGPL;SSPL"
  displayName: 'License Compliance Check'

# GitHub Actions
- name: License Compliance Check
  run: |
    npx license-checker --json --out licenses.json
    npx license-checker --failOn "GPL;AGPL;SSPL"
```

#### .NET

```yaml
# Azure DevOps / GitHub Actions
- script: |
    dotnet tool install --global dotnet-project-licenses
    dotnet-project-licenses -i . --fail-on-forbidden \
      --forbidden GPL-2.0-only GPL-3.0-only AGPL-3.0-only
```

#### Python

```yaml
# Azure DevOps / GitHub Actions
- script: |
    pip install pip-licenses
    pip-licenses --fail-on "GPL;AGPL"
```

### Step 4: Add SEC-010 (SBOM Generation)

Add SBOM generation to your build stage.

#### Azure DevOps

```yaml
- script: |
    docker run --rm -v $(Build.SourcesDirectory):/src \
      anchore/syft:latest /src \
      -o spdx-json=/src/sbom.spdx.json \
      -o cyclonedx-json=/src/sbom.cyclonedx.json
  displayName: 'Generate SBOM'

- task: CopyFiles@2
  inputs:
    Contents: 'sbom.*.json'
    TargetFolder: '$(Build.ArtifactStagingDirectory)'
```

#### GitHub Actions

```yaml
- name: Generate SBOM (SPDX)
  uses: anchore/sbom-action@v0
  with:
    format: spdx-json
    output-file: sbom.spdx.json

- name: Generate SBOM (CycloneDX)
  uses: anchore/sbom-action@v0
  with:
    format: cyclonedx-json
    output-file: sbom.cyclonedx.json
```

### Step 5: Update Action/Task Versions

Ensure you're using the latest versions:

| Component | Old Version | New Version |
|-----------|-------------|-------------|
| actions/checkout | v3 | v4 |
| actions/setup-node | v3 | v4 |
| actions/setup-python | v4 | v5 |
| actions/upload-artifact | v3 | v4 |
| docker/build-push-action | v4 | v5 |
| azure/login | v1 | v2 |
| azure/webapps-deploy | v2 | v3 |
| SonarQubeAnalyze | v5 | v6 |

### Step 6: Configure Required Secrets

Ensure these secrets are configured:

| Secret | Purpose | Required |
|--------|---------|----------|
| SONAR_TOKEN | SonarCloud/SonarQube | Yes |
| SNYK_TOKEN | Snyk dependency scanning | Yes |
| CODECOV_TOKEN | Code coverage upload | Yes |
| AZURE_CREDENTIALS | Azure deployments | Yes (Azure) |

### Step 7: Update Environment Variables

Add these repository variables:

```yaml
# GitHub Repository Variables
SONAR_ORG: your-sonarcloud-org
WEBAPP_NAME: your-app-name

# Azure DevOps Variable Groups
- group: common-variables
- group: security-secrets
```

## Validation Checklist

Use this checklist to validate your migration:

### Pipeline Structure
- [ ] Pipeline follows 6-stage structure
- [ ] Stages are in correct order
- [ ] Dependencies between stages are correct

### Security Policies
- [ ] SEC-001: Secret scanning with TruffleHog
- [ ] SEC-002: SAST with SonarCloud/SonarQube
- [ ] SEC-003: Dependency scanning with Snyk
- [ ] SEC-004: Container scanning with Trivy
- [ ] SEC-005: Dockerfile linting with Hadolint
- [ ] SEC-008: License compliance checking
- [ ] SEC-010: SBOM generation (SPDX + CycloneDX)

### For Web Applications
- [ ] SEC-007: DAST with OWASP ZAP on staging

### Quality Gates
- [ ] Code coverage thresholds configured
- [ ] Test results published
- [ ] Quality gates blocking on failures

### Deployments
- [ ] Health checks after each deployment
- [ ] Environment protection rules configured
- [ ] Smoke tests in place

## Common Issues

### 1. TruffleHog False Positives

Add a `.trufflehog-ignore` file:

```
# Ignore test fixtures
tests/fixtures/
# Ignore specific patterns
*.test.js
```

### 2. License Check Failures

Review prohibited licenses in your dependencies:

```bash
# Node.js
npx license-checker --summary

# Python
pip-licenses --format=markdown

# .NET
dotnet-project-licenses -i . -o licenses.md
```

### 3. SBOM Generation Fails

Ensure Docker is available in your pipeline:

```yaml
# Azure DevOps
pool:
  vmImage: 'ubuntu-latest'

# GitHub Actions
runs-on: ubuntu-latest
```

### 4. DAST Scan Timeouts

Increase timeout or use baseline scan:

```yaml
# Use baseline scan instead of full scan
zap-baseline.py  # Faster, passive scan
# vs
zap-full-scan.py  # Slower, active scan
```

## Support

- Standards documentation: `wiki/standards/README.md`
- Security policies: `wiki/standards/security/policies.yaml`
- Templates: `wiki/standards/platforms/{azure,github}/templates/`

For questions or issues, contact the Platform Engineering team.
