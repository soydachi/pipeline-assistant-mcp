Feature: Integración con Azure DevOps
  Como equipo DevOps utilizando Azure DevOps
  Quiero analizar automáticamente mis Pull Requests
  Para garantizar el cumplimiento de estándares de pipeline desde el código

  Background:
    Given un servidor MCP de Pipeline Assistant configurado
    And una organización de Azure DevOps "https://dev.azure.com/myorg"
    And un proyecto "MyProject" con repositorio "MyRepo"
    And un Personal Access Token válido con permisos necesarios

  # ========== Escenario 6.1: Cliente Base Azure DevOps ==========
  Scenario: 6.1.1 - Conexión exitosa a Azure DevOps API
    Given una configuración válida de Azure DevOps con:
      | campo                | valor                              |
      | organizationUrl      | https://dev.azure.com/myorg        |
      | personalAccessToken  | valid-pat-token                    |
      | project              | MyProject                          |
    When el cliente intenta conectarse a Azure DevOps
    Then la conexión debe ser exitosa
    And el cliente debe poder listar repositorios del proyecto
    And debe retornar al menos 1 repositorio

  Scenario: 6.1.2 - Manejo de errores de autenticación
    Given una configuración con PAT inválido
    When el cliente intenta conectarse a Azure DevOps
    Then debe lanzar un error de autenticación
    And el mensaje debe indicar "Invalid Personal Access Token"
    And debe sugerir verificar el token y sus permisos

  Scenario: 6.1.3 - Validación de permisos del PAT
    Given un PAT con permisos insuficientes
    When el cliente verifica los permisos necesarios
    Then debe identificar los permisos faltantes
    And debe listar los scopes requeridos:
      | scope                    |
      | vso.code                 |
      | vso.work_write           |
      | vso.build                |
    And debe proporcionar URL para generar nuevo PAT

  Scenario: 6.1.4 - Obtener información de repositorio
    Given un cliente conectado exitosamente
    When solicito información del repositorio "MyRepo"
    Then debe retornar los detalles del repositorio:
      | campo          | tipo      |
      | id             | string    |
      | name           | string    |
      | defaultBranch  | string    |
      | url            | string    |
      | project        | object    |
    And el defaultBranch debe ser "refs/heads/main" o similar

  Scenario: 6.1.5 - Listar Pull Requests activos
    Given un repositorio con 3 Pull Requests activos
    When solicito la lista de PRs activos
    Then debe retornar exactamente 3 Pull Requests
    And cada PR debe contener:
      | campo              | tipo      |
      | pullRequestId      | number    |
      | title              | string    |
      | status             | string    |
      | createdBy          | object    |
      | sourceRefName      | string    |
      | targetRefName      | string    |

  Scenario: 6.1.6 - Obtener detalles completos de un PR
    Given un Pull Request con ID 123
    When solicito los detalles completos del PR
    Then debe retornar información detallada incluyendo:
      | campo              | obligatorio |
      | pullRequestId      | yes         |
      | title              | yes         |
      | description        | no          |
      | status             | yes         |
      | creationDate       | yes         |
      | lastMergeCommit    | no          |
      | reviewers          | yes         |
      | workItemRefs       | no          |
    And debe incluir la lista de commits del PR
    And debe incluir los archivos modificados

  Scenario: 6.1.7 - Obtener archivos modificados en PR
    Given un Pull Request que modifica 5 archivos
    When solicito los archivos modificados del PR
    Then debe retornar exactamente 5 archivos
    And cada archivo debe incluir:
      | campo           | descripción                    |
      | path            | Ruta del archivo               |
      | changeType      | edit, add, delete, rename      |
      | originalPath    | Ruta original (si rename)      |
    And debe filtrar solo archivos YAML de pipelines

  Scenario: 6.1.8 - Obtener contenido de archivo en PR
    Given un PR que modifica "azure-pipelines.yml"
    When solicito el contenido del archivo "azure-pipelines.yml"
    Then debe retornar el contenido del archivo
    And el contenido debe ser del commit HEAD del PR
    And debe estar decodificado correctamente (no base64)

  Scenario: 6.1.9 - Manejo de rate limiting
    Given un cliente que ha excedido el rate limit de Azure DevOps
    When intento realizar una operación
    Then debe detectar el error de rate limiting
    And debe esperar el tiempo especificado en Retry-After header
    And debe reintentar automáticamente la operación
    And debe loguear el evento de rate limiting

  Scenario: 6.1.10 - Configuración de retry policy
    Given una configuración con retry policy:
      | parámetro         | valor |
      | maxRetries        | 3     |
      | retryDelayMs      | 1000  |
      | backoffMultiplier | 2     |
    When ocurre un error temporal (429, 500, 503)
    Then debe reintentar hasta 3 veces
    And el delay debe incrementarse exponencialmente
    And debe loguear cada intento

  # ========== Escenario 6.2: Configuración ==========
  Scenario: 6.2.1 - Cargar configuración desde variables de entorno
    Given las siguientes variables de entorno:
      | variable                      | valor                              |
      | AZDO_ORG_URL                  | https://dev.azure.com/myorg        |
      | AZDO_PAT                      | my-secret-pat                      |
      | AZDO_PROJECT                  | MyProject                          |
      | AZDO_ENFORCEMENT_MODE         | enforcement                        |
    When cargo la configuración de Azure DevOps
    Then la configuración debe incluir todos los valores
    And el PAT no debe aparecer en logs
    And el enforcementMode debe ser "enforcement"

  Scenario: 6.2.2 - Cargar configuración desde archivo JSON
    Given un archivo "azdo-config.json" con configuración válida
    When cargo la configuración desde el archivo
    Then debe parsear correctamente el JSON
    And debe validar todos los campos requeridos
    And debe aplicar valores por defecto para campos opcionales

  Scenario: 6.2.3 - Validación de configuración incompleta
    Given una configuración sin el campo "organizationUrl"
    When valido la configuración
    Then debe fallar la validación
    And debe listar los campos faltantes requeridos
    And debe proporcionar valores de ejemplo

  Scenario: 6.2.4 - Configuración de enforcement mode
    Given una configuración con enforcementMode "learning"
    When analizo un PR con violaciones críticas
    Then el modo debe ser informativo
    And no debe bloquear el merge
    And debe incluir mensaje "Learning Mode" en comentarios

  Scenario: 6.2.5 - Configuración de strict mode
    Given una configuración con strictMode activado
    When analizo un pipeline
    Then debe validar también las reglas recomendadas
    And debe incrementar el peso de warnings en el score
    And el score mínimo aceptable debe ser 80%

  Scenario: 6.2.6 - Override de configuración por repositorio
    Given una configuración global
    And un archivo ".pipeline-assistant.json" en el repositorio
    When cargo la configuración para ese repositorio
    Then debe combinar configuración global y local
    And la configuración local debe tener precedencia
    And debe validar la configuración resultante

  # ========== Escenario 6.3: Tipos TypeScript ==========
  Scenario: 6.3.1 - Definición de tipos para Azure DevOps entities
    Given las interfaces TypeScript para Azure DevOps
    Then deben estar definidos los siguientes tipos:
      | tipo                      | propósito                           |
      | AzureDevOpsConfig         | Configuración del cliente           |
      | AzureDevOpsConnection     | Información de conexión             |
      | PullRequestInfo           | Información de PR                   |
      | GitPullRequestStatus      | Status de PR                        |
      | CommentThread             | Thread de comentarios               |
      | Comment                   | Comentario individual               |
      | PolicyConfiguration       | Configuración de políticas          |
      | WorkItemReference         | Referencia a work item              |
    And todos los tipos deben ser exportables
    And deben incluir documentación JSDoc

  Scenario: 6.3.2 - Validación de tipos en tiempo de compilación
    Given código que usa las interfaces de Azure DevOps
    When compilo el proyecto con TypeScript
    Then no debe haber errores de tipo
    And debe validar correctamente los tipos de Azure DevOps SDK
    And debe validar tipos personalizados del proyecto

  Scenario: 6.3.3 - Compatibilidad con tipos de azure-devops-node-api
    Given los tipos del SDK oficial de Azure DevOps
    When defino mis tipos personalizados
    Then deben ser compatibles con los tipos del SDK
    And deben extender correctamente las interfaces base
    And no debe haber conflictos de nombres

  # ========== Escenario 6.4: Manejo de Errores ==========
  Scenario: 6.4.1 - Error de red durante conexión
    Given un problema de conectividad de red
    When intento conectar a Azure DevOps
    Then debe capturar el error de red
    And debe loguear el error con contexto
    And debe proporcionar mensaje amigable al usuario

  Scenario: 6.4.2 - Error de proyecto no encontrado
    Given un proyecto "NonExistentProject" que no existe
    When intento acceder al proyecto
    Then debe retornar error 404
    And el mensaje debe indicar que el proyecto no existe
    And debe sugerir verificar el nombre del proyecto

  Scenario: 6.4.3 - Error de repositorio no encontrado
    Given un repositorio "NonExistentRepo" que no existe
    When intento acceder al repositorio
    Then debe retornar error 404
    And debe listar los repositorios disponibles en el proyecto

  Scenario: 6.4.4 - Logging estructurado de operaciones
    Given un cliente configurado con logging habilitado
    When realizo operaciones de API
    Then cada operación debe loguearse con:
      | campo          | descripción                    |
      | timestamp      | Timestamp de la operación      |
      | operation      | Nombre de la operación         |
      | duration       | Duración en ms                 |
      | statusCode     | Código de respuesta HTTP       |
      | error          | Error si ocurrió               |
    And los logs deben usar formato JSON estructurado

  # ========== Escenario 6.5: Seguridad ==========
  Scenario: 6.5.1 - PAT nunca debe aparecer en logs
    Given un cliente inicializado con un PAT
    When se loguean operaciones
    Then el PAT debe estar redactado en los logs
    And debe aparecer como "***REDACTED***"
    And ningún log debe contener el PAT completo

  Scenario: 6.5.2 - Almacenamiento seguro de credenciales
    Given credenciales de Azure DevOps
    When las almaceno en configuración
    Then no deben guardarse en texto plano en disco
    And deben usarse variables de entorno o Key Vault
    And debe haber advertencias en documentación

  Scenario: 6.5.3 - Validación de permisos mínimos requeridos
    Given un PAT con todos los permisos
    When valido los permisos
    Then debe advertir sobre permisos excesivos
    And debe sugerir usar solo los scopes necesarios:
      | scope                    | propósito                      |
      | vso.code                 | Leer/escribir código y PRs     |
      | vso.work_write           | Crear/actualizar work items    |
      | vso.build                | Acceder a build policies       |

  # ========== Escenario 6.6: Performance ==========
  Scenario: 6.6.1 - Cache de conexiones a Azure DevOps
    Given múltiples operaciones al mismo proyecto
    When realizo 10 operaciones consecutivas
    Then debe reutilizar la misma conexión
    And no debe crear 10 conexiones diferentes
    And debe reducir la latencia promedio

  Scenario: 6.6.2 - Batch de operaciones API
    Given 50 archivos a analizar en un PR
    When obtengo los contenidos de archivos
    Then debe agrupar las peticiones en batches
    And debe respetar el rate limit
    And debe completar en tiempo razonable (< 30s)

  Scenario: 6.6.3 - Métricas de performance
    Given un cliente instrumentado
    When realizo operaciones
    Then debe registrar métricas:
      | métrica                  | unidad |
      | api_call_duration        | ms     |
      | api_calls_count          | count  |
      | rate_limit_hits          | count  |
      | cache_hits               | count  |
      | cache_misses             | count  |
