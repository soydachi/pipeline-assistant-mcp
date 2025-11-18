# 🚀 Quick Start - Pipeline Assistant MCP

## ✅ Verificación Rápida (2 minutos)

```bash
# 1. Verificar instalación
node --version  # Debe ser v20.x.x o superior
npm --version   # Debe ser v9.x.x o superior

# 2. Instalar dependencias (si no lo hiciste)
npm install

# 3. Compilar proyecto
npm run build

# 4. Verificar que todo compiló
ls -la dist/cli/  # Deberías ver 3 archivos .js
ls -la dist/src/  # Deberías ver server.js y otros
```

## 🎯 Pruebas Rápidas

### 1. Pipeline Assistant CLI

```bash
# Generar pipeline
node dist/cli/pipeline-assistant.js generate \
  --type node \
  --env dev \
  --output demo-pipeline.yml

# Analizar archivo problemático
node dist/cli/pipeline-assistant.js analyze \
  --file examples/pipelines/pipeline-con-problemas.yml

# Obtener sugerencias
node dist/cli/pipeline-assistant.js suggest \
  --file examples/pipelines/pipeline-con-problemas.yml \
  --focus security
```

### 2. PR Bot CLI

```bash
# Simular escenarios
node dist/cli/pr-bot-cli.js simulate --scenario bad
node dist/cli/pr-bot-cli.js simulate --scenario good
node dist/cli/pr-bot-cli.js simulate --scenario mixed
```

### 3. Wiki CLI

```bash
# Ver estándares
node dist/cli/wiki-cli.js standards --list

# Ver templates
node dist/cli/wiki-cli.js templates --list

# Ver template específico
node dist/cli/wiki-cli.js templates --export microservicio-dotnet
```

## 📊 Test Completo

```bash
# Script de prueba todo-en-uno
cat > test-all.sh << 'EOF'
#!/bin/bash

echo "🧪 Testing Pipeline Assistant MCP"
echo "=================================="

echo ""
echo "✅ Test 1: Generate pipeline"
node dist/cli/pipeline-assistant.js generate --type node --env dev --output test.yml
echo ""

echo "✅ Test 2: Analyze bad pipeline"
node dist/cli/pipeline-assistant.js analyze --file examples/pipelines/pipeline-con-problemas.yml || true
echo ""

echo "✅ Test 3: Simulate PR Bot"
node dist/cli/pr-bot-cli.js simulate --scenario bad
echo ""

echo "✅ Test 4: List standards"
node dist/cli/wiki-cli.js standards --list
echo ""

echo "🎉 All tests completed!"
EOF

chmod +x test-all.sh
./test-all.sh
```

## 🎓 Para el Taller del Viernes

### Preparación Pre-Taller

1. **Compilar proyecto:**
   ```bash
   npm run build
   ```

2. **Tener ejemplos listos:**
   ```bash
   # Estos archivos ya están creados en examples/
   ls examples/pipelines/
   ```

3. **Probar todos los comandos** al menos una vez

### Durante el Taller

#### Demo 1: Generación (5 min)
```bash
# Mostrar generación básica
node dist/cli/pipeline-assistant.js generate --type dotnet --env production --output demo.yml
cat demo.yml | head -50
```

#### Demo 2: Análisis (5 min)
```bash
# Mostrar análisis de pipeline malo
node dist/cli/pipeline-assistant.js analyze --file examples/pipelines/pipeline-con-problemas.yml
```

#### Demo 3: PR Bot (3 min)
```bash
# Mostrar simulación
node dist/cli/pr-bot-cli.js simulate --scenario bad
```

#### Demo 4: Wiki (3 min)
```bash
# Mostrar estándares
node dist/cli/wiki-cli.js standards --list
node dist/cli/wiki-cli.js templates --list
```

## 🔧 Troubleshooting

### Error: "Cannot find module"
```bash
# Recompilar
npm run clean
npm run build
```

### Error: "Command not found"
```bash
# Verificar que Node.js está en el PATH
which node
node --version
```

### Error al analizar
```bash
# Verificar que el archivo existe
ls -la examples/pipelines/pipeline-con-problemas.yml
```

## 📝 Comandos Útiles para Copy-Paste

```bash
# Generar pipeline .NET con servicios
node dist/cli/pipeline-assistant.js generate --type dotnet --services redis,azuresql,keyvault --env production --output dotnet-full.yml

# Generar pipeline Node.js básico
node dist/cli/pipeline-assistant.js generate --type node --env dev --output node-basic.yml

# Generar pipeline Python
node dist/cli/pipeline-assistant.js generate --type python --env staging --output python.yml

# Analizar con modo estricto
node dist/cli/pipeline-assistant.js analyze --file examples/pipelines/pipeline-con-problemas.yml --strict

# Sugerencias enfocadas en rendimiento
node dist/cli/pipeline-assistant.js suggest --file examples/pipelines/pipeline-con-problemas.yml --focus performance
```

## ✨ Features Destacadas para Mostrar

1. **Generación Inteligente**: Pipeline completo en segundos
2. **Análisis de Seguridad**: Detecta secretos hardcodeados
3. **Compliance Scoring**: Score 0-100 con explicación
4. **Sugerencias Contextuales**: No solo detecta, sugiere cómo arreglar
5. **Simulación PR Bot**: Demo sin necesidad de GitHub token
6. **Wiki de Estándares**: Base de conocimiento corporativa
7. **Azure DevOps Integration**: Análisis de PRs con comentarios inline

## 🔷 Azure DevOps (NUEVO)

### Configuración Rápida

```bash
# Configurar variables
export AZDO_ORG_URL="https://dev.azure.com/tu-organizacion"
export AZDO_PAT="tu-personal-access-token"
export AZDO_PROJECT="NombreDelProyecto"
```

### Comandos Azure DevOps

```bash
# Analizar PR específico (requiere configuración)
# node dist/cli/azure-devops-cli.js analyze-pr --pr 123

# Analizar con comentarios inline
# node dist/cli/azure-devops-cli.js analyze-pr \
#   --pr 123 \
#   --post-comments \
#   --mode enforcement
```

### Para Demo sin Azure DevOps

Si no tienes acceso a Azure DevOps:
- Mostrar arquitectura en `src/azure-devops/`
- Explicar flujo con diagramas de PRESENTACION_TALLER.md
- Mostrar tests: `npm test -- --testNamePattern="azure"`

## 🎬 Script de Presentación

```
"Hoy les voy a mostrar Pipeline Assistant MCP, una herramienta que
revoluciona cómo gestionamos pipelines CI/CD.

[DEMO 1 - Generar]
Con un solo comando, genera un pipeline completo, siguiendo estándares
corporativos y mejores prácticas.

[DEMO 2 - Analizar]
Pero lo más potente es el análisis. Miren este pipeline con problemas...
detecta secretos hardcodeados, falta de tests, configuraciones inseguras.

[DEMO 3 - PR Bot]
Y esto se integra en tu workflow de GitHub. Cada PR recibe un análisis
automático antes de merge.

[DEMO 4 - Wiki]
Todo basado en una wiki de estándares corporativos, versionada y auditable.

¿Preguntas?"
```

## 📞 Soporte

- Repo: https://github.com/soydachi/pipeline-assistant-mcp
- Issues: https://github.com/soydachi/pipeline-assistant-mcp/issues
- Email: david@soydachi.com

---

**¡Buena suerte con el taller! 🚀**
