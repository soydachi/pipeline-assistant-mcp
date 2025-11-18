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

#### Secret Scanning
- **TruffleHog** (via Docker): Escaneo de secretos en el código
```yaml
- script: |
    docker run --rm -v "$(Build.SourcesDirectory):/src" \
      trufflesecurity/trufflehog:latest \
      filesystem /src --fail --no-update
  displayName: 'TruffleHog Secret Scan'
```

#### Static Analysis (SAST)
- **SonarQube**: Análisis estático de código
```yaml
- task: SonarQubePrepare@6
  inputs:
    SonarQube: 'SonarQube-Connection'
    scannerMode: 'MSBuild'
    projectKey: 'my-project'
- task: SonarQubeAnalyze@6
- task: SonarQubePublish@6
```

#### Dependency Scanning
- **Snyk**: Análisis de dependencias vulnerables
```yaml
- task: SnykSecurityScan@1
  inputs:
    serviceConnectionEndpoint: 'Snyk-Connection'
    testType: 'app'
    severityThreshold: 'high'
    failOnIssues: true
```

#### Container Scanning (si aplica)
- **Trivy** (via Docker): Escaneo de imágenes Docker
```yaml
- script: |
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
      aquasec/trivy:latest image \
      --exit-code 1 \
      --severity CRITICAL,HIGH \
      $(imageRepository):$(Build.BuildId)
  displayName: 'Trivy Container Scan'
```

### 3. Variables y Secretos
- PROHIBIDO hardcodear credenciales, usar Azure Key Vault
- Todas las connection strings deben venir de variable groups
- Usar service connections para autenticación con Azure
- Formato correcto de variables con grupos:
```yaml
variables:
  - name: buildConfiguration
    value: 'Release'
  - group: common-variables
  - group: database-secrets
```

## Recomendado

### 1. Optimización de Performance
- Implementar caché para dependencias (npm, NuGet, pip)
- Usar parallel jobs cuando sea posible
- Configurar incremental builds

### 2. Notificaciones
- Configurar notificaciones de fallo a Teams/Slack
- Incluir dashboards de métricas de pipeline

### 3. Code Coverage
- Publicar resultados de cobertura
- Mantener mínimo 80% de cobertura

## Prohibido

### 1. Malas Prácticas
- NO usar `trigger: true` sin especificar branches
- NO ejecutar deployments sin approval gates en producción
- NO deshabilitar análisis de seguridad con `continueOnError: true`
- NO usar versiones no específicas de tasks (usar @2, @3, etc)
- NO mezclar formato escalar y lista en variables

### 2. Tareas Inválidas
Las siguientes tareas NO existen en Azure DevOps:
- `TruffleHog@1` - Usar script con Docker
- `Trivy@1` - Usar script con Docker
- `Snyk@1` - Nombre correcto: `SnykSecurityScan@1`

## Templates por Tecnología

### .NET
```yaml
pool:
  vmImage: 'ubuntu-latest'

variables:
  - name: buildConfiguration
    value: 'Release'
  - name: dotnetVersion
    value: '8.x'

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

variables:
  - name: nodeVersion
    value: '20.x'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: $(nodeVersion)
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

variables:
  - name: pythonVersion
    value: '3.11'

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: $(pythonVersion)
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
