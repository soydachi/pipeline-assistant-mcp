# Pipeline Standards - Corporate CI/CD Standards

> **Version:** 2.0.0
> **Last Updated:** 2025-11-18
> **Status:** Production Ready

## Overview

Este repositorio contiene los estándares corporativos para pipelines CI/CD. Todos los equipos deben seguir estas guías para garantizar seguridad, calidad y consistencia en los despliegues.

## Quick Navigation

### Core Standards
- [stages.yaml](core/stages.yaml) - Estructura obligatoria de stages
- [environments.yaml](core/environments.yaml) - Definición de ambientes
- [naming-conventions.yaml](core/naming-conventions.yaml) - Convenciones de nombres

### Security
- [policies.yaml](security/policies.yaml) - Políticas de seguridad obligatorias
- [sla.yaml](security/sla.yaml) - SLAs de remediación de vulnerabilidades
- [compliance-mapping.yaml](security/compliance-mapping.yaml) - Mapeo a frameworks (SOC2, ISO 27001)

### Quality
- [testing.yaml](quality/testing.yaml) - Estándares de testing
- [coverage.yaml](quality/coverage.yaml) - Métricas de cobertura
- [gates.yaml](quality/gates.yaml) - Quality gates por ambiente

### Platform-Specific
- [platforms/azure/](platforms/azure/) - Azure DevOps tasks y templates
- [platforms/github/](platforms/github/) - GitHub Actions y workflows
- [platforms/common/](platforms/common/) - Configuraciones compartidas

## Compliance Levels

| Level | Description | Required For |
|-------|-------------|--------------|
| **MANDATORY** | Must be implemented | All pipelines |
| **RECOMMENDED** | Should be implemented | Production workloads |
| **OPTIONAL** | Nice to have | Edge cases |

## Enforcement Modes

```yaml
learning:     # Solo reporta violaciones, no bloquea
progressive:  # Bloquea CRITICAL, advierte HIGH/MEDIUM
strict:       # Bloquea CRITICAL y HIGH
```

## Getting Started

1. Review [core/stages.yaml](core/stages.yaml) for pipeline structure
2. Implement security tools from [security/policies.yaml](security/policies.yaml)
3. Configure quality gates from [quality/gates.yaml](quality/gates.yaml)
4. Use platform templates from `platforms/{azure|github}/templates/`

## Exception Process

Si necesitas una excepción temporal a alguna política:

1. Documenta la justificación técnica
2. Define fecha de expiración (máximo 90 días)
3. Solicita aprobación del Security Team
4. Registra en `security/policies.yaml` bajo `exceptions`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-11-18 | Reorganización completa, nuevas políticas de seguridad |
| 1.0.0 | 2025-01-01 | Versión inicial |

## Contact

- **Platform Engineering Team**: platform-engineering@company.com
- **Security Team**: security@company.com
