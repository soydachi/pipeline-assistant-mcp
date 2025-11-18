# Pipeline Assistant MCP

## 🚀 MCP Server para Asistencia Inteligente de Pipelines CI/CD

Sistema inteligente basado en Model Context Protocol (MCP) que automatiza la generación, validación y mejora de pipelines CI/CD según estándares corporativos, integrando IA generativa en el flujo DevSecOps.

## ✨ Características Principales

### 🤖 Generación Inteligente
- **Generación automática de pipelines** basada en wiki corporativa
- **Templates específicos por tecnología** (.NET, Node.js, Python, Java, Go)
- **Aplicación automática de políticas de seguridad** desde el primer commit
- **Soporte multi-servicio** para Azure (SQL, Redis, Key Vault, Service Bus, etc.)

### 🔍 Análisis y Validación
- **Detección de 15+ tipos de violaciones** de seguridad y compliance
- **Identificación de secretos hardcodeados** con sugerencias de remediación
- **Análisis específico por lenguaje** y tipo de proyecto
- **Modo estricto vs permisivo** configurable
- **Cálculo de compliance score** con métricas detalladas

### 🛠️ Integraciones

#### VS Code Extension
- **6 Providers especializados** (Diagnostic, CodeAction, Completion, Hover, etc.)
- **Análisis en tiempo real** mientras editas
- **Quick Fixes automáticos** con un click
- **35+ snippets inteligentes** con autocompletado contextual
- **Wiki webview interactiva** para consultar estándares

#### GitHub Integration
- **GitHub Action automático** para análisis en PRs
- **Comentarios inline precisos** en las líneas exactas
- **Re-análisis con comando** `/reanalyze`
- **Badges visuales** de compliance score
- **Modo learning vs enforcement** configurable

#### Azure DevOps Integration ✅ NUEVO
- **Cliente API completo** con autenticación PAT
- **PR Bot automático** con análisis en tiempo real
- **Comentarios inline** en líneas específicas del código
- **Status checks** para bloquear/aprobar merge
- **Webhook handler** para análisis automático en push
- **Gestión de threads** con resolución automática
- **Retry logic** con backoff exponencial
- **Cache y métricas** de performance

### 📊 Gestión y Métricas
- **Wiki auto-actualizable** con file watching
- **Versionado de políticas** con historial completo
- **Rollback de versiones** para auditoría
- **Métricas de adopción** con reportes mensuales
- **Top 10 violaciones** más comunes

## 🏗️ Arquitectura del Proyecto

```
pipeline-assistant-mcp/
├── docs/features/          # Features BDD en Gherkin
├── wiki/
│   └── standards/         # Estándares corporativos
│       ├── pipeline-standards.md
│       ├── security-policies.yaml
│       └── templates/     # Templates por tecnología
├── src/
│   ├── server.ts          # Servidor MCP principal
│   ├── pipeline-generator.ts
│   ├── pipeline-analyzer.ts
│   ├── policy-enforcer.ts
│   ├── wiki-manager.ts
│   ├── wiki-parser.ts
│   ├── pr-bot.ts
│   └── azure-devops/         # Integración Azure DevOps
│       ├── client.ts         # Cliente API
│       ├── pr-bot.ts         # Bot de PRs
│       ├── config.ts         # Configuración
│       ├── types.ts          # Tipos TypeScript
│       ├── webhook-handler.ts
│       ├── comment-thread-manager.ts
│       └── pr-status-manager.ts
├── vscode-extension/      # Extensión VS Code
│   └── src/
│       ├── extension.ts
│       ├── providers/    # 6 providers
│       └── mcp/         # Cliente MCP
├── cli/                   # Herramientas CLI
│   ├── pr-bot-cli.ts
│   └── wiki-cli.ts
├── .github/workflows/     # GitHub Actions
│   └── pipeline-review.yml
├── tests/                 # Tests unitarios
├── examples/              # Ejemplos de pipelines
└── package.json

```

## 🛠️ Instalación

### Requisitos Previos
- Node.js 20.x o superior
- npm 9.x o superior
- Git
- VS Code (para la extensión)

### Instalación Rápida

```bash
# Clonar el repositorio
git clone https://github.com/soydachi/pipeline-assistant-mcp.git
cd pipeline-assistant-mcp

# Instalar dependencias
npm install

# Compilar el proyecto
npm run build

# Ejecutar tests
npm test
```

### Configuración del Servidor MCP

#### Para Claude Desktop
Edita tu archivo de configuración Claude (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pipeline-assistant": {
      "command": "node",
      "args": ["./dist/server.js"],
      "cwd": "/path/to/pipeline-assistant-mcp",
      "transport": "stdio"
    }
  }
}
```

#### Para VS Code
1. Instala la extensión desde el directorio `vscode-extension/`
2. O configura manualmente en `settings.json`:

```json
{
  "pipeline-assistant.mcp.enabled": true,
  "pipeline-assistant.mcp.serverPath": "/path/to/dist/server.js"
}
```

## 🎯 Uso

### CLI - Gestión de Pipelines

```bash
# Generar pipeline para microservicio .NET con Redis y SQL
pipeline-assistant generate \
  --type dotnet \
  --services redis,azuresql \
  --env production

# Analizar pipeline existente
pipeline-assistant analyze azure-pipelines.yml \
  --strict \
  --output json

# Obtener sugerencias de mejora
pipeline-assistant suggest pipeline.yml \
  --focus security,performance
```

### CLI - Gestión de Wiki

```bash
# Ver estándares actuales
pipeline-wiki standards --list

