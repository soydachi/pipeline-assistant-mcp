# Ejemplos de Pipeline Assistant MCP

Este directorio contiene ejemplos prácticos para usar Pipeline Assistant.

## 📁 Estructura

```
examples/
├── pipelines/              # Ejemplos de pipelines
│   ├── pipeline-con-problemas.yml
│   └── pipeline-arreglado.yml
├── config.json            # Configuración de ejemplo
└── README.md             # Este archivo
```

## 🚀 Uso Rápido

### 1. Analizar Pipeline Problemático

```bash
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-con-problemas.yml
```

**Resultado esperado:**
- Score: ~25/100
- 2 secretos hardcodeados detectados
- Trigger configuration inseguro
- Sin stage de seguridad
- Sin tests

### 2. Analizar Pipeline Arreglado

```bash
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-arreglado.yml
```

**Resultado esperado:**
- Score: ~95/100
- Todos los secretos en Key Vault
- Stages de seguridad incluidos
- Tests y validaciones presentes

### 3. Generar Pipeline desde Cero

```bash
# Pipeline básico para Node.js
node dist/cli/pipeline-assistant.js generate \
  --type node \
  --env dev \
  --output mi-pipeline.yml

# Pipeline complejo para .NET con servicios
node dist/cli/pipeline-assistant.js generate \
  --type dotnet \
  --services redis,azuresql,keyvault,servicebus \
  --env production \
  --output pipeline-produccion.yml
```

### 4. Obtener Sugerencias

```bash
node dist/cli/pipeline-assistant.js suggest \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --focus security
```

### 5. Usar Configuración Custom

```bash
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --config examples/config.json
```

## 📊 Ejemplos de Wiki

### Ver Estándares

```bash
# Listar todos
node dist/cli/wiki-cli.js standards --list

# Ver detalle
node dist/cli/wiki-cli.js standards --show sec-001
```

### Ver Templates

```bash
# Listar templates
node dist/cli/wiki-cli.js templates --list

# Exportar template
node dist/cli/wiki-cli.js templates --export microservicio-dotnet
```

### Métricas

```bash
# Métricas del mes actual
node dist/cli/wiki-cli.js metrics --current

# Historial
node dist/cli/wiki-cli.js metrics --history 12

# Generar reporte
node dist/cli/wiki-cli.js metrics --report markdown --export metricas.md
```

## 🤖 Ejemplos de PR Bot

### Simular Escenarios

```bash
# Pipeline bueno
node dist/cli/pr-bot-cli.js simulate --scenario good

# Pipeline malo
node dist/cli/pr-bot-cli.js simulate --scenario bad

# Pipeline mixto
node dist/cli/pr-bot-cli.js simulate --scenario mixed
```

### Analizar PR Real (requiere GITHUB_TOKEN)

```bash
export GITHUB_TOKEN="ghp_your_token_here"

# Dry run (no publica comentarios)
node dist/cli/pr-bot-cli.js analyze \
  --owner tu-usuario \
  --repo tu-repo \
  --pr 1 \
  --token $GITHUB_TOKEN \
  --dry-run

# Análisis real
node dist/cli/pr-bot-cli.js analyze \
  --owner tu-usuario \
  --repo tu-repo \
  --pr 1 \
  --token $GITHUB_TOKEN
```

## 🎯 Escenarios de Prueba

### Escenario 1: Pipeline con Secretos

**Problema:** Pipeline con credenciales hardcodeadas

```bash
# Analizar
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-con-problemas.yml

# Ver sugerencias
node dist/cli/pipeline-assistant.js suggest \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --focus security
```

### Escenario 2: Pipeline sin Tests

**Problema:** Pipeline que omite pruebas

```bash
# El análisis detectará la falta de tests
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --strict
```

### Escenario 3: Compliance Check

**Problema:** Verificar que un pipeline cumple con políticas

```bash
# Generar análisis
node dist/cli/pr-bot-cli.js analyze \
  --owner example \
  --repo example \
  --pr 1 \
  --token fake-token \
  --dry-run 2> analysis.json

# Verificar compliance
node dist/cli/pr-bot-cli.js check \
  --input analysis.json \
  --min-score 80 \
  --max-critical 0 \
  --max-high 2
```

## 📝 Notas

- Todos los ejemplos asumen que has compilado el proyecto con `npm run build`
- Los tokens de GitHub deben tener permisos de `repo` y `pull_request`
- Los archivos de configuración custom son opcionales
- Los reportes pueden exportarse en formato markdown, JSON o HTML
