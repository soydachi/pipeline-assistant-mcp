# Breaking Changes - Pipeline Standards v2.0

This document lists all breaking changes between v1.x and v2.0.

## Summary

| Category | Impact | Migration Effort |
|----------|--------|------------------|
| Directory restructure | High | Update all file references |
| New mandatory stages | High | Refactor pipeline structure |
| New security policies | Medium | Add new scanning jobs |
| Action/Task versions | Low | Update version numbers |

## Detailed Breaking Changes

### 1. Deprecated Files

**Status:** Deprecated with migration notices

| Old File | New Location |
|----------|--------------|
| `wiki/standards/pipeline-standards.md` | `wiki/standards/README.md` + `core/stages.yaml` |
| `wiki/standards/security-policies.yaml` | `wiki/standards/security/policies.yaml` |

**Action Required:**
- Update all references to use new file paths
- Old files contain deprecation notices pointing to new locations

---

### 2. Mandatory 6-Stage Pipeline Structure

**Old:** Flexible stage structure

**New:** Mandatory stages in fixed order

```yaml
# Required stage order
1. Validate    # Linting, formatting, type checking
2. Security    # All security scans (parallel jobs)
3. Build       # Application build + SBOM
4. Test        # Unit + Integration tests
5. Scan        # Container build + security scan
6. Deploy      # Environment deployments
```

**Action Required:**
- Restructure existing pipelines to follow 6-stage model
- Move security scans to Stage 2
- Move container scanning to Stage 5
- Ensure dependencies between stages are correct

---

### 3. Security Job Separation

**Old:** Single security job

```yaml
security:
  steps:
    - TruffleHog
    - SonarCloud
    - Snyk
```

**New:** Parallel jobs per security policy

```yaml
secret-scan:     # SEC-001
  needs: validate
sast:            # SEC-002
  needs: validate
dependency-scan: # SEC-003
  needs: validate
license-compliance: # SEC-008
  needs: validate
build:
  needs: [secret-scan, sast, dependency-scan, license-compliance]
```

**Benefits:**
- Faster execution (parallel jobs)
- Clearer failure identification
- Better GitHub status checks

**Action Required:**
- Split security job into separate jobs
- Update job dependencies
- Update branch protection status checks

---

### 4. New Mandatory Security Policies

| Policy | Name | Requirement |
|--------|------|-------------|
| SEC-007 | DAST | Required for web applications |
| SEC-008 | License Compliance | Required for all projects |
| SEC-009 | API Security | Optional for API projects |
| SEC-010 | SBOM Generation | Required for all projects |

**Action Required:**
- Add license compliance scanning (SEC-008)
- Add SBOM generation to build stage (SEC-010)
- Add DAST scanning to staging deployment (SEC-007) - web apps only
- Consider API security scanning (SEC-009) - APIs only

---

### 5. Updated Action/Task Versions

#### GitHub Actions

| Action | Old | New | Notes |
|--------|-----|-----|-------|
| actions/checkout | v3 | v4 | Node 20 runtime |
| actions/setup-node | v3 | v4 | Caching improvements |
| actions/setup-python | v4 | v5 | New features |
| actions/setup-dotnet | v3 | v4 | .NET 8 support |
| actions/upload-artifact | v3 | v4 | New artifact system |
| actions/download-artifact | v3 | v4 | New artifact system |
| docker/build-push-action | v4 | v5 | Performance improvements |
| docker/login-action | v2 | v3 | Security updates |
| azure/login | v1 | v2 | OIDC support |
| azure/webapps-deploy | v2 | v3 | New features |

#### Azure DevOps

| Task | Old | New | Notes |
|------|-----|-----|-------|
| SonarQubePrepare | v5 | v6 | New scanner version |
| SonarQubeAnalyze | v5 | v6 | Performance improvements |
| SonarQubePublish | v5 | v6 | New report format |

**Action Required:**
- Update all action/task version references
- Test pipeline after updates

