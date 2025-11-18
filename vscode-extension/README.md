# Pipeline Assistant - VS Code Extension

## 🚀 Asistente inteligente de CI/CD para Azure DevOps y GitHub Actions

Esta extensión integra el Pipeline Assistant MCP directamente en VS Code, proporcionando análisis en tiempo real, generación automática de pipelines y Quick Fixes inteligentes.

## ✨ Características

### 🎯 Comandos Principales

#### 1. **Pipeline Assistant: Generate** (`Ctrl+Shift+P`)
Genera un pipeline completo basado en estándares corporativos:
- Selección interactiva de tipo de proyecto (Node.js, .NET, Python)
- Configuración de servicios Azure (SQL, Redis, CosmosDB, etc.)
- Aplicación automática de políticas de seguridad
- Generación de `azure-pipelines.yml` listo para usar

#### 2. **Pipeline Assistant: Analyze** 
Analiza el pipeline actual y detecta:
- ❌ Violaciones críticas (stages faltantes, secretos hardcodeados)
- ⚠️ Warnings (configuraciones mejorables)
- 💡 Sugerencias de optimización

#### 3. **Pipeline Assistant: Suggest Improvements**
Genera sugerencias específicas para:
- 🛡️ Seguridad
- ⚡ Rendimiento
- ✅ Compliance
- 📈 Calidad

### 🔧 Funcionalidades en Tiempo Real

#### Análisis Automático
- Se activa al guardar archivos `.yml` o `.yaml`
- Muestra problemas en el panel de Problems
- Squiggly lines para errores y warnings
- Hover tooltips con explicaciones

#### Quick Fixes (💡)
Click en el bombillo o `Ctrl+.` para:
- ➕ Agregar stages obligatorios
- 🔐 Reemplazar secretos con Key Vault
- 🔧 Corregir triggers inseguros
- ⚠️ Remover `continueOnError` de tareas críticas
- 🔒 Agregar análisis de seguridad

### 📊 Panel de Diagnósticos

Los problemas se muestran con:
- **Severidad**: CRITICAL 🔴, HIGH 🟠, MEDIUM 🟡, LOW 🟢
- **Línea exacta** del problema
- **Código de error** específico
- **Sugerencias** de corrección

## 🛠️ Instalación

### Requisitos
1. VS Code 1.80.0 o superior
2. Node.js 16+ instalado
3. Servidor MCP configurado

### Pasos de Instalación

1. **Instalar la extensión**
```bash
# Desde el marketplace de VS Code
ext install pipeline-assistant-vscode

# O manualmente
code --install-extension pipeline-assistant-vscode-1.0.0.vsix
```

2. **Configurar el servidor MCP**
```bash
cd pipeline-assistant-mcp
npm install
npm run build
```

3. **Configurar la extensión**
Abre VS Code Settings (`Ctrl+,`) y busca "Pipeline Assistant":

```json
{
  "pipelineAssistant.mcpServerPath": "/path/to/mcp/server.js",
  "pipelineAssistant.wikiPath": "./wiki/standards",
  "pipelineAssistant.enableAutoAnalysis": true,
  "pipelineAssistant.strictMode": false
}
```

## 📖 Uso

### Generar un Pipeline Nuevo

1. Abre Command Palette (`Ctrl+Shift+P`)
2. Ejecuta "Pipeline Assistant: Generate"
3. Selecciona:
   - Tipo de proyecto
   - Servicios Azure necesarios
   - Ambiente (dev/staging/prod)
   - Si usa Docker
4. El pipeline se genera y abre automáticamente

### Analizar Pipeline Existente

1. Abre cualquier archivo `.yml` de pipeline
2. Guarda el archivo (`Ctrl+S`) para análisis automático
3. O ejecuta "Pipeline Assistant: Analyze" manualmente
4. Revisa el panel de Problems

### Aplicar Quick Fixes

1. Hover sobre cualquier error subrayado
2. Click en el bombillo 💡 o presiona `Ctrl+.`
3. Selecciona el fix deseado
4. El código se corrige automáticamente

## 🎨 Ejemplos de Quick Fixes

