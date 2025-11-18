# Pipeline Standards v2.0 - Adoption Checklist

Use this checklist when migrating existing pipelines or creating new ones.

## Pre-Migration

### Prerequisites
- [ ] Access to SonarCloud/SonarQube project
- [ ] Snyk organization token
- [ ] Codecov token (if using Codecov)
- [ ] Azure service connection (for Azure deployments)
- [ ] GitHub Container Registry access (for container deployments)

### Environment Setup
- [ ] Repository variables configured (SONAR_ORG, WEBAPP_NAME, etc.)
- [ ] Secrets configured in pipeline settings
- [ ] Branch protection rules enabled on main/develop
- [ ] Environment protection rules configured (staging, production)

## Pipeline Structure

### Stage 1: Validate
- [ ] Code checkout
- [ ] Runtime/SDK setup
- [ ] Dependency installation (with caching)
- [ ] Linting (ESLint/Flake8/dotnet format)
- [ ] Formatting check (Prettier/Black/dotnet format)
- [ ] Type checking (TypeScript/MyPy)

### Stage 2: Security
- [ ] **SEC-001**: Secret scanning (TruffleHog)
  - [ ] Full git history scan (fetch-depth: 0)
  - [ ] Fail on secrets found
- [ ] **SEC-002**: SAST (SonarCloud/SonarQube)
  - [ ] Project configured in SonarCloud
  - [ ] Coverage reports path configured
  - [ ] Quality gate configured
- [ ] **SEC-003**: Dependency scanning (Snyk)
  - [ ] Severity threshold set to high
  - [ ] fail on issues enabled
- [ ] **SEC-008**: License compliance
  - [ ] Prohibited licenses configured (GPL, AGPL, SSPL)
  - [ ] License report artifact uploaded

### Stage 3: Build
- [ ] Build command executed
- [ ] Build artifacts created
- [ ] **SEC-010**: SBOM generated
  - [ ] SPDX format
  - [ ] CycloneDX format
- [ ] Artifacts uploaded (build output + SBOM)

### Stage 4: Test
- [ ] Unit tests
  - [ ] Code coverage collection
  - [ ] JUnit/TRX report generation
  - [ ] Coverage upload to Codecov
  - [ ] Test results published
- [ ] Integration tests
  - [ ] Service containers (database, cache)
  - [ ] Environment variables configured
  - [ ] Health checks for services

### Stage 5: Scan (Container)
- [ ] **SEC-005**: Dockerfile linting (Hadolint)
  - [ ] Failure threshold: warning
- [ ] Container registry login
- [ ] Docker image build
- [ ] **SEC-004**: Container scanning (Trivy)
  - [ ] Severity: CRITICAL,HIGH
  - [ ] SARIF output for GitHub Security tab
  - [ ] Exit code 1 on vulnerabilities
- [ ] Docker image push

### Stage 6: Deploy

#### Development Environment
- [ ] Condition: develop branch only
- [ ] Artifact download
- [ ] Azure/AWS login
- [ ] Deployment execution
- [ ] Smoke test / health check

#### Staging Environment
- [ ] Condition: release/* branches
- [ ] Artifact download
- [ ] Azure/AWS login
- [ ] Deployment execution
- [ ] Health check
- [ ] **SEC-007**: DAST scan (OWASP ZAP)
  - [ ] Baseline scan configuration
  - [ ] Report artifact upload

#### Production Environment
- [ ] Condition: main branch only
- [ ] Manual approval gate (Azure DevOps)
- [ ] Environment protection rules (GitHub)
- [ ] Artifact download
- [ ] Azure/AWS login
- [ ] Deployment execution
- [ ] Health check
- [ ] Rollback plan documented

## Security Configuration

### Secrets Required
| Secret | Platform | Purpose |
|--------|----------|---------|
| SONAR_TOKEN | Both | SonarCloud authentication |
| SNYK_TOKEN | Both | Snyk authentication |
| CODECOV_TOKEN | GitHub | Codecov upload |
| AZURE_CREDENTIALS | Both | Azure deployments |
| GITHUB_TOKEN | GitHub | Auto-generated, container registry |

### Repository Variables
| Variable | Platform | Purpose |
|----------|----------|---------|
| SONAR_ORG | Both | SonarCloud organization |
| WEBAPP_NAME | Both | Application name for deployments |

### Branch Protection (GitHub)
- [ ] Require pull request before merging
- [ ] Require status checks to pass
- [ ] Require branches to be up to date
- [ ] Required status checks:
  - [ ] Validate
  - [ ] SEC-001: Secret Scan
  - [ ] SEC-002: SAST
  - [ ] SEC-003: Dependency Scan
  - [ ] Unit Tests

### Environment Protection (GitHub)
- [ ] Production environment:
  - [ ] Required reviewers configured
  - [ ] Wait timer (optional)
  - [ ] Branch restrictions (main only)
- [ ] Staging environment:
  - [ ] Branch restrictions (release/* only)

## Quality Gates

### Code Coverage Thresholds
| Environment | Line Coverage | Branch Coverage |
|-------------|---------------|-----------------|
| Development | >= 60% | >= 50% |
| Staging | >= 70% | >= 60% |
| Production | >= 80% | >= 70% |

### SonarQube Quality Gate
- [ ] No new bugs
- [ ] No new vulnerabilities
- [ ] No new code smells (A rating)
- [ ] Coverage on new code >= 80%
- [ ] Duplicated lines on new code < 3%

## Post-Migration Validation

### Pipeline Execution
- [ ] Pipeline runs successfully on all branches
- [ ] All security scans pass
- [ ] Artifacts are correctly generated
- [ ] Deployments complete successfully
- [ ] Health checks pass

### Security Verification
- [ ] SonarCloud dashboard shows project
- [ ] Snyk dashboard shows project
- [ ] SBOM artifacts are downloadable
- [ ] Container scan results in GitHub Security tab

### Compliance
- [ ] SBOM stored with release artifacts
- [ ] Security scan results archived
- [ ] Vulnerability SLAs understood:
  - Critical: 24 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

## Troubleshooting Quick Reference

### Common Failures

| Issue | Solution |
|-------|----------|
| TruffleHog fails | Add `.trufflehog-ignore` file |
| License check fails | Review and replace prohibited dependencies |
| Trivy scan fails | Update base image or fix vulnerabilities |
| DAST times out | Use baseline scan, add `-I` flag |
| SBOM fails | Ensure Docker available in runner |

### Support Contacts
- Platform Engineering team
- Security team (for vulnerability questions)
- DevOps team (for deployment issues)

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Tech Lead | | | |
| Security | | | |
| DevOps | | | |
