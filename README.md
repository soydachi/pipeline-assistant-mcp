# Pipeline Assistant MCP

## 🚀 MCP Server para Asistencia Inteligente de Pipelines CI/CD

Este proyecto implementa un servidor Model Context Protocol (MCP) que ayuda a los desarrolladores a generar y validar pipelines CI/CD según estándares corporativos documentados en una wiki.

## 📋 Características

- ✅ **Generación automática de pipelines** basada en estándares corporativos
- ✅ **Análisis de pipelines existentes** contra políticas de seguridad
- ✅ **Integración con VS Code** para asistencia en tiempo real
- ✅ **Bot para Pull Requests** con comentarios automáticos
- ✅ **Gestión de estándares** desde wiki en Markdown/YAML

## 🏗️ Estructura del Proyecto

```
pipeline-assistant-mcp/
├── docs/features/          # Features en formato Gherkin
├── wiki/standards/         # Estándares corporativos
├── src/                    # Código fuente TypeScript
│   ├── server.ts          # Servidor MCP principal
│   ├── wiki-parser.ts     # Parser de estándares
│   └── pipeline-generator.ts # Generador de pipelines
├── package.json           # Configuración npm
├── tsconfig.json          # Configuración TypeScript
└── PROGRESS.md            # Tracking del desarrollo
```

## 🛠️ Instalación

### Requisitos previos
- Node.js 20.x o superior
- npm 9.x o superior
- VS Code (opcional, para la extensión)

### Pasos de instalación

1. **Descomprimir el proyecto**
```bash
unzip pipeline-assistant-mcp.zip
cd pipeline-assistant-mcp
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Compilar el proyecto**
```bash
npm run build
```

4. **Configurar MCP en tu cliente** (ej: Claude Desktop, VS Code)
```json
{
  "mcpServers": {
    "pipeline-assistant": {
      "command": "node",
      "args": ["path/to/dist/server.js"],
      "transport": "stdio"
    }
  }
}
```

## 🎯 Uso

### Desde CLI

```bash
# Generar un pipeline para proyecto .NET
pipeline-assistant generate --type dotnet --env prod

# Analizar un pipeline existente
pipeline-assistant analyze azure-pipelines.yml --strict

# Obtener sugerencias de mejora
pipeline-assistant suggest azure-pipelines.yml --focus security,performance
```

### Desde VS Code

1. Instalar la extensión Pipeline Assistant (cuando esté disponible)
2. Abrir un archivo `.yml` de pipeline
3. Usar los comandos:
   - `Ctrl+Shift+P` → "Pipeline Assistant: Generate"
   - `Ctrl+Shift+P` → "Pipeline Assistant: Analyze"

### Como servidor MCP

El servidor expone tres herramientas principales:

#### `generate_pipeline`
Genera un pipeline completo basado en estándares corporativos.

Parámetros:
- `projectType`: 'dotnet' | 'node' | 'python'
- `services`: Array de servicios (ej: ['azuresql', 'redis'])
- `environment`: 'dev' | 'staging' | 'prod'

#### `analyze_pipeline`
Analiza un pipeline YAML contra los estándares.

Parámetros:
- `yamlContent`: Contenido del pipeline en YAML
- `strictMode`: Boolean para aplicar validación estricta

#### `suggest_improvements`
Sugiere mejoras para un pipeline existente.

Parámetros:
- `yamlContent`: Contenido del pipeline
- `focus`: Array con áreas de enfoque ['security', 'performance', 'compliance', 'quality']

## 📚 Configuración de Estándares

Los estándares se definen en la carpeta `wiki/standards/`:

### pipeline-standards.md
Define las reglas obligatorias, recomendadas y prohibidas para los pipelines.

### security-policies.yaml
Define las políticas de seguridad específicas y sus configuraciones.

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar test de un escenario específico
npm test -- --testNamePattern="Generar pipeline básico"
```

## 📊 Metodología de Desarrollo

Este proyecto sigue el **Proceso de 5 Pasos para Planificación con IA**:

1. **Define la Idea** en lenguaje natural
2. **Solicita Features** en formato Gherkin
3. **Persiste Features** en archivos .feature
4. **Implementa PROGRESS.md** para tracking
5. **Desarrollo escenario por escenario**

Ver `PROGRESS.md` para el estado actual del desarrollo.

## 🚀 Roadmap

- [x] Generación básica de pipelines
- [ ] Análisis completo de pipelines
- [ ] Extensión VS Code
- [ ] Bot para GitHub Actions
- [ ] Bot para Azure DevOps
- [ ] Dashboard de métricas
- [ ] Auto-fix de violaciones

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es parte de una demostración técnica para la charla "IA generativa en DevSecOps" y está disponible con fines educativos.

## 👥 Autor

Desarrollado para la charla en TechFest Madrid sobre automatización inteligente de pipelines CI/CD.

## 🙏 Agradecimientos

- Anthropic por el SDK de MCP
- La comunidad de DevSecOps por las mejores prácticas
- Los asistentes a la charla por su interés en la automatización inteligente

---

Para más información sobre el Model Context Protocol, visita: https://modelcontextprotocol.io
