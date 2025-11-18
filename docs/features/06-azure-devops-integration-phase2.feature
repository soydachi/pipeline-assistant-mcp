# Feature 6.2: Azure DevOps PR Bot - Análisis Automático de Pull Requests

## Fase 2: PR Bot (Análisis Automático de Pull Requests)

Esta fase implementa el bot que analiza Pull Requests en Azure DevOps,
detecta violaciones de pipelines y proporciona feedback automatizado.

---

### 6.7 - PR Bot Core (Clase Principal)

#### 6.7.1 - Inicialización del PR Bot
**Como** desarrollador
**Quiero** inicializar el PR Bot con configuración válida
**Para** poder analizar Pull Requests automáticamente

```gherkin
Given tengo una configuración válida de Azure DevOps
When creo una instancia de AzureDevOpsPRBot
Then el bot debe inicializarse correctamente
And debe tener acceso al cliente de Azure DevOps
And debe tener acceso al analizador de pipelines
```

#### 6.7.2 - Análisis básico de PR
**Como** PR Bot
**Quiero** analizar los archivos de un Pull Request
**Para** detectar cambios en pipelines

```gherkin
Given un Pull Request con ID 123
And el PR contiene archivos modificados
When ejecuto analyzePullRequest(123)
Then debe obtener la lista de archivos modificados
And debe filtrar solo archivos de pipeline (*.yml, *.yaml)
And debe devolver los archivos de pipeline encontrados
```

#### 6.7.3 - Análisis de PR sin pipelines
**Como** PR Bot
**Quiero** detectar cuando un PR no tiene pipelines
**Para** no crear comentarios innecesarios

```gherkin
Given un Pull Request con ID 124
And el PR NO contiene archivos de pipeline
When ejecuto analyzePullRequest(124)
Then debe devolver una lista vacía de pipelines
And NO debe crear ningún comment thread
And debe registrar en logs que no hay pipelines
```

#### 6.7.4 - Análisis completo con violaciones
**Como** PR Bot
**Quiero** analizar pipelines y detectar violaciones
**Para** proporcionar feedback al desarrollador

```gherkin
Given un Pull Request con ID 125
And el PR contiene "azure-pipelines.yml" con 3 violaciones críticas
When ejecuto analyzePullRequest(125)
Then debe analizar el contenido del pipeline
And debe detectar las 3 violaciones críticas
And debe calcular el compliance score
And debe devolver el resultado del análisis con violaciones
```

#### 6.7.5 - Análisis con pipeline válido
**Como** PR Bot
**Quiero** reconocer pipelines sin violaciones
**Para** felicitar al desarrollador

```gherkin
Given un Pull Request con ID 126
And el PR contiene "azure-pipelines.yml" sin violaciones
When ejecuto analyzePullRequest(126)
Then debe analizar el contenido del pipeline
And el compliance score debe ser 100
And debe devolver resultado exitoso sin violaciones
```

---

### 6.8 - Comment Threads (Gestión de Comentarios)

#### 6.8.1 - Crear thread con violaciones críticas
**Como** PR Bot
**Quiero** crear un comment thread con violaciones
**Para** que el desarrollador vea el feedback

```gherkin
Given un análisis con 2 violaciones críticas en "azure-pipelines.yml"
When ejecuto createCommentThread(analysis, pullRequestId, fileName)
Then debe crear un comment thread en el PR
And el thread debe estar en estado "active"
And el comentario debe listar las 2 violaciones
And debe incluir el compliance score
And debe incluir sugerencias de corrección
```

#### 6.8.2 - Thread con formato markdown
**Como** desarrollador
**Quiero** recibir comentarios bien formateados
**Para** entender fácilmente las violaciones

```gherkin
Given un análisis con violaciones de diferentes severidades
When el bot crea un comment thread
Then el comentario debe usar formato markdown
And debe incluir emojis para cada severidad (🔴 critical, ⚠️ warning)
And debe separar violaciones por secciones
And debe incluir enlaces a la wiki corporativa
```

#### 6.8.3 - Comentarios inline en líneas específicas
**Como** desarrollador
**Quiero** ver comentarios en las líneas específicas con problemas
**Para** ubicar rápidamente el error

```gherkin
Given una violación en la línea 15 de "azure-pipelines.yml"
When el bot crea el comment thread
Then el thread debe estar anclado a la línea 15
And debe mostrar el contexto del código
And debe sugerir el código corregido
```

#### 6.8.4 - Actualizar thread existente
**Como** PR Bot
**Quiero** actualizar threads existentes al re-analizar
**Para** no crear comentarios duplicados

