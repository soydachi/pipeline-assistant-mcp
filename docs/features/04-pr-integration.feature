# language: es
Característica: Revisión Automática en Pull Requests
  Como equipo de desarrollo
  Queremos validación automática de pipelines en PRs
  Para prevenir configuraciones incorrectas antes del merge

  Antecedentes:
    Dado que existe un workflow de GitHub Actions configurado
    Y el bot tiene permisos para comentar en PRs

  Escenario: Análisis automático al crear PR
    Dado que creo un PR con cambios en .github/workflows/
    Cuando el webhook de PR se activa
    Entonces el bot analiza todos los archivos YAML modificados
    Y publica un comentario con el resumen del análisis
    Y marca el PR como "Changes Requested" si hay violaciones

  Escenario: Comentarios inline en código
    Dado que mi pipeline tiene una violación en línea 25
    Cuando el bot completa el análisis
    Entonces aparece un comentario inline en esa línea exacta
    Y el comentario incluye:
      | elemento | contenido |
      | ícono | ❌ para error, ⚠️ para warning |
      | mensaje | descripción clara del problema |
      | sugerencia | código corregido en formato YAML |
      | enlace | link a documentación en wiki |

  Escenario: Re-análisis tras correcciones
    Dado que tengo comentarios del bot sobre violaciones
    Cuando pusheo commits con correcciones
    Entonces el bot re-analiza automáticamente
    Y marca como resueltos los issues corregidos
    Y actualiza el estado del PR a "Approved" si todo está bien

  Escenario: Reporte de compliance score
    Dado que el análisis está completo
    Cuando veo el comentario principal del bot
    Entonces incluye:
      | métrica | descripción |
      | score | porcentaje de compliance (0-100%) |
      | violaciones | contador por severidad |
      | tendencia | mejora/empeoramiento vs main |
      | badges | visual indicators del estado |

  Escenario: Modo learning vs enforcement
    Dado que configuramos el bot en modo "learning"
    Cuando encuentra violaciones
    Entonces solo añade comentarios informativos
    Y no bloquea el merge del PR
    Pero si está en modo "enforcement"
    Entonces bloquea el merge hasta resolver críticos
