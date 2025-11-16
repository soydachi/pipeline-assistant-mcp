# Pipeline Standards - Estándares Corporativos CI/CD

## Obligatorio

### 1. Estructura de Stages
Todo pipeline DEBE contener los siguientes stages en este orden:
- **Validate**: Validación de sintaxis y linting
- **Security**: Análisis de seguridad (SAST, secrets, dependencies)
- **Build**: Compilación del código
- **Test**: Ejecución de tests unitarios y de integración
- **Deploy**: Despliegue condicional según branch

### 2. Análisis de Seguridad
Es obligatorio incluir las siguientes herramientas:
- **TruffleHog**: Escaneo de secretos en el código
- **SonarQube**: Análisis estático de código (SAST)
- **Snyk/WhiteSource**: Análisis de dependencias vulnerables
- **Trivy**: Escaneo de imágenes Docker (si aplica)

### 3. Variables y Secretos
- PROHIBIDO hardcodear credenciales, usar Azure Key Vault
- Todas las connection strings deben venir de variable groups
- Usar service connections para autenticación con Azure

## Recomendado

### 1. Optimización de Performance
- Implementar caché para dependencias (npm, NuGet, pip)
- Usar parallel jobs cuando sea posible
- Configurar incremental builds

### 2. Notificaciones
- Configurar notificaciones de fallo a Teams/Slack
- Incluir dashboards de métricas de pipeline

## Prohibido

### 1. Malas Prácticas
- NO usar `trigger: true` sin especificar branches
- NO ejecutar deployments sin approval gates en producción
- NO deshabilitar análisis de seguridad con `continueOnError: true`
- NO usar versiones no específicas de tasks (usar @2, @3, etc)

## Templates por Tecnología

### .NET
```yaml
pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'
  dotnetVersion: '8.x'

steps:
- task: UseDotNet@2
  inputs:
    version: $(dotnetVersion)
- task: DotNetCoreCLI@2
  inputs:
    command: 'restore'
- task: DotNetCoreCLI@2
  inputs:
    command: 'build'
    arguments: '--configuration $(buildConfiguration)'
- task: DotNetCoreCLI@2
  inputs:
    command: 'test'
    arguments: '--configuration $(buildConfiguration) --collect:"XPlat Code Coverage"'
```

### Node.js
```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '20.x'
- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    path: $(npm_config_cache)
- script: npm ci
- script: npm run build
- script: npm test
- script: npm audit --audit-level=high
```

### Python
```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.11'
- script: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
- script: |
    pip install pytest pytest-cov
    pytest tests/ --cov=./ --cov-report=xml
- script: |
    pip install safety
    safety check
```