```gherkin
Given un PR que ya tiene un comment thread del bot
And el desarrollador ha corregido 1 de 3 violaciones
When ejecuto re-análisis del PR
Then debe actualizar el thread existente
And debe mostrar solo las 2 violaciones restantes
And debe indicar qué violación fue corregida
```

#### 6.8.5 - Cerrar thread cuando todo está corregido
**Como** PR Bot
**Quiero** cerrar threads cuando no hay más violaciones
**Para** indicar que el problema fue resuelto

```gherkin
Given un PR con un thread activo con violaciones
And el desarrollador ha corregido todas las violaciones
When ejecuto re-análisis del PR
Then debe actualizar el thread
And debe cambiar el estado a "fixed"
And debe agregar comentario de felicitación
```

---

### 6.9 - PR Status Checks (Estado del PR)

#### 6.9.1 - Crear status check "Pipeline Compliance"
**Como** PR Bot
**Quiero** crear un status check en el PR
**Para** bloquear merge si hay violaciones críticas

```gherkin
Given un análisis con violaciones críticas
When ejecuto updatePRStatus(analysis, pullRequestId)
Then debe crear un status check "Pipeline Compliance"
And el estado debe ser "failed"
And la descripción debe indicar número de violaciones
And debe incluir link al análisis completo
```

#### 6.9.2 - Status check exitoso
**Como** PR Bot
**Quiero** marcar el status check como exitoso
**Para** permitir merge cuando el pipeline es válido

```gherkin
Given un análisis sin violaciones
When ejecuto updatePRStatus(analysis, pullRequestId)
Then debe crear un status check "Pipeline Compliance"
And el estado debe ser "succeeded"
And la descripción debe indicar "✅ All checks passed"
```

#### 6.9.3 - Status check en modo learning
**Como** equipo
**Quiero** no bloquear merge en modo learning
**Para** permitir aprendizaje gradual

```gherkin
Given configuración con enforcementMode = 'learning'
And un análisis con violaciones críticas
When ejecuto updatePRStatus(analysis, pullRequestId)
Then debe crear un status check "Pipeline Compliance (Learning Mode)"
And el estado debe ser "succeeded" (no bloquea)
And la descripción debe indicar las violaciones como warning
```

#### 6.9.4 - Status check con compliance score
**Como** equipo
**Quiero** ver el compliance score en el status check
**Para** conocer la calidad del pipeline de un vistazo

```gherkin
Given un análisis con compliance score de 75%
When ejecuto updatePRStatus(analysis, pullRequestId)
Then la descripción del status debe incluir "Compliance: 75%"
And debe incluir breakdown de violaciones (2 critical, 3 warning)
```

#### 6.9.5 - Re-análisis automático tras push
**Como** desarrollador
**Quiero** que el bot re-analice tras cada push
**Para** ver si mis correcciones fueron efectivas

```gherkin
Given un PR con status check "failed"
And el desarrollador hace push con correcciones
When el webhook de Azure DevOps notifica el push
Then el bot debe ejecutar re-análisis automáticamente
And debe actualizar el status check
And debe actualizar los comment threads
```

---

### 6.10 - Integración con PipelineAnalyzer

#### 6.10.1 - Usar PipelineAnalyzer existente
**Como** PR Bot
**Quiero** reutilizar el PipelineAnalyzer existente
**Para** mantener consistencia en las reglas

```gherkin
Given el proyecto tiene un PipelineAnalyzer configurado
When el PR Bot analiza un pipeline
Then debe usar el mismo PipelineAnalyzer
And debe aplicar las mismas reglas
And los resultados deben ser idénticos a análisis local
```

#### 6.10.2 - Análisis con modo estricto
**Como** equipo
**Quiero** aplicar modo estricto en PRs
**Para** garantizar alta calidad desde el inicio

```gherkin
Given configuración con strictMode = true
When el PR Bot analiza un pipeline
Then debe pasar strictMode=true al PipelineAnalyzer
And debe detectar violaciones adicionales
And el compliance score debe ser más exigente
```

#### 6.10.3 - Análisis por tipo de proyecto
**Como** PR Bot
**Quiero** detectar automáticamente el tipo de proyecto
**Para** aplicar reglas específicas

```gherkin
Given un PR en un repositorio .NET
And el pipeline usa "DotNetCoreCLI@2"
When el PR Bot analiza el pipeline
Then debe detectar que es proyecto .NET
And debe aplicar reglas específicas de .NET
And debe validar estructura de microservicio si aplica
```

---

### 6.11 - Reportes y Métricas

#### 6.11.1 - Generar reporte de análisis completo
**Como** PR Bot
**Quiero** generar un reporte detallado
**Para** proporcionar contexto completo al desarrollador

```gherkin
Given un análisis completo de PR
When genero el reporte
Then debe incluir resumen ejecutivo
And debe incluir lista detallada de violaciones
And debe incluir sugerencias de corrección
And debe incluir enlaces a documentación
And debe incluir compliance score y tendencia
```