# Monitorear cambios en la wiki
pipeline-wiki watch --interval 60000

# Ver métricas de adopción
pipeline-wiki metrics --current

# Generar reporte mensual
pipeline-wiki metrics --report markdown --export report.md
```

### CLI - Análisis de PRs

```bash
# Analizar un PR
pipeline-assistant-pr analyze \
  --owner myorg \
  --repo myrepo \
  --pr 123 \
  --token $GITHUB_TOKEN

# Modo dry-run (sin comentarios)
pipeline-assistant-pr analyze \
  --pr 123 \
  --dry-run
```

### Desde VS Code

1. **Generar Pipeline**: `Ctrl+Shift+P` → "Pipeline Assistant: Generate"
2. **Analizar**: Abre cualquier `.yml` y ve los diagnósticos en tiempo real
3. **Quick Fix**: Click en el icono de bombilla o `Ctrl+.`
4. **Ver Wiki**: `Ctrl+Shift+P` → "Pipeline Assistant: Show Wiki"

### Como Servidor MCP

El servidor expone las siguientes herramientas:

#### `generate_pipeline`
```typescript
{
  projectType: 'dotnet' | 'node' | 'python' | 'java' | 'go',
  services: ['redis', 'azuresql', 'keyvault'],
  environment: 'dev' | 'staging' | 'prod',
  features?: ['docker', 'helm', 'monitoring']
}
```

#### `analyze_pipeline`
```typescript
{
  yamlContent: string,
  strictMode?: boolean,
  projectType?: string,
  checkSecurity?: boolean,
  checkPerformance?: boolean
}
```

#### `suggest_improvements`
```typescript
{
  yamlContent: string,
  focus?: ['security', 'performance', 'compliance', 'quality']
}
```

## 📚 Configuración de Estándares

### Estructura de Wiki

```markdown
# wiki/standards/pipeline-standards.md

## Obligatorio
### SEC-001: Escaneo de Secretos
Severidad: CRITICAL
Tags: security, secrets

## Recomendado
### PERF-001: Uso de Caché

## Prohibido
### UNSAFE-001: Trigger sin restricciones
```

### Políticas de Seguridad

```yaml
# wiki/standards/security-policies.yaml

security_scanning:
  required: true
  tools:
    - TruffleHog
    - Snyk
    - SonarQube

secret_management:
  azure_keyvault:
    required: true
  hardcoded_secrets:
    forbidden: true
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests en modo watch
npm run test:watch

# Test específico por feature
npm test -- --testNamePattern="Feature 1"
```

## 📊 Métricas e Impacto

### Antes de Pipeline Assistant
- ⏱️ Tiempo creación pipeline: 2-4 horas
- 🐛 Errores de seguridad: 3-5 por pipeline
- 📉 Compliance inicial: ~40%
- 🚨 Detección de problemas: En producción

### Con Pipeline Assistant
- ⏱️ Tiempo creación pipeline: 5 minutos
- ✅ Errores de seguridad: 0 (bloqueados automáticamente)
- 📈 Compliance: 95%+
- 🛡️ Detección de problemas: Pre-commit

## 🚀 Roadmap

### v1.0 (Actual) ✅
- ✅ Generación automática de pipelines
- ✅ Análisis y validación completa
- ✅ Integración VS Code con 6 providers
- ✅ Bot para GitHub PRs
- ✅ Gestión de wiki y métricas
- ✅ **Integración Azure DevOps completa (Fases 1 y 2)**
  - Cliente API con autenticación y retry logic
  - PR Bot con comentarios inline
  - Status checks para bloquear/aprobar merge
  - Webhook handler para análisis automático

### v1.1 (Q1 2025)
- [ ] Bot para GitLab
- [ ] Dashboard web de métricas
- [ ] Auto-fix avanzado con IA

### v1.2 (Q2 2025)
- [ ] Soporte para Terraform/IaC
- [ ] Análisis de Dockerfiles
- [ ] Integración con Backstage
- [ ] Políticas personalizables por equipo

### v2.0 (Q3 2025)
- [ ] ML para predicción de fallos
- [ ] Optimización automática de pipelines
- [ ] Gestión multi-tenant
- [ ] API REST completa

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: nueva característica increíble'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guía de Contribución

- Sigue el estilo de código existente (usa `npm run lint`)
- Añade tests para nuevas funcionalidades
- Actualiza la documentación cuando sea necesario
- Mantén los commits atómicos y descriptivos

## 📝 Licencia

Este proyecto está licenciado bajo Apache License 2.0 - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**Dachi Gogotchuri (@soydachi)**

🔧 Platform Lead Engineer @ [NN España](https://nnespana.es)  
🚀 Founder @ [Arcasiles Group](https://arcasiles.com)  
🎸 Leading @vegasoulband & @jaleo.band  
❤️ Creating value through passion

- Website: [soydachi.com](https://soydachi.com)
- GitHub: [@soydachi](https://github.com/soydachi)
- LinkedIn: [Dachi Gogotchuri](https://linkedin.com/in/soydachi)

## 🙏 Agradecimientos


## 📖 Recursos

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Azure Pipelines Documentation](https://docs.microsoft.com/azure/devops/pipelines)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Presentación TechFest Madrid](https://techfest.madrid)

---

**Pipeline Assistant MCP** - Transformando la manera de crear y mantener pipelines CI/CD con IA generativa 🚀

*Desarrollado con ❤️ para la comunidad DevSecOps*
