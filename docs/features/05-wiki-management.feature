# language: es
Característica: Gestión de Wiki y Estándares
  Como administrador de DevOps
  Quiero mantener actualizados los estándares en la wiki
  Para que el MCP siempre use las últimas políticas

  Antecedentes:
    Dado que tengo permisos de administrador
    Y acceso a la wiki corporativa

  Escenario: Parsear markdown de wiki a reglas
    Dado que la wiki tiene sección "## Obligatorio"
    Cuando el parser procesa el contenido
    Entonces extrae reglas de tipo "mandatory"
    Y cada regla tiene:
      | campo | tipo |
      | id | identificador único |
      | descripción | texto de la regla |
      | ejemplo | código de implementación |
      | severidad | CRITICAL, HIGH, MEDIUM, LOW |

  Escenario: Actualización automática de estándares
    Dado que la wiki se actualiza con nuevas políticas
    Cuando pasan 5 minutos (o se fuerza refresh)
    Entonces el MCP recarga los estándares
    Y notifica a clientes conectados sobre cambios
    Y los nuevos análisis usan reglas actualizadas

  Escenario: Templates específicos por tecnología
    Dado que tenemos templates para diferentes stacks
    Cuando solicito template para "microservicio-dotnet"
    Entonces obtengo pipeline con:
      | característica | implementación |
      | multi-stage | dev, staging, prod |
      | dockerización | build y push a ACR |
      | helm charts | deployment con Helm |
      | health checks | readiness y liveness |

  Escenario: Versionado de políticas
    Dado que necesito auditar cambios en políticas
    Cuando se modifica un estándar
    Entonces se guarda:
      | dato | propósito |
      | versión anterior | histórico |
      | fecha cambio | trazabilidad |
      | autor | responsabilidad |
      | justificación | contexto del cambio |

  Escenario: Exportar métricas de adopción
    Dado que quiero medir adopción de estándares
    Cuando genero reporte mensual
    Entonces obtengo:
      | métrica | valor |
      | pipelines analizados | cantidad total |
      | compliance promedio | porcentaje |
      | violaciones comunes | top 10 |
      | mejora mes a mes | tendencia |
