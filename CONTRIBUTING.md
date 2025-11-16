# Contributing to Pipeline Assistant MCP

¡Gracias por tu interés en contribuir a Pipeline Assistant MCP! 🎉

## 📋 Código de Conducta

Este proyecto adhiere a un código de conducta basado en el respeto mutuo. Se espera que todos los contribuidores mantengan un ambiente acogedor y profesional.

## 🚀 Cómo Contribuir

### Reportar Bugs

Si encuentras un bug:

1. Verifica que no haya sido reportado previamente en [Issues](https://github.com/soydachi/pipeline-assistant-mcp/issues)
2. Crea un nuevo issue incluyendo:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Versión del proyecto y entorno
   - Logs relevantes

### Sugerir Mejoras

Para sugerir nuevas características:

1. Revisa el [Roadmap](README.md#roadmap) y los issues existentes
2. Abre un issue de tipo "enhancement" describiendo:
   - La funcionalidad propuesta
   - Casos de uso
   - Posible implementación (opcional)

### Pull Requests

1. **Fork el repositorio** y crea tu branch desde `main`:
   ```bash
   git checkout -b feature/mi-nueva-caracteristica
   ```

2. **Sigue las convenciones del proyecto**:
   - Código en TypeScript
   - Tests para nuevas funcionalidades
   - Documentación actualizada

3. **Estructura de commits**:
   ```
   tipo: descripción corta

   Descripción detallada opcional

   Fixes #123
   ```

   Tipos válidos:
   - `feat`: Nueva característica
   - `fix`: Corrección de bug
   - `docs`: Cambios en documentación
   - `style`: Formato (sin cambios en lógica)
   - `refactor`: Refactorización
   - `test`: Añadir o corregir tests
   - `chore`: Tareas de mantenimiento

4. **Asegúrate de que el código pase las pruebas**:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

5. **Actualiza la documentación** si es necesario

6. **Push a tu fork** y crea un Pull Request

## 🔧 Configuración del Entorno de Desarrollo

### Requisitos

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git

### Setup

```bash
# Clonar tu fork
git clone https://github.com/tu-usuario/pipeline-assistant-mcp.git
cd pipeline-assistant-mcp

# Instalar dependencias
npm install

# Compilar
npm run build

# Ejecutar tests
npm test

# Modo desarrollo
npm run dev
```

## 📝 Guías de Estilo

### TypeScript

- Usa tipos explícitos cuando sea posible
- Evita `any`, usa `unknown` si es necesario
- Interfaces para objetos, types para uniones/intersecciones
- Nombres descriptivos para variables y funciones

```typescript
// ✅ Bueno
interface PipelineConfig {
  projectType: 'dotnet' | 'node' | 'python';
  environment: Environment;
  services: AzureService[];
}

// ❌ Evitar
interface Config {
  type: any;
  env: string;
  svcs: Array<any>;
}
```

### Tests

- Un archivo de test por módulo
- Usa `describe` para agrupar tests relacionados
- Nombres descriptivos para los tests
- Mocks cuando sea necesario

```typescript
describe('PipelineAnalyzer', () => {
  describe('analyze', () => {
    it('should detect hardcoded secrets', async () => {
      // Arrange
      const pipeline = createTestPipeline();
      
      // Act
      const result = await analyzer.analyze(pipeline);
      
      // Assert
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'HARDCODED_SECRET'
        })
      );
    });
  });
});
```

### Documentación

- Comenta funciones públicas complejas
- Usa JSDoc para APIs públicas
- README claro para nuevas características
- Actualiza CHANGELOG.md

## 🏗️ Estructura del Proyecto

```
src/
├── server.ts           # Entry point del servidor MCP
├── handlers/           # Handlers para herramientas MCP
├── analyzers/          # Lógica de análisis
├── generators/         # Generadores de pipelines
├── parsers/           # Parsers de wiki/YAML
└── utils/             # Utilidades compartidas
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Con coverage
npm run test:coverage

# En modo watch
npm run test:watch

# Un archivo específico
npm test -- pipeline-analyzer.test.ts
```

### Escribir Tests

Los tests deben cubrir:
- Casos de éxito
- Casos de error
- Edge cases
- Integración cuando sea relevante

## 📦 Proceso de Release

1. Los releases se hacen desde la rama `main`
2. Versionado semántico (MAJOR.MINOR.PATCH)
3. Actualizar CHANGELOG.md
4. Crear tag: `git tag v1.0.0`
5. Push con tags: `git push origin main --tags`

## 💬 Comunicación

- **Issues**: Para bugs y características
- **Discussions**: Para preguntas y discusiones generales
- **Pull Requests**: Para contribuciones de código

## 📚 Recursos

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Azure Pipelines Docs](https://docs.microsoft.com/azure/devops/pipelines)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🙏 Reconocimientos

Todos los contribuidores serán reconocidos en el README principal.

---

¿Preguntas? Abre un issue o contacta a [@soydachi](https://github.com/soydachi)
