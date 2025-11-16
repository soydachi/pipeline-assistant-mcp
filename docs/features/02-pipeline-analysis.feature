# language: es
Característica: Análisis de Pipelines Existentes
  Como desarrollador
  Quiero validar mis pipelines contra los estándares corporativos
  Para identificar violaciones y recibir sugerencias de mejora

  Antecedentes:
    Dado que tengo acceso a los estándares corporativos
    Y el analizador MCP está configurado

  Escenario: Detectar violaciones críticas
    Dado que tengo un pipeline sin stage de seguridad
    Cuando ejecuto el análisis con "analyze_pipeline"
    Entonces recibo una violación de severidad "CRITICAL"
    Y el mensaje indica "Stage obligatorio faltante: Security"
    Y se proporciona código de ejemplo para añadir el stage

  Escenario: Detectar configuraciones inseguras
    Dado que mi pipeline tiene passwords hardcodeados
    Cuando se analiza el contenido YAML
    Entonces se detecta una violación "NO_SECRETS"
    Y se sugiere usar Azure Key Vault
    Y el análisis retorna un score de compliance < 50%

  Escenario: Sugerir mejoras de rendimiento
    Dado que mi pipeline no usa caché para dependencias
    Cuando analizo el pipeline en modo normal
    Entonces recibo una sugerencia de tipo "PERFORMANCE"
    Y se proporciona ejemplo de configuración de caché
    Y la prioridad es "LOW"

  Escenario: Validar estructura según tipo de proyecto
    Dado que analizo un pipeline para proyecto Node.js
    Cuando el pipeline no incluye "npm audit"
    Entonces recibo un warning "MISSING_SECURITY_AUDIT"
    Y se sugiere añadir el comando después de npm install
    Y se proporciona enlace a la wiki de estándares Node.js

  Escenario: Modo estricto vs modo normal
    Dado que ejecuto análisis en modo estricto
    Cuando encuentro cualquier desviación de mejores prácticas
    Entonces todas las sugerencias se convierten en warnings
    Y los warnings se convierten en violaciones
    Y el score mínimo aceptable es 95%