---

### 6. Environment Configuration Changes

#### GitHub Actions

**Old:** Inline environment names

```yaml
environment: production
```

**New:** Environment with URL

```yaml
environment: production
```

Plus repository settings:
- Environment protection rules
- Required reviewers
- Wait timers
- Deployment branch restrictions

#### Azure DevOps

**Old:** Simple deployment jobs

```yaml
- deployment: Deploy
  environment: production
```

**New:** Full deployment strategy

```yaml
- deployment: DeployToProd
  environment: 'production'
  strategy:
    runOnce:
      preDeploy:
        steps:
          - task: ManualValidation@0
      deploy:
        steps:
          - # deployment steps
      postRouteTraffic:
        steps:
          - # health checks
      on:
        failure:
          steps:
            - # rollback
```

**Action Required:**
- Configure environment protection rules
- Add manual approval for production
- Implement health checks
- Document rollback procedures

---

### 7. SBOM Artifact Requirements

**New in v2.0:** SBOM is mandatory for all builds

**Required formats:**
- SPDX JSON (`sbom.spdx.json`)
- CycloneDX JSON (`sbom.cyclonedx.json`)

**Retention:** 3 years (compliance requirement)

**Action Required:**
- Add SBOM generation step to build stage
- Include SBOM files in build artifacts
- Configure artifact retention policies

---

### 8. Vulnerability SLA Enforcement

**New in v2.0:** Mandatory remediation timeframes

| Severity | SLA | Escalation |
|----------|-----|------------|
| Critical | 24 hours | Immediate to Security team |
| High | 7 days | Day 5 to Tech Lead |
| Medium | 30 days | Day 21 to Team Lead |
| Low | 90 days | Day 60 to Team Lead |

**Action Required:**
- Review current vulnerability backlog
- Prioritize critical/high vulnerabilities
- Establish monitoring process
- Configure alerting for new vulnerabilities

---

### 9. Branch Naming Convention Enforcement

**Required patterns:**

```
main           # Production releases
develop        # Development integration
feature/*      # New features
bugfix/*       # Bug fixes
hotfix/*       # Production hotfixes
release/*      # Release preparation
```

**Pipeline triggers:**

| Branch Pattern | Triggers |
|----------------|----------|
| main | Build, Test, Deploy to Production |
| develop | Build, Test, Deploy to Development |
| release/* | Build, Test, Deploy to Staging |
| feature/* | Build, Test only |
| PR to main/develop | Build, Test, Security scans |

**Action Required:**
- Review and rename non-compliant branches
- Update pipeline triggers to match patterns
- Configure branch protection rules

---

### 10. Container Registry Changes

**GitHub Actions:**
- Default registry: `ghcr.io`
- Image name: `${{ github.repository }}`
- Tags: SHA-based + `latest` for main

**Azure DevOps:**
- Registry must be defined in variables
- Service connection required

**Action Required:**
- Configure container registry access
- Update image naming conventions
- Configure registry authentication

---

## Migration Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Assessment | 1-2 days | Review current pipeline, identify gaps |
| Planning | 1 day | Plan migration steps, identify dependencies |
| Implementation | 2-3 days | Update pipeline, add new policies |
| Testing | 1-2 days | Test on feature branch, validate all stages |
| Rollout | 1 day | Merge to develop, monitor execution |

**Total estimated effort:** 5-9 days per pipeline

## Compatibility Notes

### Backward Compatibility

- Old file locations contain deprecation notices
- v1.x pipelines will continue to work but should be migrated
- Security tools remain compatible

### Forward Compatibility

- v2.0 structure designed for future expansion
- New security policies can be added without breaking changes
- Modular design allows selective adoption

## Support

For migration assistance:
1. Review this document and [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. Use [ADOPTION_CHECKLIST.md](./ADOPTION_CHECKLIST.md) for validation
3. Contact Platform Engineering team for questions