#### 6.11.2 - Métricas de PR por repositorio
**Como** equipo
**Quiero** ver métricas de PRs analizados
**Para** conocer la adopción de estándares

```gherkin
Given 10 PRs analizados en el último mes
When consulto las métricas del repositorio
Then debe mostrar total de PRs analizados
And debe mostrar promedio de compliance score
And debe mostrar violaciones más comunes
And debe mostrar tendencia de mejora
```

#### 6.11.3 - Exportar métricas a dashboard
**Como** líder técnico
**Quiero** exportar métricas a formato JSON
**Para** integrarlas en dashboards corporativos

```gherkin
Given métricas acumuladas de múltiples repositorios
When ejecuto exportMetrics()
Then debe generar archivo JSON con métricas
And debe incluir breakdown por repositorio
And debe incluir breakdown por tipo de violación
And debe incluir series temporales
```

---

### 6.12 - Manejo de Errores en PR Bot

#### 6.12.1 - Error al obtener archivos del PR
**Como** PR Bot
**Quiero** manejar errores de API gracefully
**Para** no fallar silenciosamente

```gherkin
Given un PR con ID 999 que no existe
When ejecuto analyzePullRequest(999)
Then debe capturar el error
And debe registrar en logs el error
And debe devolver resultado de error
And NO debe crear comment threads
```

#### 6.12.2 - Error al parsear pipeline YAML
**Como** PR Bot
**Quiero** reportar errores de sintaxis YAML
**Para** ayudar al desarrollador a corregirlos

```gherkin
Given un PR con pipeline YAML mal formado
When el bot intenta analizar el pipeline
Then debe capturar el error de parsing
And debe crear comment thread indicando el error de sintaxis
And debe sugerir herramientas de validación YAML
```

#### 6.12.3 - Retry en operaciones de Azure DevOps
**Como** PR Bot
**Quiero** reintentar operaciones fallidas
**Para** ser resiliente ante errores temporales

```gherkin
Given Azure DevOps API retorna error 503 (servicio no disponible)
When el bot intenta crear un comment thread
Then debe reintentar hasta 3 veces con backoff
And si falla después de 3 intentos, debe registrar error
And debe continuar con el siguiente paso del análisis
```

---

### 6.13 - Webhooks y Eventos

#### 6.13.1 - Webhook para PR creado
**Como** sistema
**Quiero** recibir webhook cuando se crea un PR
**Para** analizarlo automáticamente

```gherkin
Given un webhook configurado en Azure DevOps
When se crea un nuevo Pull Request
Then Azure DevOps debe enviar webhook "pullrequest.created"
And el bot debe procesar el evento
And debe iniciar análisis del PR
```

#### 6.13.2 - Webhook para PR actualizado
**Como** sistema
**Quiero** recibir webhook cuando se actualiza un PR
**Para** re-analizarlo automáticamente

```gherkin
Given un webhook configurado en Azure DevOps
When el desarrollador hace push al PR
Then Azure DevOps debe enviar webhook "pullrequest.updated"
And el bot debe procesar el evento
And debe ejecutar re-análisis
```

#### 6.13.3 - Filtrar eventos irrelevantes
**Como** PR Bot
**Quiero** filtrar webhooks que no requieren acción
**Para** no desperdiciar recursos

```gherkin
Given un webhook "pullrequest.updated" por cambio de reviewer
And NO hay cambios en archivos
When el bot procesa el webhook
Then debe detectar que no hay archivos modificados
And debe ignorar el evento
And NO debe ejecutar análisis
```

---

## 📊 Resumen Fase 2

**Total de Escenarios**: 25 escenarios
- 6.7 - PR Bot Core: 5 escenarios
- 6.8 - Comment Threads: 5 escenarios
- 6.9 - PR Status Checks: 5 escenarios
- 6.10 - Integración con PipelineAnalyzer: 3 escenarios
- 6.11 - Reportes y Métricas: 3 escenarios
- 6.12 - Manejo de Errores: 3 escenarios
- 6.13 - Webhooks y Eventos: 3 escenarios

**Componentes a Implementar**:
1. `AzureDevOpsPRBot` - Clase principal del bot
2. `CommentThreadManager` - Gestión de threads
3. `PRStatusManager` - Gestión de status checks
4. `WebhookHandler` - Manejo de eventos de Azure DevOps
5. `PRReportGenerator` - Generación de reportes
6. `PRMetricsCollector` - Recolección de métricas

**Dependencias**:
- ✅ AzureDevOpsClient (Fase 1)
- ✅ PipelineAnalyzer (existente)
- ✅ WikiManager (existente)