### Secreto Hardcodeado
**Antes:**
```yaml
variables:
  - name: password
    value: "MySecretPass123!"  # ❌ Error
```

**Quick Fix aplicado:**
```yaml
variables:
  - name: password
    value: "$(PASSWORD)"  # ✅ De Key Vault
    # Obtener de Key Vault - agregar AzureKeyVault@2 task
```

### Stage Faltante
**Antes:**
```yaml
stages:
  - stage: Build
  # ❌ Falta Security stage
```

**Quick Fix aplicado:**
```yaml
stages:
  - stage: Security
    displayName: 'Análisis de Seguridad'
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - task: SonarQube@5
  - stage: Build
```

## ⚙️ Configuración

### Opciones Disponibles

| Configuración | Descripción | Default |
|--------------|-------------|---------|
| `mcpServerPath` | Ruta al servidor MCP | Auto-detectado |
| `wikiPath` | Ruta a los estándares | `./wiki/standards` |
| `enableAutoAnalysis` | Análisis al guardar | `true` |
| `strictMode` | Modo estricto de análisis | `false` |
| `showInlineHints` | Mostrar hints inline | `true` |

## 🔍 Diagnósticos Detectados

### Violaciones Críticas
- `MISSING_MANDATORY_STAGE`: Stages obligatorios faltantes
- `HARDCODED_SECRET`: Secretos en texto plano
- `NO_SECURITY_SCANNING`: Sin herramientas de seguridad

### Warnings
- `MISSING_SECURITY_AUDIT`: Sin audit de seguridad
- `UNSAFE_TRIGGER`: Configuración de trigger peligrosa
- `SECURITY_BYPASS`: `continueOnError` en tareas críticas

### Sugerencias
- `PERFORMANCE`: Optimizaciones de rendimiento
- `QUALITY`: Mejoras de calidad
- `MAINTAINABILITY`: Mejoras de mantenibilidad

## 🎯 Atajos de Teclado

| Comando | Atajo | Descripción |
|---------|-------|-------------|
| Generate Pipeline | - | Command Palette |
| Analyze Current | - | Context Menu |
| Quick Fix | `Ctrl+.` | En errores |
| View Problems | `Ctrl+Shift+M` | Panel de problemas |

## 📊 Status Bar

La extensión muestra en la barra de estado:
- 🟢 Score >= 80%: Pipeline saludable
- 🟡 Score 60-79%: Necesita mejoras
- 🔴 Score < 60%: Requiere atención urgente

## 🐛 Troubleshooting

### El servidor MCP no conecta
1. Verifica que Node.js esté instalado
2. Confirma la ruta en settings
3. Revisa Output panel (`Ctrl+Shift+U`)

### No se muestran diagnósticos
1. Verifica que el archivo sea `.yml` o `.yaml`
2. Confirma que `enableAutoAnalysis` esté activo
3. Ejecuta análisis manual

### Quick Fixes no aparecen
1. Asegúrate de tener errores detectados
2. Hover sobre el error
3. Espera a que aparezca el bombillo

## 🤝 Contribuir

1. Fork el repositorio
2. Crea tu feature branch
3. Commit tus cambios
4. Push al branch
5. Abre un Pull Request

## 📄 Licencia

MIT

## 🔷 Integración con Azure DevOps

La extensión también soporta análisis de pipelines para Azure DevOps:

### Configuración

Añade a tu `settings.json`:
```json
{
  "pipelineAssistant.azureDevOps.enabled": true,
  "pipelineAssistant.azureDevOps.orgUrl": "https://dev.azure.com/tu-org",
  "pipelineAssistant.azureDevOps.project": "MiProyecto"
}
```

### Características Azure DevOps
- Análisis de PRs automático
- Comentarios inline en violaciones
- Status checks para bloquear merge
- Modo learning vs enforcement

Para más información, consulta la [documentación completa](../README.md).

## 🙏 Créditos

Desarrollado para demostración en charla sobre "IA generativa en DevSecOps".

---

**Pipeline Assistant** - Transformando la manera de crear y mantener pipelines CI/CD
